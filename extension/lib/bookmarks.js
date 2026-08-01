/**
 * Client-side bookmark normalization & kind detection helpers for Refrainly Chrome Extension.
 * Matches logic from lib/bookmarks.ts in main app.
 */

function normalizeBookmarkUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return null;
    }
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (u.pathname.startsWith("/watch")) {
        const v = u.searchParams.get("v");
        return v && /^[\w-]{6,}$/.test(v) ? v : null;
      }
      const short = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
      if (short) return short[2];
    }
    return null;
  } catch {
    return null;
  }
}

function extractVimeoId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const m = u.pathname.match(/\/(?:video\/)?(\d{6,})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function detectBookmarkKind(url) {
  const host = hostnameOf(url).toLowerCase();
  if (extractYoutubeId(url)) return "youtube";
  if (extractVimeoId(url)) return "vimeo";
  if (
    host === "github.com" ||
    host === "gitlab.com" ||
    host === "bitbucket.org" ||
    host.endsWith(".github.io")
  ) {
    return "repo";
  }
  if (
    host === "docs.google.com" ||
    host === "notion.so" ||
    host.endsWith(".notion.site") ||
    host === "medium.com" ||
    host.endsWith(".medium.com") ||
    host === "dev.to" ||
    host === "substack.com" ||
    host.endsWith(".substack.com") ||
    /\.(pdf)(\?|$)/i.test(url)
  ) {
    return "doc";
  }
  if (
    host.includes("blog") ||
    host === "news.ycombinator.com" ||
    host === "arstechnica.com" ||
    host === "theverge.com" ||
    host === "wired.com" ||
    host === "nytimes.com" ||
    host.endsWith(".nytimes.com")
  ) {
    return "article";
  }
  return "link";
}

function defaultTitleForUrl(url) {
  const host = hostnameOf(url);
  const yt = extractYoutubeId(url);
  if (yt) return `YouTube · ${yt}`;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    if (path && path !== "/") {
      const leaf = decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
      if (leaf) return leaf.replace(/[-_]+/g, " ").slice(0, 80);
    }
  } catch {
    /* ignore */
  }
  return host || "Untitled clip";
}

function createBookmarkId() {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLearnedId() {
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeBookmarkUrl,
    hostnameOf,
    extractYoutubeId,
    extractVimeoId,
    detectBookmarkKind,
    defaultTitleForUrl,
    createBookmarkId,
    createLearnedId,
  };
}
