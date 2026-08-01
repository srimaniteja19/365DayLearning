/* global normalizeBookmarkUrl, detectBookmarkKind, createBookmarkId, createLearnedId */

const PRODUCTION_API_BASE = "https://refrainly.dev";
const LOCAL_API_BASE = "http://localhost:3000";

let state = {
  apiBase: PRODUCTION_API_BASE,
  activeTabUrl: "",
  activeTabTitle: "",
  detectedKind: "link",
  preview: null,
  selectedLearnedTag: "tip",
  isAuthenticated: false,
};

// DOM Elements
const hostLabel = document.getElementById("host-label");
const settingsToggleBtn = document.getElementById("settings-toggle-btn");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const settingsView = document.getElementById("settings-view");
const mainView = document.getElementById("main-view");
const authView = document.getElementById("auth-view");
const apiBaseInput = document.getElementById("api-base-input");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const signinBtn = document.getElementById("signin-btn");

// Tabs
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

// Bookmark Form Elements
const bmForm = document.getElementById("bookmark-form");
const bmUrlInput = document.getElementById("bm-url");
const bmTitleInput = document.getElementById("bm-title");
const bmKindBadge = document.getElementById("bm-kind-badge");
const bmNoteInput = document.getElementById("bm-note");
const bmTagsInput = document.getElementById("bm-tags");
const bmSubmitBtn = document.getElementById("bm-submit-btn");

// Learned Form Elements
const lnForm = document.getElementById("learned-form");
const lnTitleInput = document.getElementById("ln-title");
const lnUrlInput = document.getElementById("ln-url");
const lnNotesInput = document.getElementById("ln-notes");
const lnDateInput = document.getElementById("ln-date");
const lnTagSelector = document.getElementById("ln-tag-selector");
const lnSubmitBtn = document.getElementById("ln-submit-btn");

// Toast
const toast = document.getElementById("toast");
const toastIcon = document.getElementById("toast-icon");
const toastMessage = document.getElementById("toast-message");

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showToast(message, type = "success") {
  toastMessage.textContent = message;
  toastIcon.textContent = type === "success" ? "✓" : "⚠";
  toast.className = `toast ${type}`;
  setTimeout(() => {
    toast.className = "toast hidden";
  }, 4000);
}

async function loadConfig() {
  const stored = await new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["refrainlyApiBase"], (result) => {
        resolve(result?.refrainlyApiBase || null);
      });
    } else {
      resolve(null);
    }
  });

  if (stored && stored.trim()) {
    state.apiBase = stored.trim().replace(/\/+$/, "");
    return state.apiBase;
  }

  // Auto-detect from active tab URL if browsing local dev or production app instance
  if (state.activeTabUrl) {
    try {
      const u = new URL(state.activeTabUrl);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname.includes("refrainly")) {
        state.apiBase = u.origin;
        return state.apiBase;
      }
    } catch {
      /* ignore */
    }
  }

  state.apiBase = LOCAL_API_BASE;
  return state.apiBase;
}

async function saveConfig(newBase) {
  const clean = (newBase || PRODUCTION_API_BASE).trim().replace(/\/+$/, "");
  state.apiBase = clean;
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ refrainlyApiBase: clean });
  }
  updateHostDisplay();
}

function updateHostDisplay() {
  try {
    const u = new URL(state.apiBase);
    hostLabel.textContent = u.origin;
  } catch {
    hostLabel.textContent = state.apiBase;
  }
}

async function checkAuthStatus() {
  try {
    const res = await fetch(`${state.apiBase}/api/auth/session`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) {
      state.isAuthenticated = false;
      return false;
    }
    const data = await res.json();
    state.isAuthenticated = Boolean(data?.user?.id);
    return state.isAuthenticated;
  } catch {
    state.isAuthenticated = false;
    return false;
  }
}

function renderAuthView(isAuthed) {
  if (isAuthed) {
    authView.classList.add("hidden");
    mainView.classList.remove("hidden");
  } else {
    authView.classList.remove("hidden");
    mainView.classList.add("hidden");
  }
}

function updateKindBadge(kind) {
  state.detectedKind = kind;
  bmKindBadge.textContent = kind;
  bmKindBadge.className = `badge badge-${kind}`;
}

async function fetchPagePreview(url) {
  try {
    const res = await fetch(`${state.apiBase}/api/bookmarks/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

async function initTabInfo() {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    state.activeTabUrl = "https://example.com/demo-article";
    state.activeTabTitle = "Sample Article Page";
    populateForms();
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      state.activeTabUrl = tab.url || "";
      state.activeTabTitle = tab.title || "";
    }
  } catch (err) {
    console.error("Could not query current tab", err);
  }

  populateForms();

  const normUrl = normalizeBookmarkUrl(state.activeTabUrl);
  if (normUrl) {
    const previewData = await fetchPagePreview(normUrl);
    if (previewData?.preview) {
      state.preview = previewData.preview;
      if (previewData.kind) updateKindBadge(previewData.kind);
      if (previewData.preview.title && (!bmTitleInput.value || bmTitleInput.value === state.activeTabTitle)) {
        bmTitleInput.value = previewData.preview.title;
        lnTitleInput.value = previewData.preview.title;
      }
      if (previewData.preview.description && !bmNoteInput.value) {
        bmNoteInput.value = previewData.preview.description;
      }
    }
  }
}

function populateForms() {
  const normUrl = normalizeBookmarkUrl(state.activeTabUrl);
  bmUrlInput.value = normUrl || state.activeTabUrl;
  if (lnUrlInput) lnUrlInput.value = normUrl || state.activeTabUrl;

  const kind = normUrl ? detectBookmarkKind(normUrl) : "link";
  updateKindBadge(kind);

  bmTitleInput.value = state.activeTabTitle || "";
  lnTitleInput.value = state.activeTabTitle || "";

  const today = getTodayDateString();
  lnDateInput.value = today;
  lnDateInput.max = today;
}

// Event Listeners
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.getAttribute("data-tab");
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    tabPanes.forEach((pane) => {
      if (pane.id === `${tabName}-form`) {
        pane.classList.remove("hidden");
        pane.classList.add("active");
      } else {
        pane.classList.add("hidden");
        pane.classList.remove("active");
      }
    });
  });
});

lnTagSelector.addEventListener("click", (e) => {
  const target = e.target;
  if (target.classList.contains("tag-chip")) {
    const chips = lnTagSelector.querySelectorAll(".tag-chip");
    chips.forEach((c) => c.classList.remove("active"));
    target.classList.add("active");
    state.selectedLearnedTag = target.getAttribute("data-tag") || "tip";
  }
});

settingsToggleBtn.addEventListener("click", () => {
  apiBaseInput.value = state.apiBase;
  settingsView.classList.remove("hidden");
});

settingsCloseBtn.addEventListener("click", () => {
  settingsView.classList.add("hidden");
});

saveSettingsBtn.addEventListener("click", async () => {
  await saveConfig(apiBaseInput.value);
  settingsView.classList.add("hidden");
  showToast("Settings saved", "success");
  const isAuthed = await checkAuthStatus();
  renderAuthView(isAuthed);
});

signinBtn.addEventListener("click", () => {
  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.create({ url: `${state.apiBase}/` });
  } else {
    window.open(`${state.apiBase}/`, "_blank");
  }
});

// Bookmark Submit Handler
bmForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = normalizeBookmarkUrl(bmUrlInput.value);
  if (!url) {
    showToast("Invalid URL", "error");
    return;
  }

  bmSubmitBtn.disabled = true;
  bmSubmitBtn.querySelector("span").textContent = "Saving...";

  const rawTags = bmTagsInput.value.trim();
  const tags = rawTags
    ? rawTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const item = {
    id: createBookmarkId(),
    url,
    kind: state.detectedKind,
    title: bmTitleInput.value.trim() || defaultTitleForUrl(url),
    note: bmNoteInput.value.trim() || undefined,
    tags,
    preview: state.preview || undefined,
    createdAt: Date.now(),
  };

  try {
    const res = await fetch(`${state.apiBase}/api/bookmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item }),
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Save failed (${res.status})`);
    }

    notifyAppSync();
    showToast("Saved to Bookmarks!", "success");
    setTimeout(() => {
      if (typeof window !== "undefined" && window.close) window.close();
    }, 1500);
  } catch (err) {
    showToast(err.message || "Failed to save bookmark", "error");
  } finally {
    bmSubmitBtn.disabled = false;
    bmSubmitBtn.querySelector("span").textContent = "Save to Bookmarks";
  }
});

function notifyAppSync() {
  try {
    const channel = new BroadcastChannel("refrainly-sync");
    channel.postMessage({ type: "REFRAINLY_ITEM_SAVED" });
    channel.close();
  } catch {
    /* ignore */
  }
}

// Learned Submit Handler
lnForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = lnTitleInput.value.trim();
  const notes = lnNotesInput.value.trim();
  const rawUrl = lnUrlInput?.value ? lnUrlInput.value.trim() : "";
  const sourceUrl = normalizeBookmarkUrl(rawUrl);
  const dateKey = lnDateInput.value;

  if (!title && !notes && !sourceUrl) {
    showToast("Title, notes, or URL required", "error");
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    showToast("Valid date required", "error");
    return;
  }

  const today = getTodayDateString();
  if (dateKey > today) {
    showToast("Date cannot be in the future", "error");
    return;
  }

  lnSubmitBtn.disabled = true;
  lnSubmitBtn.querySelector("span").textContent = "Saving...";

  let body = notes;
  if (sourceUrl) {
    body = body ? `${body}\n\n${sourceUrl}` : sourceUrl;
  }

  const item = {
    id: createLearnedId(),
    title: title || notes.slice(0, 60) || sourceUrl || "Untitled",
    body,
    tags: [state.selectedLearnedTag],
    createdAt: Date.now(),
  };

  try {
    const res = await fetch(`${state.apiBase}/api/learned`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateKey, item }),
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Save failed (${res.status})`);
    }

    notifyAppSync();
    showToast("Saved to Learned journal!", "success");
    setTimeout(() => {
      if (typeof window !== "undefined" && window.close) window.close();
    }, 1500);
  } catch (err) {
    showToast(err.message || "Failed to save entry", "error");
  } finally {
    lnSubmitBtn.disabled = false;
    lnSubmitBtn.querySelector("span").textContent = "Save to Learned";
  }
});

// Initialize Popup
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof chrome !== "undefined" && chrome.tabs) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        state.activeTabUrl = tab.url || "";
        state.activeTabTitle = tab.title || "";
      }
    } catch (err) {
      console.error("Could not query active tab", err);
    }
  }
  await loadConfig();
  updateHostDisplay();
  const isAuthed = await checkAuthStatus();
  renderAuthView(isAuthed);
  if (isAuthed) {
    await initTabInfo();
  }
});
