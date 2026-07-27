import type { LearnedMap, LogEntry, Plan } from "@/lib/types";
import { dateKey } from "@/lib/learned";

const DAY_MS = 86400000;
const LOOKBACKS_DAYS = [7, 14, 30, 90, 180, 365, 730];

export type OnThisDayMemory =
  | { kind: "journal"; daysAgo: number; date: string; title: string; snippet: string }
  | { kind: "day"; daysAgo: number; date: string; dayLabel: string; planName: string; topics: string[] };

/**
 * Looks back over a fixed set of lookback windows (1wk, 2wk, 1mo, ...) and
 * resurfaces the closest calendar-day match with either a journal entry or
 * a completed topic. Deterministic per calendar day — same memory shows all
 * day, changes the next time the "closest" lookback flips to a new date.
 */
export function findOnThisDayMemory(input: {
  log: LogEntry[] | undefined;
  learned: LearnedMap | undefined;
  visiblePlans: Plan[];
}): OnThisDayMemory | null {
  const { log, learned, visiblePlans } = input;
  const now = Date.now();

  for (const daysAgo of LOOKBACKS_DAYS) {
    const target = new Date(now - daysAgo * DAY_MS);
    const key = dateKey(target);

    const items = (learned || {})[key];
    if (items && items.length) {
      const item = items[items.length - 1];
      return {
        kind: "journal",
        daysAgo,
        date: key,
        title: item.title,
        snippet: (item.insight || item.body || "").slice(0, 160).trim(),
      };
    }

    const entries = (log || []).filter((e) => e && typeof e.at === "number" && dateKey(new Date(e.at)) === key);
    if (entries.length) {
      const dayId = entries[0].d;
      for (const p of visiblePlans) {
        const day = p.days.find((d) => d.id === dayId);
        if (day) {
          return {
            kind: "day",
            daysAgo,
            date: key,
            dayLabel: `Day ${day.day}`,
            planName: p.name,
            topics: day.topics,
          };
        }
      }
    }
  }
  return null;
}
