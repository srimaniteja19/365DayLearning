import type { Plan, PlanDay, PlanPeriod, PlanRequest } from "@/lib/types";
import {
  BUILTIN_365_ID,
  BUILTIN_45_ID,
} from "@/lib/types";
import DAYS_365_RAW from "@/data/days-365.json";
import DAYS_45_RAW from "@/data/days-45.json";

export type PeriodDef = PlanPeriod;

function remapDays(raw: Array<{ day: number; id: string; topics: string[]; domains: string[] }>, planId: string): PlanDay[] {
  return raw.map((d) => ({
    day: d.day,
    id: `${planId}:${d.day}`,
    topics: d.topics,
    domains: d.domains,
  }));
}

export const QUARTERS_365: PlanPeriod[] = [
  { label: "Q1", sub: "Foundations of depth", start: 1, end: 90 },
  { label: "Q2", sub: "Scale and systems", start: 91, end: 181 },
  { label: "Q3", sub: "Frontier engineering", start: 182, end: 273 },
  { label: "Q4", sub: "Synthesis", start: 274, end: 365 },
];

export const MONTHS_365: PlanPeriod[] = [
  { label: "Jan", sub: "New-stack ramp-up", start: 1, end: 31 },
  { label: "Feb", sub: "Stack depth", start: 32, end: 59 },
  { label: "Mar", sub: "Core systems", start: 60, end: 90 },
  { label: "Apr", sub: "Scale patterns", start: 91, end: 120 },
  { label: "May", sub: "Deep internals", start: 121, end: 151 },
  { label: "Jun", sub: "Reliability", start: 152, end: 181 },
  { label: "Jul", sub: "Advanced data", start: 182, end: 212 },
  { label: "Aug", sub: "Storage and search", start: 213, end: 243 },
  { label: "Sep", sub: "Retrieval and infra", start: 244, end: 273 },
  { label: "Oct", sub: "Emerging frontiers", start: 274, end: 304 },
  { label: "Nov", sub: "Operations", start: 305, end: 334 },
  { label: "Dec", sub: "Capstone", start: 335, end: 365 },
];

export const WEEKS_45: PlanPeriod[] = [
  { label: "Week 1", sub: "Model internals", start: 1, end: 7 },
  { label: "Week 2", sub: "Fine-tuning", start: 8, end: 14 },
  { label: "Week 3", sub: "Embeddings and RAG", start: 15, end: 21 },
  { label: "Week 4", sub: "Agents", start: 22, end: 28 },
  { label: "Week 5", sub: "Serving infra", start: 29, end: 35 },
  { label: "Week 6", sub: "LLMOps and security", start: 36, end: 42 },
  { label: "Week 7", sub: "Multimodal capstone", start: 43, end: 45 },
];

export function buildWeeks(totalDays: number): PlanPeriod[] {
  const out: PlanPeriod[] = [];
  for (let start = 1; start <= totalDays; start += 7) {
    const end = Math.min(start + 6, totalDays);
    out.push({ label: `W${out.length + 1}`, sub: `Days ${start}-${end}`, start, end });
  }
  return out;
}

const emptyMeta: PlanRequest = {};

export function createBuiltin365(): Plan {
  return {
    id: BUILTIN_365_ID,
    name: "OPERATION LONGHAUL",
    subtitle: "365-Day Full-Stack & Systems Campaign",
    builtin: true,
    createdAt: 0,
    totalDays: 365,
    topicsPerDay: 2,
    accentRole: "main",
    periodScopes: [
      { key: "all", label: "All days", periods: [] },
      { key: "quarter", label: "Quarter", periods: QUARTERS_365 },
      { key: "month", label: "Month", periods: MONTHS_365 },
      { key: "week", label: "Week", periods: buildWeeks(365) },
    ],
    days: remapDays(DAYS_365_RAW as PlanDay[], BUILTIN_365_ID),
    meta: { ...emptyMeta, totalDays: 365, topicsPerDay: 2, grouping: "quarterly-monthly" },
    status: "ready",
  };
}

export function createBuiltin45(): Plan {
  return {
    id: BUILTIN_45_ID,
    name: "OPERATION FASTBURN",
    subtitle: "45-Day AI / LLM Engineer Intensive",
    builtin: true,
    createdAt: 0,
    totalDays: 45,
    topicsPerDay: 2,
    accentRole: "sprint",
    periodScopes: [
      { key: "all", label: "All days", periods: [] },
      { key: "week", label: "Week", periods: WEEKS_45 },
    ],
    days: remapDays(DAYS_45_RAW as PlanDay[], BUILTIN_45_ID),
    meta: { ...emptyMeta, totalDays: 45, topicsPerDay: 2, grouping: "weekly" },
    status: "ready",
  };
}

export function seedBuiltinPlans(): Record<string, Plan> {
  const a = createBuiltin365();
  const b = createBuiltin45();
  return { [a.id]: a, [b.id]: b };
}

export function scopesForPlan(plan: Plan): Array<{ key: string; label: string }> {
  return plan.periodScopes.map((s) => ({ key: s.key, label: s.label }));
}

export function periodsForPlan(plan: Plan, scope: string): PlanPeriod[] | null {
  if (scope === "all") return null;
  const found = plan.periodScopes.find((s) => s.key === scope);
  if (!found || !found.periods.length) return null;
  return found.periods;
}

/** @deprecated Prefer plans map — kept for WeeklyView/LogView transitional imports. */
export const DAYS_365 = createBuiltin365().days;
export const DAYS_45 = createBuiltin45().days;

/** Temporary shim while UI migrates off CAMPAIGNS. */
export const CAMPAIGNS = {
  main: {
    key: "main" as const,
    name: "OPERATION LONGHAUL",
    subtitle: "365-Day Full-Stack & Systems Campaign",
    days: DAYS_365,
    unit: "day",
    totalDays: 365,
  },
  sprint: {
    key: "sprint" as const,
    name: "OPERATION FASTBURN",
    subtitle: "45-Day AI / LLM Engineer Intensive",
    days: DAYS_45,
    unit: "day",
    totalDays: 45,
  },
};

export function periodsFor(campaignKey: "main" | "sprint", scope: string, totalDays: number) {
  if (campaignKey === "main") {
    return periodsForPlan(createBuiltin365(), scope);
  }
  return periodsForPlan(createBuiltin45(), scope) ?? (scope === "week" ? buildWeeks(totalDays) : null);
}

export function scopesFor(campaignKey: "main" | "sprint") {
  return campaignKey === "main"
    ? scopesForPlan(createBuiltin365())
    : scopesForPlan(createBuiltin45());
}
