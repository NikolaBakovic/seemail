// background.js — Service Worker (Manifest V3)

const API_BASE = "https://us-central1-mailtracker-609a4.cloudfunctions.net/api";

let cachedToken = null;
let tokenExpiry = 0;

// In-memory email cache shared across all messages in this SW lifecycle
let emailCache = { emails: [], fetchedAt: 0 };

// ─── TOKEN ────────────────────────────────────────────────────────────────────

async function getStoredToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  return new Promise((resolve) => {
    chrome.storage.local.get(["authToken", "authTokenExpiry"], (result) => {
      if (result.authToken && result.authTokenExpiry && Date.now() < result.authTokenExpiry) {
        cachedToken = result.authToken;
        tokenExpiry = result.authTokenExpiry;
        resolve(result.authToken);
      } else {
        resolve(null);
      }
    });
  });
}

// ─── EMAIL CACHE ──────────────────────────────────────────────────────────────

async function refreshEmailCache(force = false) {
  const CACHE_TTL = 30 * 1000; // 30 seconds
  if (!force && emailCache.fetchedAt && (Date.now() - emailCache.fetchedAt) < CACHE_TTL) return;

  const token = await getStoredToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/user-emails`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    emailCache = { emails: data.emails || [], fetchedAt: Date.now() };
    // Persist so it survives service worker restarts
    chrome.storage.local.set({ emailCache });
    console.log("[MailTrack BG] Cache refreshed:", emailCache.emails.length, "emails");
  } catch (err) {
    console.error("[MailTrack BG] Cache refresh failed:", err);
  }
}

// Restore cache from storage on SW startup (survives SW restart)
async function restoreCacheFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["emailCache"], (result) => {
      if (result.emailCache?.emails) {
        emailCache = result.emailCache;
        console.log("[MailTrack BG] Cache restored:", emailCache.emails.length, "emails");
      }
      resolve();
    });
  });
}

// ─── ALARMS — refresh cache every 5 minutes ───────────────────────────────────

chrome.alarms.create("refreshEmails", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshEmails") refreshEmailCache(true);
});

// ─── EKSTERNI LISTENER ────────────────────────────────────────────────────────

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_TOKEN") {
    const expiry = Date.now() + 55 * 60 * 1000;
    cachedToken = message.token;
    tokenExpiry = expiry;
    chrome.storage.local.set({
      authToken: message.token,
      authTokenExpiry: expiry,
      userId: message.userId,
      userEmail: message.userEmail,
    }, () => {
      updateBadge(true);
      // Immediately refresh cache for new user
      refreshEmailCache(true);
      sendResponse({ success: true });
    });
    return true;
  }
  if (message.type === "CLEAR_TOKEN") {
    cachedToken = null;
    tokenExpiry = 0;
    emailCache = { emails: [], fetchedAt: 0 };
    chrome.storage.local.remove(["authToken", "authTokenExpiry", "userId", "userEmail", "emailCache"], () => {
      updateBadge(false);
      sendResponse({ success: true });
    });
    return true;
  }
});

// ─── INTERNI LISTENER ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {

    case "REGISTER_EMAIL": {
      (async () => {
        try {
          const token = await getStoredToken();
          if (!token) { sendResponse({ success: false, error: "Not authenticated" }); return; }
          const { emailId, userId, subject, recipient } = message.payload;
          const res = await fetch(`${API_BASE}/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ emailId, userId, subject, recipient }),
          });
          const data = await res.json();
          if (res.ok) {
            updateBadge(true);
            // Add new email to cache immediately — no need to re-fetch
            emailCache.emails.unshift({
              emailId,
              subject: subject || "(no subject)",
              recipient: recipient || "unknown",
              sentAt: Date.now(),
              openCount: 0,
              clickCount: 0,
              openedAt: null,
            });
            chrome.storage.local.set({ emailCache });
            sendResponse({ success: true, data });
          } else {
            sendResponse({ success: false, error: data.error });
          }
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    // Returns from in-memory cache — zero DB reads
    case "GET_TRACKED_EMAILS": {
      (async () => {
        await refreshEmailCache(!!message.force); // only fetches if cache is stale unless forced
        sendResponse({ emails: emailCache.emails });
      })();
      return true;
    }

    // For popup — count from cache
    case "GET_EMAIL_COUNT": {
      (async () => {
        await refreshEmailCache();
        sendResponse({ count: emailCache.emails.length });
      })();
      return true;
    }

    case "GET_AUTH": {
      chrome.storage.local.get(["userId", "authToken", "authTokenExpiry", "userEmail"], (result) => {
        const isValid = result.authToken && result.authTokenExpiry && Date.now() < result.authTokenExpiry;
        sendResponse({
          userId: isValid ? result.userId : null,
          userEmail: isValid ? result.userEmail : null,
          isAuthenticated: !!isValid,
        });
      });
      return true;
    }

    case "SET_TOKEN": {
      const expiry = Date.now() + 55 * 60 * 1000;
      cachedToken = message.token;
      tokenExpiry = expiry;
      chrome.storage.local.set({
        authToken: message.token, authTokenExpiry: expiry,
        userId: message.userId, userEmail: message.userEmail,
      }, () => {
        updateBadge(true);
        refreshEmailCache(true);
        sendResponse({ success: true });
      });
      return true;
    }

    case "CLEAR_TOKEN": {
      cachedToken = null;
      tokenExpiry = 0;
      emailCache = { emails: [], fetchedAt: 0 };
      chrome.storage.local.remove(["authToken", "authTokenExpiry", "userId", "userEmail", "emailCache"], () => {
        updateBadge(false);
        sendResponse({ success: true });
      });
      return true;
    }

    case "SET_TOKEN_RELAY": {
      const expiry = Date.now() + 55 * 60 * 1000;
      cachedToken = message.token;
      tokenExpiry = expiry;
      chrome.storage.local.set({
        authToken: message.token, authTokenExpiry: expiry, userId: message.userId,
      }, () => { updateBadge(true); sendResponse({ success: true }); });
      return true;
    }

    default:
      sendResponse({ error: "Unknown message type" });
  }
});

// ─── BADGE ────────────────────────────────────────────────────────────────────

function updateBadge(tracking) {
  chrome.action.setBadgeText({ text: tracking ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: tracking ? "#F59E0B" : "#6B7280" });
}

// ─── STARTUP ──────────────────────────────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  await restoreCacheFromStorage();
  const token = await getStoredToken();
  updateBadge(!!token);
  if (token) refreshEmailCache();
});

chrome.runtime.onInstalled.addListener(async () => {
  updateBadge(false);
  chrome.alarms.create("refreshEmails", { periodInMinutes: 5 });
  await restoreCacheFromStorage();
  console.log("MailTrack installed.");
});
