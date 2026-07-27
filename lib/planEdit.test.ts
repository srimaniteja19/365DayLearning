import { describe, expect, it } from "vitest";
import type { Plan, PlanDay } from "@/lib/types";
import {
  deleteDay,
  findDuplicateTopics,
  insertDayAfter,
  moveDay,
  renumberPlanDays,
  updatePeriodTheme,
  updateTopic,
  validateEditablePlan,
} from "@/lib/planEdit";

function day(n: number, topics: string[], domains = ["systems-eng"]): PlanDay {
  return {
    day: n,
    id: `plan-test:${n}`,
    topics,
    domains: domains.slice(0, topics.length),
  };
}

function samplePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan-test",
    name: "Test Plan",
    subtitle: "edit suite",
    builtin: false,
    createdAt: 1,
    totalDays: 3,
    topicsPerDay: 2,
    accentRole: "auto",
    periodScopes: [
      {
        key: "week",
        label: "Weeks",
        periods: [{ label: "W1", sub: "Foundations", start: 1, end: 3 }],
      },
    ],
    days: [
      day(1, ["Redis caching patterns", "HTTP keepalive tuning"]),
      day(2, ["Postgres index design", "NestJS module boundaries"]),
      day(3, ["Kafka consumer groups", "OpenTelemetry spans"]),
    ],
    meta: {
      domains: [{ id: "systems-eng", weight: "medium" }],
      topicsPerDay: 2,
    },
    status: "draft",
    ...overrides,
  };
}

describe("planEdit validation", () => {
  it("accepts a clean plan", () => {
    expect(validateEditablePlan(samplePlan())).toEqual([]);
  });

  it("flags empty name and empty topics", () => {
    const plan = samplePlan({
      name: "  ",
      days: [day(1, ["", "Valid second topic"])],
      totalDays: 1,
    });
    const codes = validateEditablePlan(plan).map((i) => i.code);
    expect(codes).toContain("name");
    expect(codes).toContain("empty_topic");
  });

  it("flags duplicate topics across days", () => {
    const plan = samplePlan({
      days: [
        day(1, ["Redis caching patterns", "HTTP keepalive tuning"]),
        day(2, ["Redis Caching Patterns", "NestJS module boundaries"]),
        day(3, ["Kafka consumer groups", "OpenTelemetry spans"]),
      ],
    });
    const dups = findDuplicateTopics(plan.days);
    expect(dups.has("redis caching patterns")).toBe(true);
    expect(validateEditablePlan(plan).some((i) => i.code === "duplicate")).toBe(true);
  });

  it("flags wrong topics-per-day count", () => {
    const plan = samplePlan({
      days: [day(1, ["Only one topic here"]), day(2, ["A", "B"]), day(3, ["C", "D"])],
    });
    expect(validateEditablePlan(plan).some((i) => i.code === "topics_per_day")).toBe(true);
  });
});

describe("planEdit mutations", () => {
  it("renumbers after delete and insert", () => {
    let plan = deleteDay(samplePlan(), 2);
    expect(plan.days.map((d) => d.day)).toEqual([1, 2]);
    expect(plan.totalDays).toBe(2);
    expect(plan.days[1].topics[0]).toContain("Kafka");

    plan = insertDayAfter(plan, 1);
    expect(plan.days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(plan.days[1].topics[0]).toContain("New topic");
    expect(plan.days[1].id).toBe("plan-test:2");
  });

  it("reorders via moveDay", () => {
    const plan = moveDay(samplePlan(), 0, 2);
    expect(plan.days[0].topics[0]).toContain("Postgres");
    expect(plan.days[2].topics[0]).toContain("Redis");
    expect(plan.days.map((d) => d.day)).toEqual([1, 2, 3]);
  });

  it("updates topics and period themes", () => {
    let plan = updateTopic(samplePlan(), 2, 0, "Brand new postgres topic");
    expect(plan.days[1].topics[0]).toBe("Brand new postgres topic");
    plan = updatePeriodTheme(plan, "week", 0, "Deep systems");
    expect(plan.periodScopes[0].periods[0].sub).toBe("Deep systems");
  });

  it("renumberPlanDays rewrites ids", () => {
    const messy = samplePlan({
      days: [
        { ...day(9, ["Alpha topic one", "Alpha topic two"]), id: "x" },
        { ...day(1, ["Beta topic one", "Beta topic two"]), id: "y" },
      ],
      totalDays: 2,
    });
    const fixed = renumberPlanDays(messy);
    expect(fixed.days.map((d) => ({ day: d.day, id: d.id }))).toEqual([
      { day: 1, id: "plan-test:1" },
      { day: 2, id: "plan-test:2" },
    ]);
  });
});
