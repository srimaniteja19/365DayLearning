import { chat } from "@/lib/claude-client";

export type BriefingInput = {
  planName: string;
  activeDayLabel: string;
  activeDayTopics: string[];
  dueReviewCount: number;
  streak: number;
  journalHint?: string;
};

export async function generateDailyBriefing(input: BriefingInput): Promise<string> {
  const { planName, activeDayLabel, activeDayTopics, dueReviewCount, streak, journalHint } = input;

  const prompt = `You are a sharp, encouraging learning coach. Write a short daily briefing (55-80 words, plain prose, no markdown, no headers, no greeting) for someone running a self-directed learning campaign called "${planName}".

Context:
- Next up: ${activeDayLabel} — topics: ${activeDayTopics.length ? activeDayTopics.join(", ") : "none scheduled right now"}
- Spaced-repetition reviews due today: ${dueReviewCount}
- Current streak: ${streak} day${streak === 1 ? "" : "s"}
${journalHint ? `- They recently logged a side-note titled "${journalHint}" in their learning journal — reference it only if it connects naturally to today's topics.` : ""}

Write directly to them in second person, present tense. Be specific about the topics rather than generic. Mention the review count only if it is greater than 0. End with one concrete, motivating nudge. Output only the briefing text — no title, no quotes, no markdown.`;

  const text = await chat({ prompt, maxTokens: 220, temperature: 0.7 });
  return text.trim();
}

type CachedBriefing = { text: string; at: number };

function cacheKey(dateKey: string, planId: string): string {
  return `dualtrack:briefing:${dateKey}:${planId}`;
}

export function loadCachedBriefing(dateKey: string, planId: string): CachedBriefing | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(dateKey, planId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBriefing;
    if (!parsed || typeof parsed.text !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedBriefing(dateKey: string, planId: string, text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(dateKey, planId), JSON.stringify({ text, at: Date.now() }));
  } catch {
    // storage full/unavailable — briefing just won't be cached across reloads
  }
}
