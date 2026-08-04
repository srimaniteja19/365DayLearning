import type {
  BookmarkItem,
  BookmarkKind,
  BookmarkPreview,
  BookmarksList,
} from "@/lib/types";

export function createBookmarkId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Normalize pasted text into an absolute http(s) URL, or null. */
export function normalizeBookmarkUrl(raw: string): string | null {
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

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function extractYoutubeId(url: string): string | null {
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

export function extractVimeoId(url: string): string | null {
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

export function detectBookmarkKind(url: string): BookmarkKind {
  if (!url || typeof url !== "string") return "note";
  const host = hostnameOf(url).toLowerCase();
  if (!host) return "note";
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

/** Instant client-side preview seed before the network enrich finishes. */
export function seedPreviewFromUrl(url: string): BookmarkPreview {
  const yt = extractYoutubeId(url);
  if (yt) {
    return {
      embedId: yt,
      embedProvider: "youtube",
      image: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      siteName: "YouTube",
      title: "YouTube video",
      fetchedAt: Date.now(),
    };
  }
  const vim = extractVimeoId(url);
  if (vim) {
    return {
      embedId: vim,
      embedProvider: "vimeo",
      siteName: "Vimeo",
      title: "Vimeo video",
      fetchedAt: Date.now(),
    };
  }
  const host = hostnameOf(url);
  return {
    siteName: host || undefined,
    favicon: host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : undefined,
    fetchedAt: Date.now(),
  };
}

export function defaultTitleForUrl(url: string): string {
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

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
}

export function vimeoEmbedUrl(id: string): string {
  return `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
}

export function sanitizeBookmarks(raw: unknown): BookmarksList {
  if (!Array.isArray(raw)) return [];
  const out: BookmarkItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const rawUrl = typeof e.url === "string" ? e.url.trim() : "";
    const normalizedUrl = normalizeBookmarkUrl(rawUrl);
    const kindRaw =
      typeof e.kind === "string"
        ? e.kind
        : normalizedUrl
          ? detectBookmarkKind(normalizedUrl)
          : rawUrl
            ? "link"
            : "note";

    // If an explicit non-empty URL string was supplied that fails URL normalization,
    // and kind is not explicitly "note", skip it (it's a broken URL entry, not a note slip).
    if (rawUrl && !normalizedUrl && kindRaw !== "note") continue;

    const hasNoteOrTitle = (typeof e.note === "string" && !!e.note.trim()) || (typeof e.title === "string" && !!e.title.trim());
    const isNoteKind = kindRaw === "note" || (!rawUrl && hasNoteOrTitle);

    if (!normalizedUrl && !isNoteKind) continue;

    const url = normalizedUrl || (typeof e.url === "string" ? e.url.trim() : "");
    const id = typeof e.id === "string" && e.id ? e.id : createBookmarkId();
    if (seen.has(id)) continue;
    seen.add(id);

    const kind: BookmarkKind = (
      ["youtube", "vimeo", "article", "repo", "doc", "link", "note"] as BookmarkKind[]
    ).includes(kindRaw as BookmarkKind)
      ? (kindRaw as BookmarkKind)
      : isNoteKind
        ? "note"
        : detectBookmarkKind(url);

    const title =
      typeof e.title === "string" && e.title.trim()
        ? e.title.trim().slice(0, 200)
        : url
          ? defaultTitleForUrl(url)
          : (typeof e.note === "string" && e.note.trim() ? e.note.trim().split("\n")[0].slice(0, 60) : "Note");

    const note = typeof e.note === "string" && e.note.trim() ? e.note.slice(0, 4000) : undefined;
    const insight =
      typeof e.insight === "string" && e.insight.trim() ? e.insight.slice(0, 4000) : undefined;
    const tags = Array.isArray(e.tags)
      ? e.tags
          .filter((t): t is string => typeof t === "string" && !!t.trim())
          .map((t) => t.trim().slice(0, 32))
          .slice(0, 8)
      : undefined;
    const preview = sanitizePreview(e.preview);
    out.push({
      id,
      url,
      kind,
      title,
      note,
      tags: tags?.length ? tags : undefined,
      favorite: e.favorite === true,
      preview,
      insight,
      createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
    });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

function sanitizePreview(raw: unknown): BookmarkPreview | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const p = raw as Record<string, unknown>;
  const preview: BookmarkPreview = {};
  if (typeof p.title === "string" && p.title.trim()) preview.title = p.title.trim().slice(0, 300);
  if (typeof p.description === "string" && p.description.trim()) {
    preview.description = p.description.trim().slice(0, 800);
  }
  if (typeof p.image === "string" && /^https?:\/\//i.test(p.image)) {
    preview.image = p.image.slice(0, 2000);
  }
  if (typeof p.siteName === "string" && p.siteName.trim()) {
    preview.siteName = p.siteName.trim().slice(0, 120);
  }
  if (typeof p.favicon === "string" && /^https?:\/\//i.test(p.favicon)) {
    preview.favicon = p.favicon.slice(0, 2000);
  }
  if (typeof p.embedId === "string" && /^[\w-]{3,}$/.test(p.embedId)) {
    preview.embedId = p.embedId;
  }
  if (p.embedProvider === "youtube" || p.embedProvider === "vimeo") {
    preview.embedProvider = p.embedProvider;
  }
  if (typeof p.fetchedAt === "number") preview.fetchedAt = p.fetchedAt;
  return Object.keys(preview).length ? preview : undefined;
}

const MAX_TAGS = 8;

/** Add a user tag, trimmed/capped to match sanitizeBookmarks' limits; case-insensitive dedupe. */
export function addBookmarkTag(tags: string[] | undefined, raw: string): string[] | undefined {
  const tag = raw.trim().slice(0, 32);
  if (!tag) return tags;
  const existing = tags || [];
  if (existing.length >= MAX_TAGS) return existing;
  if (existing.some((t) => t.toLowerCase() === tag.toLowerCase())) return existing;
  return [...existing, tag];
}

export function removeBookmarkTag(tags: string[] | undefined, tag: string): string[] | undefined {
  const next = (tags || []).filter((t) => t !== tag);
  return next.length ? next : undefined;
}

type PreviewResponse = { url: string; kind: BookmarkKind; preview: BookmarkPreview; warning?: string };

const PREVIEW_CONCURRENCY = 4;
const previewCache = new Map<string, Promise<PreviewResponse>>();
const previewQueue: Array<() => void> = [];
let previewActive = 0;

function runNextPreview() {
  if (previewActive >= PREVIEW_CONCURRENCY) return;
  const job = previewQueue.shift();
  if (!job) return;
  previewActive++;
  job();
}

async function rawFetchPreview(url: string): Promise<PreviewResponse> {
  const res = await fetch("/api/bookmarks/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Preview failed");
  return data as PreviewResponse;
}

/**
 * Concurrency-limited, de-duped preview fetch. A board can mount many link
 * previews at once (every linked slip on Field notes, a fresh Bookmarks pull) —
 * firing them all in parallel used to blow through the API's per-user rate
 * limit in one burst. This coalesces repeat requests for the same URL and
 * paces the rest a few at a time instead.
 */
export function fetchPreviewQueued(url: string): Promise<PreviewResponse> {
  const existing = previewCache.get(url);
  if (existing) return existing;

  const promise = new Promise<PreviewResponse>((resolve, reject) => {
    previewQueue.push(() => {
      rawFetchPreview(url).then(resolve, reject).finally(() => {
        previewActive--;
        runNextPreview();
      });
    });
    runNextPreview();
  });

  previewCache.set(url, promise);
  // Drop failures so a later explicit retry (e.g. manual refresh) can go again.
  promise.catch(() => previewCache.delete(url));
  return promise;
}

export function mergeBookmarks(a: BookmarksList, b: BookmarksList): BookmarksList {
  const map = new Map<string, BookmarkItem>();
  for (const item of a || []) map.set(item.id, item);
  for (const item of b || []) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()].sort((x, y) => y.createdAt - x.createdAt);
}

/** Merge remote OG fields onto an existing bookmark without wiping local edits. */
export function applyPreviewToBookmark(
  item: BookmarkItem,
  preview: BookmarkPreview,
  opts?: { overwriteTitle?: boolean },
): BookmarkItem {
  const nextPreview: BookmarkPreview = { ...(item.preview || {}), ...preview, fetchedAt: Date.now() };
  const remoteTitle = preview.title?.trim();
  const shouldTitle =
    opts?.overwriteTitle ||
    !item.title ||
    item.title === defaultTitleForUrl(item.url) ||
    /^YouTube · /.test(item.title) ||
    item.title === "YouTube video" ||
    item.title === "Vimeo video";
  return {
    ...item,
    title: shouldTitle && remoteTitle ? remoteTitle.slice(0, 200) : item.title,
    kind:
      nextPreview.embedProvider === "youtube"
        ? "youtube"
        : nextPreview.embedProvider === "vimeo"
          ? "vimeo"
          : item.kind === "link" && preview.siteName
            ? detectBookmarkKind(item.url) === "link"
              ? "article"
              : item.kind
            : item.kind,
    preview: nextPreview,
  };
}
