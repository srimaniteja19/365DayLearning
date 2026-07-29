import type { LearnedItem, LearnedMap } from "@/lib/types";
import {
  defaultTitleForUrl,
  extractVimeoId,
  extractYoutubeId,
  hostnameOf,
  normalizeBookmarkUrl,
} from "@/lib/bookmarks";

/** Local calendar date as `YYYY-MM-DD`. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createLearnedId(): string {
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatLearnedDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function countLearned(learned: LearnedMap | undefined | null): number {
  if (!learned) return 0;
  return Object.values(learned).reduce((n, items) => n + (items?.length || 0), 0);
}

/** Newest date first; items within a day newest first. */
export function sortedLearnedDays(
  learned: LearnedMap | undefined | null,
): Array<{ date: string; items: LearnedItem[] }> {
  if (!learned) return [];
  return Object.keys(learned)
    .filter((k) => Array.isArray(learned[k]) && learned[k].length > 0)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((date) => ({
      date,
      items: [...learned[date]].sort((a, b) => b.createdAt - a.createdAt),
    }));
}

export function sanitizeLearned(raw: unknown): LearnedMap {
  const out: LearnedMap = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(value)) continue;
    const items: LearnedItem[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const body = typeof e.body === "string" ? e.body : "";
      const title = typeof e.title === "string" ? e.title : "";
      if (!body.trim() && !title.trim()) continue;
      items.push({
        id: typeof e.id === "string" && e.id ? e.id : createLearnedId(),
        title: title.trim() || "Untitled",
        body,
        insight: typeof e.insight === "string" && e.insight.trim() ? e.insight : undefined,
        createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
      });
    }
    if (items.length) out[key] = items;
  }
  return out;
}

const BARE_URL_RE = /https?:\/\/[^\s<>'"\]]+/gi;
const MD_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;

/** Friendly label for a URL (YouTube, host, etc.). */
export function linkLabelForUrl(url: string): string {
  if (extractYoutubeId(url)) return "YouTube";
  if (extractVimeoId(url)) return "Vimeo";
  return hostnameOf(url) || defaultTitleForUrl(url) || "Link";
}

/**
 * If clipboard text is a single URL (with optional scheme), return the
 * normalized absolute URL. Otherwise null — leave paste alone.
 */
export function urlFromPaste(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  return normalizeBookmarkUrl(trimmed);
}

/** Unique http(s) URLs from notes — bare URLs and markdown links. */
export function extractUrlsFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const cleaned = String(raw || "").replace(/[.,;:!?)]+$/g, "");
    const n = normalizeBookmarkUrl(cleaned);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };

  MD_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_LINK_RE.exec(text)) !== null) add(m[2]);

  BARE_URL_RE.lastIndex = 0;
  while ((m = BARE_URL_RE.exec(text)) !== null) add(m[0]);

  return out;
}

/**
 * Insert `insert` at [start, end) in `value`, padding with spaces when needed
 * so the URL stays a discrete token.
 */
export function insertAtSelection(
  value: string,
  start: number,
  end: number,
  insert: string,
): { next: string; cursor: number } {
  const before = value.slice(0, Math.max(0, start));
  const after = value.slice(Math.max(end, start));
  const padBefore = before && !/\s$/.test(before) ? " " : "";
  const padAfter = after && !/^\s/.test(after) ? " " : "";
  const chunk = `${padBefore}${insert}${padAfter}`;
  return {
    next: before + chunk + after,
    cursor: before.length + chunk.length,
  };
}
