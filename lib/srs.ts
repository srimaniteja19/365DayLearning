import type { DayEntry, SrsEntry, SrsMap } from "@/lib/types";

export const DAY_MS = 86400000;
export const SRS_INTERVALS = [7, 30, 90, 180];
const LAPSE_DAYS = 3;

export function seedReview(now: number): SrsEntry {
  return { idx: 0, due: now + SRS_INTERVALS[0] * DAY_MS, graduated: false, reps: 0, last: now };
}

export function nextReview(entry: SrsEntry | undefined, outcome: string, now: number): SrsEntry {
  const cur = entry && typeof entry.idx === "number" ? entry.idx : 0;
  const reps = (entry && entry.reps ? entry.reps : 0) + 1;
  if (outcome === "solid") {
    const idx = cur + 1;
    if (idx >= SRS_INTERVALS.length) {
      return { idx: SRS_INTERVALS.length - 1, due: null, graduated: true, reps, last: now };
    }
    return { idx, due: now + SRS_INTERVALS[idx] * DAY_MS, graduated: false, reps, last: now };
  }
  if (outcome === "shaky") {
    return { idx: cur, due: now + SRS_INTERVALS[cur] * DAY_MS, graduated: false, reps, last: now };
  }
  return { idx: 0, due: now + LAPSE_DAYS * DAY_MS, graduated: false, reps, last: now };
}

export function dueList(srs: SrsMap, allDays: DayEntry[], now: number) {
  const out: Array<{ day: DayEntry; entry: SrsEntry }> = [];
  for (const d of allDays) {
    const e = srs[d.id];
    if (!e || e.graduated || !e.due) continue;
    if (e.due <= now) out.push({ day: d, entry: e });
  }
  out.sort((a, b) => a.entry.due! - b.entry.due!);
  return out;
}

export function relativeDue(ts: number | null | undefined, now: number): string {
  if (!ts) return "graduated";
  const diff = Math.round((ts - now) / DAY_MS);
  if (diff <= 0) return "due now";
  if (diff === 1) return "tomorrow";
  return `in ${diff} days`;
}
