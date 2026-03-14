// lib/firebase.ts
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
  Firestore,
  Timestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";

// ─── Config ───────────────────────────────────────────────────────────────────
// Replace with your Firebase project config from the Firebase Console
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Singleton init
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== "undefined") {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db };

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserDoc {
  uid: string;
  email: string;
  plan: "free" | "pro";
  createdAt: Timestamp;
}

export interface EmailDoc {
  id: string;
  userId: string;
  subject: string;
  sentAt: Timestamp;
  recipient: string;
  openCount: number;
  clickCount: number;
  lastOpenedAt?: Timestamp;
}

export interface OpenDoc {
  id: string;
  emailId: string;
  timestamp: Timestamp;
  ip: string;
  userAgent: string;
}

export interface ClickDoc {
  id: string;
  emailId: string;
  timestamp: Timestamp;
  url: string;
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(result.user);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ─── User Doc ─────────────────────────────────────────────────────────────────
export async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? "",
      plan: "free",
      createdAt: serverTimestamp(),
    } satisfies Omit<UserDoc, "createdAt"> & { createdAt: unknown });
  }
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

// ─── Emails ───────────────────────────────────────────────────────────────────
export async function getEmails(userId: string, pageLimit = 50): Promise<EmailDoc[]> {
  const q = query(
    collection(db, "emails"),
    where("userId", "==", userId),
    orderBy("sentAt", "desc"),
    limit(pageLimit)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => d.data() as EmailDoc);
}

export async function getEmail(emailId: string): Promise<EmailDoc | null> {
  const snap = await getDoc(doc(db, "emails", emailId));
  return snap.exists() ? (snap.data() as EmailDoc) : null;
}

// ─── Opens & Clicks ───────────────────────────────────────────────────────────
export async function getOpens(emailId: string): Promise<OpenDoc[]> {
  const q = query(
    collection(db, "opens"),
    where("emailId", "==", emailId),
    orderBy("timestamp", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => d.data() as OpenDoc);
}

export async function getClicks(emailId: string): Promise<ClickDoc[]> {
  const q = query(
    collection(db, "clicks"),
    where("emailId", "==", emailId),
    orderBy("timestamp", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => d.data() as ClickDoc);
}

// ─── Plan Limits ──────────────────────────────────────────────────────────────
const PLAN_LIMITS = { free: 50, pro: Infinity } as const;

export function checkPlanLimit(plan: "free" | "pro", currentCount: number): {
  allowed: boolean;
  remaining: number;
  limit: number;
} {
  const lim = PLAN_LIMITS[plan];
  return {
    allowed: currentCount < lim,
    remaining: lim === Infinity ? Infinity : Math.max(0, lim - currentCount),
    limit: lim,
  };
}

// ─── Extension Token Bridge ───────────────────────────────────────────────────
export async function syncTokenToExtension(user: User): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const token = await user.getIdToken(true);
    window.postMessage(
      {
        type: "SET_TOKEN",
        token,
        userId: user.uid,
        userEmail: user.email,
      },
      window.location.origin
    );
    console.log("[MailTrack] Token sent via postMessage");
  } catch {
    // Silent fail
  }
}