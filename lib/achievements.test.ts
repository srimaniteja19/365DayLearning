import { describe, expect, it } from "vitest";
import { BADGES, calendarStreak, computeBadges } from "@/lib/achievements";
import { dateKey } from "@/lib/learned";
import type { Plan } from "@/lib/types";

const DAY_MS = 86400000;

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "p1",
    name: "Plan",
    subtitle: "",
    builtin: false,
    createdAt: 0,
    totalDays: 1,
    topicsPerDay: 2,
    accentRole: "auto",
    periodScopes: [],
    days: [{ id: "p1:1", day: 1, topics: ["Topic A", "Topic B"], domains: ["backend-node"] }],
    meta: {},
    ...overrides,
  };
}

describe("calendarStreak", () => {
  it("counts consecutive days ending today", () => {
    const now = Date.now();
    const log = [
      { d: "x", i: 0, at: now },
      { d: "x", i: 1, at: now - DAY_MS },
      { d: "x", i: 2, at: now - 2 * DAY_MS },
    ];
    expect(calendarStreak(log, {})).toBe(3);
  });

  it("still counts a streak that ended yesterday", () => {
    const now = Date.now();
    const log = [{ d: "x", i: 0, at: now - DAY_MS }];
    expect(calendarStreak(log, {})).toBe(1);
  });

  it("is 0 with no activity", () => {
    expect(calendarStreak([], {})).toBe(0);
  });

  it("resets once there is a gap", () => {
    const now = Date.now();
    const log = [{ d: "x", i: 0, at: now }, { d: "x", i: 1, at: now - 3 * DAY_MS }];
    expect(calendarStreak(log, {})).toBe(1);
  });

  it("counts journal-only days too", () => {
    const today = dateKey(new Date());
    expect(calendarStreak([], { [today]: [{ id: "1", title: "t", body: "", createdAt: 1 }] })).toBe(1);
  });
});

describe("computeBadges", () => {
  it("returns the full badge catalog", () => {
    const statuses = computeBadges({
      visiblePlans: [],
      progress: {},
      srs: {},
      log: [],
      learned: {},
      doneTopics: 0,
      daysComplete: 0,
    });
    expect(statuses).toHaveLength(BADGES.length);
    expect(statuses.every((s) => !s.unlocked)).toBe(true);
  });

  it("unlocks first-step, day-one, and domain-expert on a fully completed day", () => {
    const plan = makePlan();
    const statuses = computeBadges({
      visiblePlans: [plan],
      progress: { "p1:1": { 0: true, 1: true } },
      srs: {},
      log: [],
      learned: {},
      doneTopics: 2,
      daysComplete: 1,
    });
    const byId = Object.fromEntries(statuses.map((s) => [s.badge.id, s]));
    expect(byId["first-step"].unlocked).toBe(true);
    expect(byId["day-one"].unlocked).toBe(true);
    expect(byId["domain-expert"].unlocked).toBe(true);
    expect(byId.century.unlocked).toBe(false);
    expect(byId.century.current).toBe(2);
    expect(byId.century.target).toBe(100);
  });

  it("unlocks architect and multitasker from plan composition", () => {
    const statuses = computeBadges({
      visiblePlans: [makePlan({ id: "a", builtin: false }), makePlan({ id: "b", builtin: true })],
      progress: {},
      srs: {},
      log: [],
      learned: {},
      doneTopics: 0,
      daysComplete: 0,
    });
    const byId = Object.fromEntries(statuses.map((s) => [s.badge.id, s]));
    expect(byId.architect.unlocked).toBe(true);
    expect(byId.multitasker.unlocked).toBe(true);
  });

  it("unlocks reviewer and graduate from srs state, but not scholar", () => {
    const statuses = computeBadges({
      visiblePlans: [],
      progress: {},
      srs: { d1: { idx: 1, due: null, graduated: true, reps: 1, last: 0 } },
      log: [],
      learned: {},
      doneTopics: 0,
      daysComplete: 0,
    });
    const byId = Object.fromEntries(statuses.map((s) => [s.badge.id, s]));
    expect(byId.reviewer.unlocked).toBe(true);
    expect(byId.graduate.unlocked).toBe(true);
    expect(byId.scholar.unlocked).toBe(false);
  });

  it("unlocks journaler/chronicler from journal volume", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: String(i), title: "t", body: "", createdAt: i }));
    const statuses = computeBadges({
      visiblePlans: [],
      progress: {},
      srs: {},
      log: [],
      learned: { "2026-01-01": items },
      doneTopics: 0,
      daysComplete: 0,
    });
    const byId = Object.fromEntries(statuses.map((s) => [s.badge.id, s]));
    expect(byId.journaler.unlocked).toBe(true);
    expect(byId.chronicler.unlocked).toBe(true);
  });

  it("unlocks night-owl / early-bird from log timestamp hours", () => {
    const nightTs = new Date(2026, 0, 1, 1, 0, 0).getTime();
    const morningTs = new Date(2026, 0, 1, 6, 0, 0).getTime();
    const statuses = computeBadges({
      visiblePlans: [],
      progress: {},
      srs: {},
      log: [{ d: "x", i: 0, at: nightTs }, { d: "y", i: 0, at: morningTs }],
      learned: {},
      doneTopics: 0,
      daysComplete: 0,
    });
    const byId = Object.fromEntries(statuses.map((s) => [s.badge.id, s]));
    expect(byId["night-owl"].unlocked).toBe(true);
    expect(byId["early-bird"].unlocked).toBe(true);
  });
});
