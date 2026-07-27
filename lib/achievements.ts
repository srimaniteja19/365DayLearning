import type { LearnedMap, LogEntry, Plan, ProgressMap, SrsMap } from "@/lib/types";
import { countLearned, dateKey } from "@/lib/learned";

export type BadgeTier = "bronze" | "silver" | "gold";

export type Badge = {
  id: string;
  label: string;
  description: string;
  tier: BadgeTier;
};

export type BadgeStatus = {
  badge: Badge;
  unlocked: boolean;
  current: number;
  target: number;
};

export const BADGES: Badge[] = [
  { id: "first-step", label: "First Step", description: "Complete your first topic.", tier: "bronze" },
  { id: "day-one", label: "Day One", description: "Fully complete a single day.", tier: "bronze" },
  { id: "century", label: "Century Club", description: "Complete 100 topics.", tier: "silver" },
  { id: "grinder", label: "Grinder", description: "Complete 500 topics.", tier: "gold" },
  { id: "marathoner", label: "Marathoner", description: "Fully complete 30 days.", tier: "silver" },
  { id: "ultramarathoner", label: "Ultramarathoner", description: "Fully complete 100 days.", tier: "gold" },
  { id: "streak-7", label: "Week Streak", description: "Learn something 7 days in a row.", tier: "bronze" },
  { id: "streak-30", label: "Month Streak", description: "Learn something 30 days in a row.", tier: "gold" },
  { id: "reviewer", label: "First Review", description: "Complete your first spaced-repetition review.", tier: "bronze" },
  { id: "graduate", label: "Graduate", description: "Graduate a topic out of spaced repetition.", tier: "silver" },
  { id: "scholar", label: "Scholar", description: "Graduate 10 topics out of spaced repetition.", tier: "gold" },
  { id: "journaler", label: "Journaler", description: "Log your first \u201cother thing I learned.\u201d", tier: "bronze" },
  { id: "chronicler", label: "Chronicler", description: "Log 20 journal entries.", tier: "silver" },
  { id: "architect", label: "Architect", description: "Build a custom plan.", tier: "bronze" },
  { id: "multitasker", label: "Multitasker", description: "Run 2 or more active plans at once.", tier: "bronze" },
  { id: "domain-expert", label: "Domain Expert", description: "Fully master every topic in a single domain.", tier: "gold" },
  { id: "night-owl", label: "Night Owl", description: "Log progress between 11pm and 4am.", tier: "bronze" },
  { id: "early-bird", label: "Early Bird", description: "Log progress between 5am and 7am.", tier: "bronze" },
];

/** Consecutive calendar days (ending today or yesterday) with a topic check or journal entry. */
export function calendarStreak(log: LogEntry[] | undefined, learned: LearnedMap | undefined): number {
  const days = new Set<string>();
  (log || []).forEach((e) => {
    if (e && typeof e.at === "number") days.add(dateKey(new Date(e.at)));
  });
  Object.entries(learned || {}).forEach(([date, items]) => {
    if (items && items.length) days.add(date);
  });
  if (!days.size) return 0;

  const cursor = new Date();
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function progressToward(current: number, target: number): { current: number; target: number; unlocked: boolean } {
  return { current: Math.min(current, target), target, unlocked: current >= target };
}

function flag(isUnlocked: boolean): { current: number; target: number; unlocked: boolean } {
  return { current: isUnlocked ? 1 : 0, target: 1, unlocked: isUnlocked };
}

export type ComputeBadgesInput = {
  visiblePlans: Plan[];
  progress: ProgressMap;
  srs: SrsMap;
  log: LogEntry[];
  learned: LearnedMap;
  doneTopics: number;
  daysComplete: number;
};

export function computeBadges(input: ComputeBadgesInput): BadgeStatus[] {
  const { visiblePlans, progress, srs, log, learned, doneTopics, daysComplete } = input;

  const srsEntries = Object.values(srs || {});
  const graduated = srsEntries.filter((e) => e && e.graduated).length;
  const anyReview = srsEntries.some((e) => e && e.reps > 0);
  const journalCount = countLearned(learned);
  const customPlanCount = visiblePlans.filter((p) => !p.builtin).length;
  const streak = calendarStreak(log, learned);

  const domainTotals: Record<string, { total: number; done: number }> = {};
  visiblePlans.forEach((p) => {
    p.days.forEach((d) => {
      d.domains.forEach((dom) => {
        if (!domainTotals[dom]) domainTotals[dom] = { total: 0, done: 0 };
        domainTotals[dom].total += d.topics.length;
      });
      const pr = progress[d.id];
      if (!pr) return;
      d.topics.forEach((_, i) => {
        if (pr[i]) {
          d.domains.forEach((dom) => {
            domainTotals[dom].done += 1;
          });
        }
      });
    });
  });
  const domainExpert = Object.values(domainTotals).some((t) => t.total > 0 && t.done >= t.total);

  const hourOf = (ts: number) => new Date(ts).getHours();
  const nightOwl = (log || []).some((e) => e && typeof e.at === "number" && (hourOf(e.at) >= 23 || hourOf(e.at) < 4));
  const earlyBird = (log || []).some((e) => e && typeof e.at === "number" && hourOf(e.at) >= 5 && hourOf(e.at) < 7);

  const byId: Record<string, { current: number; target: number; unlocked: boolean }> = {
    "first-step": progressToward(doneTopics, 1),
    "day-one": progressToward(daysComplete, 1),
    century: progressToward(doneTopics, 100),
    grinder: progressToward(doneTopics, 500),
    marathoner: progressToward(daysComplete, 30),
    ultramarathoner: progressToward(daysComplete, 100),
    "streak-7": progressToward(streak, 7),
    "streak-30": progressToward(streak, 30),
    reviewer: flag(anyReview),
    graduate: progressToward(graduated, 1),
    scholar: progressToward(graduated, 10),
    journaler: progressToward(journalCount, 1),
    chronicler: progressToward(journalCount, 20),
    architect: progressToward(customPlanCount, 1),
    multitasker: progressToward(visiblePlans.length, 2),
    "domain-expert": flag(domainExpert),
    "night-owl": flag(nightOwl),
    "early-bird": flag(earlyBird),
  };

  return BADGES.map((badge) => {
    const p = byId[badge.id] || { current: 0, target: 1, unlocked: false };
    return { badge, unlocked: p.unlocked, current: p.current, target: p.target };
  });
}

export function unlockedBadgeIds(statuses: BadgeStatus[]): string[] {
  return statuses.filter((s) => s.unlocked).map((s) => s.badge.id);
}
