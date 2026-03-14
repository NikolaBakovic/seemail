# MailTrack MVP — Email Open & Click Tracking for Gmail

A complete SaaS email tracking system similar to Mailtrack, built with:
- **Firebase Cloud Functions** (Node.js/Express) — tracking pixel + click redirect
- **Firestore** — real-time database
- **Next.js 14** (App Router) — dashboard frontend
- **Chrome Extension** (Manifest V3) — Gmail integration

---

## Architecture Overview

```
Gmail Compose → Chrome Extension injects pixel → User sends email
                                                         ↓
                                              Recipient opens email
                                                         ↓
                                        <img src="cloud-function/pixel?id=XYZ">
                                                         ↓
                                        Firebase Cloud Function logs open to Firestore
                                                         ↓
                                        Dashboard reads Firestore (real-time)
```

---

## Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project with **Blaze (pay-as-you-go) plan** (required for Cloud Functions)
- Google Chrome

---

## Step 1 — Firebase Project Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.

2. Enable the following services:
   - **Authentication** → Sign-in method → Google → Enable
   - **Firestore Database** → Create in **production mode**
   - **Functions** → (requires Blaze plan)
   - **Hosting** → Enable

3. Note your **Project ID** (you'll need it throughout setup).

4. Login via CLI:
   ```bash
   firebase login
   ```

5. Set your project in `.firebaserc`:
   ```json
   { "projects": { "default": "YOUR_PROJECT_ID" } }
   ```

---

## Step 2 — Deploy Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,firestore
```

After deploy, note the function URL — it will look like:
```
https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api
```

### Update the API URL in two places:
- `extension/manifest.json` → `host_permissions` array
- `extension/background.js` → `API_BASE` constant
- `extension/content.js` → `API_BASE` constant
- `extension/popup.js` → `DASHBOARD_URL` constant

---

## Step 3 — Deploy the Dashboard (Next.js)

1. Add a Web App to your Firebase project (Console → Project Settings → Add App → Web).

2. Copy the config values into `dashboard/.env.local`:
   ```bash
   cp dashboard/.env.example dashboard/.env.local
   # Fill in your Firebase config values
   ```

3. Build and export:
   ```bash
   cd dashboard
   npm install
   npm run build    # outputs to dashboard/out/
   ```

4. Deploy to Firebase Hosting:
   ```bash
   cd ..
   firebase deploy --only hosting
   ```

Your dashboard will be live at `https://YOUR_PROJECT_ID.web.app`

---

## Step 4 — Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `extension/` folder from this project
5. The MailTrack icon will appear in your Chrome toolbar

### Create extension icons
The extension requires icon files at `extension/icons/icon16.png`, `icon48.png`, and `icon128.png`.
You can generate simple colored square PNGs using any image editor, or use a free tool like [favicon.io](https://favicon.io).

---

## Step 5 — Connect Extension to Dashboard

After deploying, the auth flow works as follows:

1. User opens the dashboard at `https://YOUR_PROJECT_ID.web.app`
2. User signs in with Google
3. The dashboard calls `syncTokenToExtension()` which posts the Firebase ID token via `window.postMessage`
4. The Chrome extension's content script relays it to the background service worker via `chrome.runtime.sendMessage`
5. The background stores the token in `chrome.storage.local` (valid for ~55 minutes)
6. Token auto-refreshes on next sign-in

> **For automatic token refresh**, users should visit the dashboard periodically, or you can implement `chrome.alarms` to periodically refresh the token.

---

## Step 6 — Test the Full Flow

1. Open **Gmail** in Chrome
2. Compose a new email
3. Send it (the extension injects a tracking pixel before send)
4. Check your **dashboard** — the email should appear
5. Have the recipient open the email — the open should appear in the detail view

---

## Firestore Security Rules

Rules are in `firestore.rules`. Key points:
- Users can only read their own data
- The `opens` and `clicks` collections are **write-protected** (only Cloud Functions via Admin SDK can write)
- Deploy rules with: `firebase deploy --only firestore:rules`

---

## Local Development

### Cloud Functions (with emulators):
```bash
firebase emulators:start
# Functions: http://localhost:5001
# Firestore: http://localhost:8080
# Hosting: http://localhost:5000
# Emulator UI: http://localhost:4000
```

### Dashboard:
```bash
cd dashboard
npm run dev
# → http://localhost:3000
```

When developing locally, update `API_BASE` in `content.js` and `background.js` to point to the emulator:
```js
const API_BASE = "http://localhost:5001/YOUR_PROJECT_ID/us-central1/api";
```

---

## File Structure

```
mailtrack-mvp/
├── firebase.json              # Firebase project config
├── firestore.rules            # Firestore security rules
├── firestore.indexes.json     # Composite indexes
├── .firebaserc                # Project alias
│
├── functions/
│   ├── index.js               # Express app: /pixel, /click, /email endpoints
│   └── package.json
│
├── extension/
│   ├── manifest.json          # MV3 manifest
│   ├── background.js          # Service worker: auth, message router
│   ├── content.js             # Gmail DOM injection & send interception
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup logic
│   └── icons/                 # Add icon16.png, icon48.png, icon128.png here
│
└── dashboard/
    ├── app/
    │   ├── layout.tsx          # Root layout + AuthProvider
    │   ├── page.tsx            # Root redirect
    │   ├── globals.css         # Global styles + custom fonts
    │   ├── login/page.tsx      # Google sign-in
    │   └── dashboard/
    │       ├── page.tsx        # Email list + stats
    │       └── email/[id]/
    │           └── page.tsx    # Email detail + timeline
    ├── components/
    │   ├── Navbar.tsx
    │   └── StatCard.tsx
    ├── lib/
    │   ├── firebase.ts         # Firebase init, Firestore helpers, types
    │   ├── AuthContext.tsx     # React auth context
    │   └── withAuth.tsx        # Route protection hook
    ├── .env.example            # Environment variable template
    ├── next.config.js
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## Plan Limits (Free vs Pro)

The free plan limit (50 emails) is enforced in two places:
1. **Cloud Function** (`/email` endpoint) — server-side check before writing to Firestore
2. **Dashboard UI** — progress bar showing usage

To implement real billing, integrate Stripe and update the `plan` field in the `users` collection via a webhook.

---

## Known Limitations & Next Steps

| Area | Current MVP | Production Improvement |
|------|-------------|----------------------|
| Auth token | Manual sync via postMessage | Use Firebase SDK directly in extension |
| Gmail DOM | Selector-based (may break on Gmail updates) | Subscribe to Gmail API push notifications |
| Real-time | Manual refresh / page load | Firestore `onSnapshot` listeners |
| Billing | Mock plan check | Stripe integration |
| Icons | Placeholder | Proper branded icons |
| Email parsing | Best-effort selectors | Gmail API for reliable data extraction |

---

## Deployment Checklist

- [ ] Firebase project created with Blaze plan
- [ ] Google Auth enabled in Firebase Console
- [ ] `.firebaserc` updated with your Project ID
- [ ] `functions/index.js` — no changes needed (uses Admin SDK default credentials)
- [ ] `extension/manifest.json` — update `host_permissions` with your Functions URL
- [ ] `extension/background.js` — update `API_BASE`
- [ ] `extension/content.js` — update `API_BASE`
- [ ] `extension/popup.js` — update `DASHBOARD_URL`
- [ ] `dashboard/.env.local` — filled with Firebase Web App config
- [ ] `firebase deploy --only functions,firestore,hosting`
- [ ] Extension loaded via `chrome://extensions` → Load unpacked
- [ ] Icons added to `extension/icons/`
