import type { PlanGrouping, PlanPacingProfile, PlanPersona, PlanPeriod, PlanRequest } from "@/lib/types";
import { buildWeeks, MONTHS_365, QUARTERS_365 } from "@/data/builtinPlans";

export type BuilderStep = 1 | 2 | 3 | 4;

export type BuilderDomainWeight = "small" | "medium" | "large";

export type BuilderDomain = {
  id: string;
  label: string;
  weight: BuilderDomainWeight;
  color: string;
};

export type BuilderDraft = {
  name: string;
  subtitle: string;
  totalDays: number;
  topicsPerDay: number;
  grouping: PlanGrouping;
  goal: string;
  level: string;
  exclusionsText: string;
  domains: BuilderDomain[];
  mustIncludeText: string;
  persona: PlanPersona;
  pacingProfile: PlanPacingProfile;
};

export const BUILDER_DOMAIN_COLORS = [
  "#F5A623", "#3FE0D0", "#C792EA", "#6EE7B7", "#60A5FA",
  "#F472B6", "#FB923C", "#EF4444", "#A3E635", "#FACC15", "#94A3B8",
];

export function colorForDomainIndex(i: number): string {
  return BUILDER_DOMAIN_COLORS[i % BUILDER_DOMAIN_COLORS.length];
}

export function defaultBuilderDraft(): BuilderDraft {
  return {
    name: "",
    subtitle: "",
    totalDays: 45,
    topicsPerDay: 2,
    grouping: "weekly",
    goal: "",
    level: "",
    exclusionsText: "",
    domains: [],
    mustIncludeText: "",
    persona: "bootcamp",
    pacingProfile: "balanced",
  };
}

export function slugifyDomain(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "domain";
}

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function buildPeriodScopes(
  totalDays: number,
  grouping: PlanGrouping,
): Array<{ key: string; label: string; periods: PlanPeriod[] }> {
  const scopes: Array<{ key: string; label: string; periods: PlanPeriod[] }> = [
    { key: "all", label: "All days", periods: [] },
  ];

  if (grouping === "none") return scopes;

  if (grouping === "weekly" || grouping === "quarterly-monthly") {
    scopes.push({ key: "week", label: "Week", periods: buildWeeks(totalDays) });
  }

  if (grouping === "monthly" || grouping === "quarterly-monthly") {
    if (totalDays === 365) {
      scopes.push({ key: "month", label: "Month", periods: MONTHS_365 });
    } else {
      scopes.push({ key: "month", label: "Month", periods: buildMonths(totalDays) });
    }
  }

  if (grouping === "quarterly-monthly") {
    if (totalDays === 365) {
      scopes.push({ key: "quarter", label: "Quarter", periods: QUARTERS_365 });
    } else {
      scopes.push({ key: "quarter", label: "Quarter", periods: buildQuarters(totalDays) });
    }
  }

  return scopes;
}

function buildMonths(totalDays: number): PlanPeriod[] {
  const out: PlanPeriod[] = [];
  for (let start = 1; start <= totalDays; start += 30) {
    const end = Math.min(start + 29, totalDays);
    out.push({
      label: `M${out.length + 1}`,
      sub: `Days ${start}-${end}`,
      start,
      end,
    });
  }
  return out;
}

function buildQuarters(totalDays: number): PlanPeriod[] {
  const chunk = Math.max(1, Math.ceil(totalDays / 4));
  const out: PlanPeriod[] = [];
  for (let start = 1; start <= totalDays; start += chunk) {
    const end = Math.min(start + chunk - 1, totalDays);
    out.push({
      label: `Q${out.length + 1}`,
      sub: `Days ${start}-${end}`,
      start,
      end,
    });
  }
  return out;
}

export function draftToPlanRequest(draft: BuilderDraft): PlanRequest {
  return {
    name: draft.name.trim(),
    subtitle: draft.subtitle.trim(),
    goal: draft.goal.trim(),
    level: draft.level.trim(),
    exclusions: linesToList(draft.exclusionsText),
    domains: draft.domains.map((d) => ({
      id: d.id,
      label: d.label,
      weight: d.weight,
      color: d.color,
    })),
    mustInclude: linesToList(draft.mustIncludeText),
    totalDays: draft.totalDays,
    topicsPerDay: draft.topicsPerDay,
    grouping: draft.grouping,
    persona: draft.persona || "bootcamp",
    pacingProfile: draft.pacingProfile || "balanced",
  };
}

export function validateShape(draft: BuilderDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Plan name is required.");
  if (!Number.isFinite(draft.totalDays) || draft.totalDays < 1 || draft.totalDays > 730) {
    errors.push("Total days must be between 1 and 730.");
  }
  if (draft.topicsPerDay < 1 || draft.topicsPerDay > 4) {
    errors.push("Topics per day must be 1–4.");
  }
  return errors;
}

export function validateContent(draft: BuilderDraft): string[] {
  const errors: string[] = [];
  if (!draft.goal.trim()) errors.push("Goal is required.");
  if (draft.domains.length === 0) errors.push("Add at least one domain.");
  return errors;
}

export function estimateGeneration(draft: BuilderDraft): {
  periods: number;
  apiCalls: number;
  topicCount: number;
  note: string;
} {
  const scopes = buildPeriodScopes(draft.totalDays, draft.grouping);
  const periodList =
    scopes.find((s) => s.key === "week")?.periods ||
    scopes.find((s) => s.key === "month")?.periods ||
    [{ start: 1, end: draft.totalDays }];
  const periods = Math.max(1, periodList.length);
  const topicCount = draft.totalDays * draft.topicsPerDay;
  return {
    periods,
    apiCalls: 1 + Math.ceil(periods / 3),
    topicCount,
    note: "Uses your AI settings. Outline + periods in parallel batches.",
  };
}
