import { describe, expect, it } from "vitest";
import {
  countLearned,
  createLearnedId,
  dateKey,
  sanitizeLearned,
  sortedLearnedDays,
} from "@/lib/learned";

describe("learned helpers", () => {
  it("dateKey uses local calendar date", () => {
    const d = new Date(2026, 6, 27);
    expect(dateKey(d)).toBe("2026-07-27");
  });

  it("sanitizeLearned drops junk and keeps valid items", () => {
    const out = sanitizeLearned({
      "2026-07-27": [
        { id: "a", title: "Redis", body: "notes", createdAt: 1, insight: "keep" },
        { title: "", body: "", createdAt: 2 },
        null,
      ],
      bad: [{ title: "x", body: "y", createdAt: 1 }],
      "not-a-date": [],
    });
    expect(out["2026-07-27"]).toHaveLength(1);
    expect(out["2026-07-27"][0].insight).toBe("keep");
    expect(out.bad).toBeUndefined();
  });

  it("sortedLearnedDays is newest first", () => {
    const days = sortedLearnedDays({
      "2026-07-20": [{ id: "1", title: "old", body: "", createdAt: 1 }],
      "2026-07-27": [
        { id: "2", title: "new", body: "", createdAt: 20 },
        { id: "3", title: "newer", body: "", createdAt: 30 },
      ],
    });
    expect(days.map((d) => d.date)).toEqual(["2026-07-27", "2026-07-20"]);
    expect(days[0].items.map((i) => i.id)).toEqual(["3", "2"]);
  });

  it("countLearned and createLearnedId work", () => {
    expect(countLearned({})).toBe(0);
    expect(countLearned({ "2026-07-27": [{ id: "1", title: "a", body: "", createdAt: 1 }] })).toBe(1);
    expect(createLearnedId().startsWith("l-")).toBe(true);
  });
});
