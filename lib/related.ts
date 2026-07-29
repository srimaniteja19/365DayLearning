import type { DayEntry } from "@/lib/types";

const STOPWORDS = new Set(["the","and","for","with","from","into","that","this","your","are","its",
  "how","why","what","when","design","designs","patterns","pattern","internals","internal","deep","dive",
  "advanced","modern","production","systems","system","using","use","based","across","over","under","vs"]);

function tokenizeTopic(t: string): string[] {
  return t.toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .split(/[\s\-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export type RelatedIndex = {
  dayTokens: Map<string, Set<string>>;
  idf: Map<string, number>;
};

export function buildRelatedIndex(days: DayEntry[]): RelatedIndex {
  const dayTokens = new Map<string, Set<string>>();
  const df = new Map<string, number>();
  for (const d of days) {
    const set = new Set<string>();
    d.topics.forEach((t) => tokenizeTopic(t).forEach((w) => set.add(w)));
    dayTokens.set(d.id, set);
    set.forEach((w) => df.set(w, (df.get(w) || 0) + 1));
  }
  const n = days.length;
  const idf = new Map<string, number>();
  df.forEach((c, w) => idf.set(w, Math.log(n / (1 + c))));
  return { dayTokens, idf };
}

export function relatedDaysFor(day: DayEntry, days: DayEntry[], index: RelatedIndex, limit?: number) {
  const mine = index.dayTokens.get(day.id);
  if (!mine) return [];
  const scored: Array<{ day: DayEntry; score: number; terms: string[] }> = [];
  for (const other of days) {
    if (other.id === day.id) continue;
    const theirs = index.dayTokens.get(other.id);
    if (!theirs) continue;
    let score = 0;
    const shared: Array<{ w: string; weight: number }> = [];
    mine.forEach((w) => {
      if (theirs.has(w)) {
        const weight = Math.max(0.15, index.idf.get(w) || 0);
        score += weight;
        shared.push({ w, weight });
      }
    });
    if (score <= 0) continue;
    const sharedDomain = other.domains.some((dm) => day.domains.includes(dm));
    if (sharedDomain) score += 0.45;
    shared.sort((a, b) => b.weight - a.weight);
    scored.push({ day: other, score, terms: shared.slice(0, 3).map((x) => x.w) });
  }
  scored.sort((a, b) => b.score - a.score || a.day.day - b.day.day);
  return scored.filter((x) => x.score >= 1.1).slice(0, limit || 3);
}
