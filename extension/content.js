// content.js — Injected into https://mail.google.com/*
(function () {
  "use strict";

  const API_BASE = "https://us-central1-mailtracker-609a4.cloudfunctions.net/api";

  function generateUUID() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  const trackedComposes = new WeakMap();
  let currentUserId = null;
  let isAuthenticated = false;
  let trackingEnabled = true;

  // ─── AUTH ──────────────────────────────────────────────────────────────────

  async function checkAuth() {
    return new Promise((resolve) => {
      if (!chrome.runtime?.id) { resolve({ isAuthenticated: false }); return; }
      chrome.runtime.sendMessage({ type: "GET_AUTH" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve({ isAuthenticated: false, userId: null }); return;
        }
        currentUserId = response.userId;
        isAuthenticated = response.isAuthenticated;
        resolve(response);
      });
    });
  }

  // ─── TOGGLE STATE ──────────────────────────────────────────────────────────

  function loadToggleState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["trackingEnabled"], (result) => {
        trackingEnabled = result.trackingEnabled !== false;
        resolve(trackingEnabled);
      });
    });
  }

  function saveToggleState(enabled) {
    chrome.storage.local.set({ trackingEnabled: enabled });
  }

  // ─── TOOLBAR TOGGLE INJECTION ──────────────────────────────────────────────
  // Settings = DIV.FI, parent = div.gb_Sd.gb_1d.gb_Le.gb_Ve.gb_1e

  function injectTrackingToggle() {
    if (document.getElementById("mt-tracking-toggle")) return true;

    const settingsBtn = document.querySelector('div.FI[data-tooltip]');
    if (!settingsBtn) return false;

    const toolbar = settingsBtn.parentNode;
    if (!toolbar) return false;

    const container = document.createElement("div");
    container.id = "mt-tracking-toggle";
    container.setAttribute("data-mt", "1");
    container.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 0 10px !important;
      height: 40px !important;
      cursor: pointer !important;
      user-select: none !important;
      vertical-align: middle !important;
      flex-shrink: 0 !important;
    `;

    const label = document.createElement("span");
    label.id = "mt-toggle-label";
    label.textContent = "Tracking";
    label.style.cssText = `
      font-size: 13px !important;
      font-weight: 500 !important;
      font-family: 'Google Sans', Roboto, Arial, sans-serif !important;
      color: ${trackingEnabled ? '#1a73e8' : '#5f6368'} !important;
      transition: color 0.2s !important;
    `;

    const pill = document.createElement("div");
    pill.id = "mt-toggle-pill";
    pill.style.cssText = `
      position: relative !important;
      width: 32px !important;
      height: 16px !important;
      border-radius: 8px !important;
      background: ${trackingEnabled ? '#1a73e8' : '#bdc1c6'} !important;
      transition: background 0.2s !important;
      flex-shrink: 0 !important;
    `;

    const knob = document.createElement("div");
    knob.id = "mt-toggle-knob";
    knob.style.cssText = `
      position: absolute !important;
      top: 2px !important;
      left: ${trackingEnabled ? '16px' : '2px'} !important;
      width: 12px !important;
      height: 12px !important;
      border-radius: 50% !important;
      background: white !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.4) !important;
      transition: left 0.2s !important;
    `;

    pill.appendChild(knob);
    container.appendChild(label);
    container.appendChild(pill);

    container.addEventListener("click", (e) => {
      e.stopPropagation();
      trackingEnabled = !trackingEnabled;
      saveToggleState(trackingEnabled);
      pill.style.background = trackingEnabled ? '#1a73e8' : '#bdc1c6';
      knob.style.left = trackingEnabled ? '16px' : '2px';
      label.style.color = trackingEnabled ? '#1a73e8' : '#5f6368';
      console.log("[MailTrack] Tracking", trackingEnabled ? "ON" : "OFF");
    });

    toolbar.insertBefore(container, settingsBtn);
    console.log("[MailTrack] Toggle injected ✓");
    return true;
  }

  // ─── SENT FOLDER DETECTION ────────────────────────────────────────────────

  function isInSentFolder() {
    if (/[#/]sent\b/i.test(window.location.hash)) return true;
    const navLinks = document.querySelectorAll('.aim a');
    for (const a of navLinks) {
      if (!(a.getAttribute('href') || '').includes('#sent')) continue;
      const item = a.closest('.aim');
      if (item?.querySelector('.TO.nZ')) return true;
    }
    return false;
  }

  // ─── TRACKED EMAILS CACHE ─────────────────────────────────────────────────

  let emailsCache = null;
  let emailsCacheTime = 0;
  const CACHE_TTL = 30000;

  function normalizeSubject(subject) {
    return (subject || '')
      .replace(/^(re|fw|fwd|odg|odgovor|prosle[dđ]i|vids|sv|aw|ref|odsl):\s*/gi, '')
      .toLowerCase()
      .trim();
  }

  async function getTrackedEmails() {
    const now = Date.now();
    const forceRefresh = !emailsCache || (now - emailsCacheTime) >= CACHE_TTL;
    if (emailsCache && !forceRefresh) return emailsCache;
    if (!isAuthenticated || !currentUserId) return {};

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "GET_TRACKED_EMAILS", userId: currentUserId, force: forceRefresh },
        (response) => {
          if (chrome.runtime.lastError || !response?.emails) { resolve({}); return; }
          const map = {};
          for (const email of response.emails) {
            const key = normalizeSubject(email.subject || "");
            if (!map[key]) map[key] = [];
            map[key].push(email);
          }
          emailsCache = map;
          emailsCacheTime = now;
          console.log("[MailTrack] Loaded", response.emails.length, "tracked emails, keys:", Object.keys(map));
          resolve(map);
        }
      );
    });
  }

  // ─── STATUS BADGE ─────────────────────────────────────────────────────────

  function createStatusBadge(email) {
    const badge = document.createElement("span");
    badge.className = "mt-status-badge";

    const isOpened = (email?.openCount || 0) > 0;
    const openCount = email?.openCount || 0;

    badge.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      padding: 1px 6px !important;
      border-radius: 10px !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      font-family: 'Google Sans', Roboto, Arial, sans-serif !important;
      vertical-align: middle !important;
      flex-shrink: 0 !important;
      white-space: nowrap !important;
      background: ${isOpened ? '#e6f4ea' : '#f1f3f4'} !important;
      color: ${isOpened ? '#137333' : '#5f6368'} !important;
      border: 1px solid ${isOpened ? '#ceead6' : '#dadce0'} !important;
      margin: 0 4px !important;
      cursor: default !important;
      line-height: 1 !important;
      position: relative !important;
      z-index: 1 !important;
    `;

    const dot = document.createElement("span");
    dot.style.cssText = `
      width: 5px !important; height: 5px !important;
      border-radius: 50% !important;
      background: ${isOpened ? '#34a853' : '#9aa0a6'} !important;
      flex-shrink: 0 !important;
      display: inline-block !important;
    `;

    const text = document.createElement("span");
    text.textContent = isOpened
      ? (openCount > 1 ? `Opened ×${openCount}` : "Opened")
      : "Not opened";

    badge.appendChild(dot);
    badge.appendChild(text);

    if (isOpened && email?.openedAt) {
      badge.title = `First opened: ${new Date(email.openedAt).toLocaleString()}`;
    }
    return badge;
  }

  async function annotateEmailRows() {
    if (!isAuthenticated) return;
    if (!isInSentFolder()) return;

    const emailsBySubject = await getTrackedEmails();
    if (Object.keys(emailsBySubject).length === 0) return;

    const rows = document.querySelectorAll('tr.zA');
    let annotated = 0;

    rows.forEach(row => {
      // Skip if already has a badge
      if (row.querySelector('.mt-status-badge')) return;

      // Get subject — span.bog is the subject text node in Gmail list rows
      const subjectEl = row.querySelector('span.bog') || row.querySelector('.y6 > span');
      const rawSubject = subjectEl?.textContent?.trim() || '';
      if (!rawSubject) return;

      const key = normalizeSubject(rawSubject);
      const matches = emailsBySubject[key];
      if (!matches) return;

      const badge = createStatusBadge(matches[0]);

      // td.yX (sender cell) has overflow:hidden and is too narrow — use subject cell instead
      // td.a4W > div.xS > div.xT > div.y6 (subject) + span.y2 (snippet)
      // Insert badge inside div.xT, before div.y6
      const subjectCell = row.querySelector('td.a4W');
      if (subjectCell) {
        const xT = subjectCell.querySelector('div.xT');
        const y6 = subjectCell.querySelector('div.y6');
        if (xT && y6) {
          xT.insertBefore(badge, y6);
        } else if (xT) {
          xT.prepend(badge);
        } else {
          subjectCell.prepend(badge);
        }
        annotated++;
        return;
      }

      subjectEl?.parentElement?.insertBefore(badge, subjectEl);
      annotated++;
    });

    if (annotated > 0) console.log("[MailTrack] Added", annotated, "badges");
  }

  // ─── COMPOSE ──────────────────────────────────────────────────────────────

  function extractComposeData(composeEl) {
    const subjectInput =
      composeEl.querySelector('input[name="subjectbox"]') ||
      composeEl.querySelector('input[g_editable="true"]') ||
      composeEl.querySelector('input[type="text"]');
    const subject = subjectInput?.value?.trim() || "(no subject)";

    const recipientEl =
      composeEl.querySelector('[email]') ||
      composeEl.querySelector('.vR span[email]') ||
      composeEl.querySelector('.vO span[email]');
    const recipient = recipientEl?.getAttribute("email") || "unknown@recipient.com";

    const bodyEl =
      composeEl.querySelector('div[contenteditable="true"][role="textbox"]') ||
      composeEl.querySelector('div[contenteditable="true"][g_editable="true"]') ||
      composeEl.querySelector('div[contenteditable="true"]');

    return { subject, recipient, bodyEl };
  }

  function injectTrackingPixel(bodyEl, emailId) {
    if (!bodyEl || bodyEl.querySelector(`[data-mt-id="${emailId}"]`)) return false;
    const img = document.createElement("img");
    img.src = `${API_BASE}/pixel?id=${encodeURIComponent(emailId)}`;
    img.dataset.mtId = emailId;
    img.width = 1;
    img.height = 1;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.style.cssText = "width:1px!important;height:1px!important;opacity:0!important;position:absolute!important;pointer-events:none!important;border:0!important;";
    bodyEl.appendChild(img);
    return true;
  }

  function registerEmail(payload) {
    if (!isAuthenticated) return;
    chrome.runtime.sendMessage({
      type: "REGISTER_EMAIL",
      payload: { ...payload, userId: currentUserId }
    }, (res) => {
      if (res?.success) { emailsCache = null; console.log("[MailTrack] Registered:", payload.emailId); }
    });
  }

  function attachToCompose(composeEl) {
    if (trackedComposes.has(composeEl)) return;
    trackedComposes.set(composeEl, { emailId: generateUUID(), sent: false });
  }

  function handleSend(composeEl) {
    if (!trackingEnabled) return;
    const state = trackedComposes.get(composeEl);
    if (!state || state.sent) return;
    const { subject, recipient, bodyEl } = extractComposeData(composeEl);
    if (injectTrackingPixel(bodyEl, state.emailId)) {
      state.sent = true;
      setTimeout(() => registerEmail({ emailId: state.emailId, subject, recipient }), 500);
    }
  }

  function initGlobalSendListener() {
    document.addEventListener("click", (e) => {
      const sendBtn = e.target.closest('[role="button"].aoO');
      if (!sendBtn) return;
      const composeEl = document.querySelector('.AD[style*="position"]') || document.querySelector('[role="dialog"].nH');
      if (!composeEl) return;
      if (!trackedComposes.has(composeEl)) attachToCompose(composeEl);
      handleSend(composeEl);
    }, { capture: true });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const composeEl = document.querySelector('.AD[style*="position"]') || document.querySelector('[role="dialog"].nH');
        if (!composeEl) return;
        if (!trackedComposes.has(composeEl)) attachToCompose(composeEl);
        handleSend(composeEl);
      }
    }, { capture: true });
  }

  // ─── OBSERVER & INIT ──────────────────────────────────────────────────────

  let toggleInjected = false;
  let annotateTimer = null;
  let toggleRetryTimer = null;

  const observer = new MutationObserver((mutations) => {
    // Only re-annotate if rows changed, not on every tiny mutation
    const rowsChanged = mutations.some(m =>
      [...m.addedNodes].some(n => n.nodeName === 'TR' || n.querySelector?.('tr.zA'))
    );

    if (!toggleInjected) toggleInjected = injectTrackingToggle();
    document.querySelectorAll('[role="dialog"], .AD').forEach(el => attachToCompose(el));

    if (rowsChanged) {
      clearTimeout(annotateTimer);
      annotateTimer = setTimeout(annotateEmailRows, 500);
    }
  });

  async function init() {
    await checkAuth();
    await loadToggleState();
    console.log("[MailTrack]", isAuthenticated ? "Authenticated ✓" : "Not authenticated");

    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('[role="dialog"], .AD').forEach(el => attachToCompose(el));
    initGlobalSendListener();

    toggleRetryTimer = setInterval(() => {
      if (injectTrackingToggle()) { toggleInjected = true; clearInterval(toggleRetryTimer); }
    }, 1000);
    setTimeout(() => clearInterval(toggleRetryTimer), 30000);

    // Annotate on load and on hash change (folder navigation)
    setTimeout(annotateEmailRows, 3000);
    window.addEventListener('hashchange', () => {
      emailsCache = null; // force refresh on folder change
      setTimeout(annotateEmailRows, 1000);
    });
  }

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);

})();
