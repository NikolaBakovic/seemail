const DASHBOARD_URL = "https://mailtrack-mvp.vercel.app/";

async function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["userId", "authToken", "authTokenExpiry", "userEmail", "plan"],
      resolve
    );
  });
}

async function init() {
  const state = await loadState();
  const isValid =
    state.authToken &&
    state.authTokenExpiry &&
    Date.now() < state.authTokenExpiry;

  const statusBadge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");
  const userEmailEl = document.getElementById("userEmail");
  const emailCountEl = document.getElementById("emailCount");
  const planLabelEl = document.getElementById("planLabel");
  const planBadgeEl = document.getElementById("planBadge");
  const authBtn = document.getElementById("authBtn");
  const signoutLink = document.getElementById("signoutLink");

  if (isValid) {
    statusBadge.className = "status-badge active";
    statusText.textContent = "Tracking active";

    if (state.userEmail) {
      userEmailEl.innerHTML = `Signed in as <span>${state.userEmail}</span>`;
    }

    emailCountEl.textContent = "…";

    const plan = state.plan || "free";
    planLabelEl.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    planBadgeEl.textContent = plan === "pro" ? "Pro ✦" : "Free";
    planBadgeEl.style.color = plan === "pro" ? "#818CF8" : "#F59E0B";

    authBtn.textContent = "✓ Connected";
    authBtn.className = "btn-secondary";
    authBtn.disabled = true;
    signoutLink.style.display = "block";

    // Get count from background cache — no direct API call
    chrome.runtime.sendMessage({ type: "GET_EMAIL_COUNT" }, (res) => {
      emailCountEl.textContent = res?.count ?? "–";
    });

  } else {
    statusBadge.className = "status-badge inactive";
    statusText.textContent = "Not connected";
    userEmailEl.textContent = "Sign in to start tracking";
    emailCountEl.textContent = "–";
    planLabelEl.textContent = "–";
  }
}

document.getElementById("dashboardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
  window.close();
});

document.getElementById("authBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: `${DASHBOARD_URL}/login` });
  window.close();
});

document.getElementById("signoutLink").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" }, () => init());
});

init();