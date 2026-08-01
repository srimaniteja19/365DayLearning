/* global importScripts, normalizeBookmarkUrl, detectBookmarkKind, defaultTitleForUrl, createBookmarkId */

importScripts("lib/bookmarks.js");

const PRODUCTION_API_BASE = "https://refrainly.dev";

async function getApiBase(tab) {
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(["refrainlyApiBase"], (result) => {
      resolve(result?.refrainlyApiBase ? result.refrainlyApiBase.replace(/\/+$/, "") : null);
    });
  });

  if (stored) return stored;

  const rawUrl = tab?.url || "";
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname.includes("refrainly")) {
        return u.origin;
      }
    } catch {
      /* ignore */
    }
  }

  return PRODUCTION_API_BASE;
}

function flashBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, 3000);
}

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-to-refrainly-bookmark") return;

  const rawUrl = info.linkUrl || info.pageUrl || tab?.url || "";
  const normUrl = normalizeBookmarkUrl(rawUrl);
  if (!normUrl) {
    flashBadge("ERR", "#ef4444");
    return;
  }

  const apiBase = await getApiBase(tab);
  const kind = detectBookmarkKind(normUrl);
  let title = tab?.title || defaultTitleForUrl(normUrl);
  let preview = null;

  // Try fetching preview
  try {
    const res = await fetch(`${apiBase}/api/bookmarks/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normUrl }),
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.preview) {
        preview = data.preview;
        if (data.preview.title) title = data.preview.title;
      }
    }
  } catch {
    /* Ignore preview failure and use fallback */
  }

  const item = {
    id: createBookmarkId(),
    url: normUrl,
    kind,
    title,
    preview: preview || undefined,
    createdAt: Date.now(),
  };

  try {
    const res = await fetch(`${apiBase}/api/bookmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item }),
      credentials: "include",
    });

    if (!res.ok) {
      flashBadge("ERR", "#ef4444");
      return;
    }

    flashBadge("SAVED", "#22c55e");
  } catch (err) {
    console.error("Context menu save failed", err);
    flashBadge("ERR", "#ef4444");
  }
});
