import { describe, expect, it } from "vitest";
import { findOnThisDayMemory } from "@/lib/onThisDay";
import { dateKey } from "@/lib/learned";

const DAY_MS = 86400000;

describe("findOnThisDayMemory", () => {
  it("finds a journal entry from 7 days ago", () => {
    const key = dateKey(new Date(Date.now() - 7 * DAY_MS));
    const memory = findOnThisDayMemory({
      log: [],
      learned: {
        [key]: [{ id: "1", title: "Horseshoe crabs", body: "", insight: "cool stuff", createdAt: 1 }],
      },
      visiblePlans: [],
    });
    expect(memory?.kind).toBe("journal");
    if (memory?.kind === "journal") {
      expect(memory.title).toBe("Horseshoe crabs");
      expect(memory.daysAgo).toBe(7);
    }
  });

  it("finds a completed day from a log entry", () => {
    const at = Date.now() - 30 * DAY_MS;
    const plan = {
      id: "p1",
      name: "Plan",
      days: [{ id: "p1:1", day: 1, topics: ["A"], domains: [] }],
    };
    const memory = findOnThisDayMemory({
      log: [{ d: "p1:1", i: 0, at }],
      learned: {},
      visiblePlans: [plan as never],
    });
    expect(memory?.kind).toBe("day");
    if (memory?.kind === "day") {
      expect(memory.dayLabel).toBe("Day 1");
      expect(memory.planName).toBe("Plan");
      expect(memory.daysAgo).toBe(30);
    }
  });

  it("returns null when there is nothing to resurface", () => {
    expect(findOnThisDayMemory({ log: [], learned: {}, visiblePlans: [] })).toBeNull();
  });

  it("prefers the closest lookback window", () => {
    const key7 = dateKey(new Date(Date.now() - 7 * DAY_MS));
    const key30 = dateKey(new Date(Date.now() - 30 * DAY_MS));
    const memory = findOnThisDayMemory({
      log: [],
      learned: {
        [key7]: [{ id: "1", title: "recent", body: "", createdAt: 1 }],
        [key30]: [{ id: "2", title: "older", body: "", createdAt: 1 }],
      },
      visiblePlans: [],
    });
    expect(memory?.kind).toBe("journal");
    if (memory?.kind === "journal") expect(memory.title).toBe("recent");
  });
});
