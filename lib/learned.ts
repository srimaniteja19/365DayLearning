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

/** Last-7-days rollup for Field Kit digest card. */
export function buildKitWeekDigest(
  learned: LearnedMap | undefined | null,
  bookmarks: { createdAt?: number }[] | undefined | null,
  now: number = Date.now(),
) {
  const since = now - 7 * 24 * 60 * 60 * 1000;
  let slipCount = 0;
  const tagHits: Record<string, number> = {};
  const recentSlips: { date: string; title: string; id: string }[] = [];

  for (const [date, items] of Object.entries(learned || {})) {
    for (const it of items || []) {
      if ((it.createdAt || 0) < since) continue;
      slipCount += 1;
      for (const t of it.tags || []) {
        tagHits[t] = (tagHits[t] || 0) + 1;
      }
      recentSlips.push({ date, title: it.title, id: it.id });
    }
  }

  recentSlips.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const bookmarkCount = (bookmarks || []).filter((b) => (b.createdAt || 0) >= since).length;
  const topTags = Object.entries(tagHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, n]) => ({ tag, n }));

  return {
    slipCount,
    bookmarkCount,
    topTags,
    recentSlips: recentSlips.slice(0, 3),
  };
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

export const LEARNED_TAG_OPTIONS = [
  "talk",
  "paper",
  "tool",
  "tip",
  "course",
  "other",
] as const;

export type LearnedTag = (typeof LEARNED_TAG_OPTIONS)[number];

function sanitizeLearnedTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const allowed = new Set<string>(LEARNED_TAG_OPTIONS);
  const out = [...new Set(raw.map((t) => String(t || "").trim().toLowerCase()).filter((t) => allowed.has(t)))];
  return out.length ? out : undefined;
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
      const tags = sanitizeLearnedTags(e.tags);
      items.push({
        id: typeof e.id === "string" && e.id ? e.id : createLearnedId(),
        title: title.trim() || "Untitled",
        body,
        insight: typeof e.insight === "string" && e.insight.trim() ? e.insight : undefined,
        ...(tags ? { tags } : {}),
        createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
      });
    }
    if (items.length) out[key] = items;
  }
  return out;
}

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

  const md = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = md.exec(text)) !== null) add(m[2]);

  const bare = /https?:\/\/[^\s<>'"\]]+/gi;
  while ((m = bare.exec(text)) !== null) add(m[0]);

  return out;
}

/** Drop bare URLs and markdown links so notes read clean next to embeds. */
export function stripLinkMarkup(text: string): string {
  return String(text || "")
    .replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi, "")
    .replace(/https?:\/\/[^\s<>'"\]]+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

export type LearnedChronoFilter = {
  year: number | null;
  month: number | null;
  day: number | null;
};

export const EMPTY_CHRONO_FILTER: LearnedChronoFilter = {
  year: null,
  month: null,
  day: null,
};

export function parseLearnedDateParts(
  key: string,
): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function matchesChronoFilter(date: string, filter: LearnedChronoFilter): boolean {
  const parts = parseLearnedDateParts(date);
  if (!parts) return false;
  if (filter.year != null && parts.year !== filter.year) return false;
  if (filter.month != null && parts.month !== filter.month) return false;
  if (filter.day != null && parts.day !== filter.day) return false;
  return true;
}

export function isChronoFilterActive(filter: LearnedChronoFilter): boolean {
  return filter.year != null || filter.month != null || filter.day != null;
}

export type LearnedChronoDay = { day: number; date: string; count: number };
export type LearnedChronoMonth = { month: number; count: number; days: LearnedChronoDay[] };
export type LearnedChronoYear = { year: number; count: number; months: LearnedChronoMonth[] };

export type LearnedChronoIndex = {
  years: LearnedChronoYear[];
  /** Month totals across the current year scope (or all years). */
  months: LearnedChronoMonth[];
  total: number;
};

/** Archive index: years → months → days with slip counts. */
export function buildLearnedChronoIndex(
  learned: LearnedMap | undefined | null,
  scopeYear: number | null = null,
): LearnedChronoIndex {
  const yearMap = new Map<number, Map<number, Map<number, { date: string; count: number }>>>();
  let total = 0;

  for (const [date, items] of Object.entries(learned || {})) {
    const parts = parseLearnedDateParts(date);
    if (!parts || !Array.isArray(items) || items.length === 0) continue;
    const n = items.length;
    total += n;
    if (!yearMap.has(parts.year)) yearMap.set(parts.year, new Map());
    const months = yearMap.get(parts.year)!;
    if (!months.has(parts.month)) months.set(parts.month, new Map());
    const days = months.get(parts.month)!;
    const prev = days.get(parts.day);
    days.set(parts.day, { date, count: (prev?.count || 0) + n });
  }

  const years: LearnedChronoYear[] = [...yearMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, monthsMap]) => {
      const months: LearnedChronoMonth[] = [...monthsMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([month, daysMap]) => {
          const days: LearnedChronoDay[] = [...daysMap.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([day, info]) => ({ day, date: info.date, count: info.count }));
          return {
            month,
            count: days.reduce((s, d) => s + d.count, 0),
            days,
          };
        });
      return {
        year,
        count: months.reduce((s, m) => s + m.count, 0),
        months,
      };
    });

  const months: LearnedChronoMonth[] = [];
  for (let month = 1; month <= 12; month++) {
    const fromYears = years
      .filter((y) => scopeYear == null || y.year === scopeYear)
      .flatMap((y) => y.months.filter((m) => m.month === month));
    if (!fromYears.length) {
      months.push({ month, count: 0, days: [] });
      continue;
    }
    const dayMap = new Map<number, LearnedChronoDay>();
    for (const m of fromYears) {
      for (const d of m.days) {
        const prev = dayMap.get(d.day);
        if (!prev) {
          dayMap.set(d.day, { ...d });
        } else {
          dayMap.set(d.day, {
            day: d.day,
            count: prev.count + d.count,
            date: d.date > prev.date ? d.date : prev.date,
          });
        }
      }
    }
    const days = [...dayMap.values()].sort((a, b) => b.day - a.day);
    months.push({
      month,
      count: days.reduce((s, d) => s + d.count, 0),
      days,
    });
  }

  return { years, months, total };
}

export function formatChronoFilterLabel(filter: LearnedChronoFilter): string {
  if (!isChronoFilterActive(filter)) return "All time";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  if (filter.year != null && filter.month != null && filter.day != null) {
    const key = `${filter.year}-${String(filter.month).padStart(2, "0")}-${String(filter.day).padStart(2, "0")}`;
    return formatLearnedDate(key);
  }
  if (filter.year != null && filter.month != null) {
    return `${months[filter.month - 1]} ${filter.year}`;
  }
  if (filter.year != null) return String(filter.year);
  if (filter.month != null) return months[filter.month - 1];
  if (filter.day != null) return `Day ${filter.day}`;
  return "All time";
}
