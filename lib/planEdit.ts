import type { Plan, PlanDay, PlanPeriod } from "@/lib/types";
import {
  classifyDomain,
  normalizeTopic,
  parseJsonWithRepair,
} from "@/lib/planGeneration";
import { chatStructured } from "@/lib/claude-client";
import { z } from "zod";

export type PlanEditIssue = {
  code: string;
  message: string;
  day?: number;
  topicIndex?: number;
};

export function findDuplicateTopics(days: PlanDay[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  days.forEach((d) => {
    d.topics.forEach((t) => {
      const key = normalizeTopic(t);
      if (!key) return;
      const list = map.get(key) || [];
      list.push(d.day);
      map.set(key, list);
    });
  });
  for (const [k, daysList] of map) {
    if (daysList.length < 2) map.delete(k);
  }
  return map;
}

export function validateEditablePlan(plan: Plan): PlanEditIssue[] {
  const issues: PlanEditIssue[] = [];
  if (!plan.name.trim()) issues.push({ code: "name", message: "Plan name is required." });
  if (!plan.days.length) issues.push({ code: "empty", message: "Plan has no days." });

  const seenOrder: number[] = [];
  for (const d of plan.days) {
    seenOrder.push(d.day);
    if (d.topics.length !== plan.topicsPerDay) {
      issues.push({
        code: "topics_per_day",
        message: `Day ${d.day}: expected ${plan.topicsPerDay} topics, got ${d.topics.length}.`,
        day: d.day,
      });
    }
    d.topics.forEach((t, i) => {
      const words = t.trim().split(/\s+/).filter(Boolean).length;
      if (!t.trim()) {
        issues.push({
          code: "empty_topic",
          message: `Day ${d.day} topic ${i + 1} is empty.`,
          day: d.day,
          topicIndex: i,
        });
      } else if (words < 2 || words > 10) {
        issues.push({
          code: "topic_length",
          message: `Day ${d.day} topic ${i + 1}: ${words} words (need 2–10).`,
          day: d.day,
          topicIndex: i,
        });
      }
    });
  }

  const dups = findDuplicateTopics(plan.days);
  dups.forEach((dayList, key) => {
    issues.push({
      code: "duplicate",
      message: `Duplicate topic "${key}" on days ${dayList.join(", ")}.`,
    });
  });

  // Day numbers should be unique
  const dayNums = plan.days.map((d) => d.day);
  if (new Set(dayNums).size !== dayNums.length) {
    issues.push({ code: "day_unique", message: "Day numbers must be unique." });
  }

  return issues;
}

/** After reorder/insert/delete, renumber days 1..N and rewrite ids. */
export function renumberPlanDays(plan: Plan): Plan {
  const days = plan.days.map((d, i) => ({
    ...d,
    day: i + 1,
    id: `${plan.id}:${i + 1}`,
    topics: [...d.topics],
    domains: [...d.domains],
  }));
  return {
    ...plan,
    days,
    totalDays: days.length,
    status: "draft",
  };
}

export function updateTopic(
  plan: Plan,
  dayNum: number,
  topicIndex: number,
  text: string,
): Plan {
  return {
    ...plan,
    days: plan.days.map((d) => {
      if (d.day !== dayNum) return d;
      const topics = [...d.topics];
      topics[topicIndex] = text;
      return { ...d, topics };
    }),
    status: "draft",
  };
}

export function updateDomain(
  plan: Plan,
  dayNum: number,
  topicIndex: number,
  domain: string,
): Plan {
  return {
    ...plan,
    days: plan.days.map((d) => {
      if (d.day !== dayNum) return d;
      const domains = [...d.domains];
      while (domains.length < d.topics.length) domains.push(domain);
      domains[topicIndex] = domain;
      return { ...d, domains };
    }),
    status: "draft",
  };
}

export function deleteDay(plan: Plan, dayNum: number): Plan {
  return renumberPlanDays({
    ...plan,
    days: plan.days.filter((d) => d.day !== dayNum),
  });
}

export function insertDayAfter(plan: Plan, afterDayNum: number): Plan {
  const idx = plan.days.findIndex((d) => d.day === afterDayNum);
  const insertAt = idx < 0 ? plan.days.length : idx + 1;
  const blank: PlanDay = {
    day: 0,
    id: "",
    topics: Array.from({ length: plan.topicsPerDay }, () => "New topic placeholder"),
    domains: Array.from({ length: plan.topicsPerDay }, () => {
      const ids = plan.meta.domains?.map((d) => d.id) || ["systems-eng"];
      return ids[0];
    }),
  };
  const days = [...plan.days];
  days.splice(insertAt, 0, blank);
  return renumberPlanDays({ ...plan, days });
}

export function moveDay(plan: Plan, fromIndex: number, toIndex: number): Plan {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= plan.days.length ||
    toIndex >= plan.days.length ||
    fromIndex === toIndex
  ) {
    return plan;
  }
  const days = [...plan.days];
  const [item] = days.splice(fromIndex, 1);
  days.splice(toIndex, 0, item);
  return renumberPlanDays({ ...plan, days });
}

export function updatePeriodTheme(
  plan: Plan,
  scopeKey: string,
  periodIndex: number,
  sub: string,
): Plan {
  return {
    ...plan,
    periodScopes: plan.periodScopes.map((scope) => {
      if (scope.key !== scopeKey) return scope;
      const periods = scope.periods.map((p, i) =>
        i === periodIndex ? { ...p, sub } : p,
      );
      return { ...scope, periods };
    }),
    status: "draft",
  };
}

export function primaryPeriodScope(plan: Plan): {
  key: string;
  periods: PlanPeriod[];
} | null {
  return (
    plan.periodScopes.find((s) => s.key === "week" && s.periods.length) ||
    plan.periodScopes.find((s) => s.key === "month" && s.periods.length) ||
    plan.periodScopes.find((s) => s.periods.length) ||
    null
  );
}

const singleDaySchema = z.object({
  topics: z.array(z.string()).min(1),
  domains: z.array(z.string()).optional(),
});

const SINGLE_DAY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topics"],
  properties: {
    topics: { type: "array", items: { type: "string" }, minItems: 1 },
    domains: { type: "array", items: { type: "string" } },
  },
} as const;

export async function regenerateDay(
  plan: Plan,
  dayNum: number,
  instruction: string,
  signal?: AbortSignal,
): Promise<Plan> {
  const day = plan.days.find((d) => d.day === dayNum);
  if (!day) throw new Error(`Day ${dayNum} not found`);
  const domainIds =
    plan.meta.domains?.map((d) => d.id) ||
    Array.from(new Set(plan.days.flatMap((d) => d.domains)));
  const others = plan.days
    .filter((d) => d.day !== dayNum)
    .flatMap((d) => d.topics)
    .slice(-80);

  const prompt = `Regenerate day ${dayNum} of plan "${plan.name}".
Topics per day: exactly ${plan.topicsPerDay}
Instruction: ${instruction || "Improve depth and specificity"}
Current topics: ${day.topics.join(" | ")}
Goal: ${plan.meta.goal || ""}
Domain ids: ${domainIds.join(", ")}
Avoid repeating: ${others.join("; ") || "(none)"}
Each topic 2–10 words. Never put double-quote characters inside topic text.`;

  const parsed = await chatStructured({
    system:
      "You regenerate a single learning-plan day as strict JSON. Prefer a structured tool when available.",
    prompt,
    maxTokens: 800,
    temperature: 0.4,
    signal,
    kind: "action",
    schema: singleDaySchema,
    structured: {
      name: "submit_day",
      description: "Submit regenerated day topics and domain ids.",
      schema: SINGLE_DAY_JSON_SCHEMA as unknown as Record<string, unknown>,
    },
    parse: parseJsonWithRepair,
  });

  let topics = parsed.topics.map((t) => t.trim()).filter(Boolean);
  while (topics.length < plan.topicsPerDay) topics.push("Additional depth topic");
  topics = topics.slice(0, plan.topicsPerDay);
  const domains = topics.map((t, i) => {
    const d = parsed.domains?.[i];
    if (d && domainIds.includes(d)) return d;
    return classifyDomain(t, domainIds);
  });

  return {
    ...plan,
    days: plan.days.map((d) =>
      d.day === dayNum ? { ...d, topics, domains } : d,
    ),
    status: "draft",
  };
}

export { normalizeTopic };
