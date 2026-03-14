const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const app = express();

const allowedOrigins = [
  /^https:\/\/.*\.web\.app$/,
  /^https:\/\/.*\.firebaseapp\.com$/,
  /^https:\/\/.*\.vercel\.app$/,
  "https://mailtrack-9umwjyu1b-nikolas-projects-34cf3b94.vercel.app",
  "http://localhost:3000",
  "https://mailtrack-mvp.vercel.app",
  /^chrome-extension:\/\//,
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((o) =>
      typeof o === "string" ? o === origin : o.test(origin)
    );
    allowed ? callback(null, true) : callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// ─── Bot/scanner detection ────────────────────────────────────────────────────
// These open images automatically for preview/security scanning — not real opens
const BOT_UA_PATTERNS = [
  /googleimageproxy/i,
  /yahoo.*mail/i,
  /outlookbot/i,
  /proofpoint/i,
  /barracuda/i,
  /mimecast/i,
  /symantec/i,
  /microsoft.*exchange/i,
  /antivirus/i,
  /kaspersky/i,
  /sophos/i,
  /fortigate/i,
  /headlesschrome/i,
  /phantomjs/i,
  /preview/i,
  /link.*preview/i,
  /slack.*bot/i,
  /twitterbot/i,
  /facebookexternalhit/i,
];

function isBot(userAgent = "") {
  return BOT_UA_PATTERNS.some(p => p.test(userAgent));
}

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

function sanitizeURL(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
    return parsed.toString();
  } catch { return null; }
}

// ─── ENDPOINT 1: Open Tracking Pixel ─────────────────────────────────────────

app.get("/pixel", async (req, res) => {
  // Always return pixel immediately
  res.set({
    "Content-Type": "image/png",
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
    "Content-Length": PIXEL_PNG.length,
  });
  res.status(200).end(PIXEL_PNG);

  const emailId = req.query.id;
  if (!emailId || typeof emailId !== "string") return;

  const userAgent = req.headers["user-agent"] || "";
  const ip = getClientIP(req);

  // 1. Skip bots and scanners
  if (isBot(userAgent)) {
    functions.logger.info("pixel: bot skipped", { emailId, userAgent });
    return;
  }

  try {
    // 2. Deduplication: same IP within 5 minutes = same open event, don't double-count
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentOpen = await db.collection("opens")
      .where("emailId", "==", emailId)
      .where("ip", "==", ip)
      .where("timestamp", ">", fiveMinutesAgo)
      .limit(1)
      .get();

    if (!recentOpen.empty) {
      functions.logger.info("pixel: duplicate open skipped", { emailId, ip });
      return;
    }

    // 3. Record the open
    const openRef = db.collection("opens").doc();
    await openRef.set({
      id: openRef.id,
      emailId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip,
      userAgent,
    });

    // 4. Increment on the email doc. Use set+merge so early opens are not lost
    // if the email registration request finishes slightly later.
    await db.collection("emails").doc(emailId).set({
      id: emailId,
      openCount: admin.firestore.FieldValue.increment(1),
      lastOpenedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

  } catch (err) {
    functions.logger.error("pixel tracking error", { emailId, err });
  }
});

// ─── ENDPOINT 2: Click Tracking ───────────────────────────────────────────────

app.get("/click", async (req, res) => {
  const emailId = req.query.id;
  const rawURL = req.query.url;

  if (!rawURL) return res.status(400).json({ error: "url parameter is required" });
  const safeURL = sanitizeURL(decodeURIComponent(rawURL));
  if (!safeURL) return res.status(400).json({ error: "Invalid or unsafe URL" });

  res.redirect(302, safeURL);
  if (!emailId || typeof emailId !== "string") return;

  try {
    const clickRef = db.collection("clicks").doc();
    await clickRef.set({
      id: clickRef.id,
      emailId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      url: safeURL,
      ip: getClientIP(req),
      userAgent: req.headers["user-agent"] || "unknown",
    });
    await db.collection("emails").doc(emailId).set({
      id: emailId,
      clickCount: admin.firestore.FieldValue.increment(1),
    }, { merge: true });
  } catch (err) {
    functions.logger.error("click tracking error", { emailId, safeURL, err });
  }
});

// ─── ENDPOINT 3: Register sent email ─────────────────────────────────────────

app.post("/email", async (req, res) => {
  const { emailId, userId, subject, recipient } = req.body || {};
  if (!emailId || !userId) return res.status(400).json({ error: "emailId and userId are required" });

  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Missing auth token" });
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    if (decoded.uid !== userId) return res.status(403).json({ error: "User mismatch" });

    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data() || {};
    if (userData.plan !== "pro") {
      const emailCount = await db.collection("emails").where("userId", "==", userId).count().get();
      if (emailCount.data().count >= 50) {
        return res.status(402).json({ error: "Free plan limit reached (50 emails). Upgrade to Pro." });
      }
    }

    const emailRef = db.collection("emails").doc(emailId);
    const existingSnap = await emailRef.get();
    const existing = existingSnap.data() || {};

    await emailRef.set({
      id: emailId,
      userId,
      subject: subject || existing.subject || "(no subject)",
      recipient: recipient || existing.recipient || "unknown",
      sentAt: existing.sentAt || admin.firestore.FieldValue.serverTimestamp(),
      openCount: typeof existing.openCount === "number" ? existing.openCount : 0,
      clickCount: typeof existing.clickCount === "number" ? existing.clickCount : 0,
      ...(existing.lastOpenedAt ? { lastOpenedAt: existing.lastOpenedAt } : {}),
    }, { merge: true });

    return res.status(201).json({ success: true, emailId });
  } catch (err) {
    functions.logger.error("email register error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── ENDPOINT 4: Get user's tracked emails ────────────────────────────────────

app.get("/user-emails", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Missing auth token" });
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    const userId = decoded.uid;

    const snapshot = await db.collection("emails")
      .where("userId", "==", userId)
      .orderBy("sentAt", "desc")
      .limit(200)
      .get();

    const emails = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        emailId: doc.id,
        subject: d.subject || "(no subject)",
        recipient: d.recipient || "",
        sentAt: d.sentAt?.toMillis?.() || null,
        openCount: d.openCount || 0,
        clickCount: d.clickCount || 0,
        openedAt: d.lastOpenedAt?.toMillis?.() || null,
      };
    });

    return res.status(200).json({ emails });
  } catch (err) {
    functions.logger.error("user-emails error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok" }));

exports.api = functions.https.onRequest(app);
