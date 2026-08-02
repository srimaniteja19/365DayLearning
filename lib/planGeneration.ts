import { z } from "zod";
import { parseJsonText, sanitizeJsonText } from "@/lib/stripFences";
import { chatStructured, willUseManagedAi } from "@/lib/aiClient";
import { newTelemetry, type GenerationTelemetry } from "@/lib/generationTelemetry";
import { getCachedSubscriptionTier, reservePlanGeneration, tierDef } from "@/lib/subscriptions";
import {
  buildPeriodScopes,
  draftToPlanRequest,
  type BuilderDraft,
} from "@/lib/planBuilder";
import type { Plan, PlanDay, PlanGrouping, PlanRequest } from "@/lib/types";
import { createPlanRouteSlug } from "@/lib/planRoute";
import { ContentError } from "@/lib/providers/errors";

/** Tier capability; applies to managed AI and BYOK generations alike. */
export function generationConcurrency(): number {
  return tierDef(getCachedSubscriptionTier()).generationConcurrency;
}
const outlinePeriodSchema = z.object({
  label: z.coerce.string().transform((s) => s.trim() || "Period"),
  theme: z.coerce.string().transform((s) => s.trim() || "Core topics"),
  start: z.coerce.number().int().positive(),
  end: z.coerce.number().int().positive(),
  domainMix: z.array(z.coerce.string()).optional(),
  capstone: z.coerce.string().optional(),
});

const outlineSchema = z.object({
  periods: z.array(outlinePeriodSchema).min(1),
});

/** Topics may be empty — validatePeriodDays pads placeholders. */
const topicStringSchema = z.preprocess(
  (val) => scrubTopicText(val),
  z.string(),
);

const generatedDaySchema = z.object({
  day: z.coerce.number().int().positive(),
  topics: z.array(topicStringSchema).default([]),
  domains: z.array(topicStringSchema).optional(),
  deliverable: z.coerce.string().optional(),
  estimatedMinutes: z.coerce.number().int().positive().optional(),
  cognitiveLoad: z.enum(["light", "medium", "heavy"]).optional(),
});

export const periodDaysSchema = z.object({
  days: z.array(generatedDaySchema).min(1),
});

const OUTLINE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["periods"],
  properties: {
    periods: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "theme", "start", "end"],
        properties: {
          label: { type: "string" },
          theme: { type: "string" },
          start: { type: "integer", minimum: 1 },
          end: { type: "integer", minimum: 1 },
          domainMix: { type: "array", items: { type: "string" } },
          capstone: { type: "string" },
        },
      },
    },
  },
} as const;

const PERIOD_DAYS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["days"],
  properties: {
    days: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "topics"],
        properties: {
          day: { type: "integer", minimum: 1 },
          topics: { type: "array", minItems: 1, items: { type: "string" } },
          domains: { type: "array", items: { type: "string" } },
          deliverable: { type: "string" },
          estimatedMinutes: { type: "integer", minimum: 5 },
          cognitiveLoad: { type: "string", enum: ["light", "medium", "heavy"] },
        },
      },
    },
  },
} as const;

export type OutlinePeriod = z.infer<typeof outlinePeriodSchema>;
export type GenProgress = {
  phase: "idle" | "outline" | "periods" | "done" | "error" | "cancelled";
  periodIndex: number;
  periodTotal: number;
  message: string;
  topicsSoFar: string[];
  failedPeriods: number[];
  outline?: OutlinePeriod[];
  days: PlanDay[];
};

export function createPlanId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `plan-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `plan-${Date.now().toString(36)}`;
}

/** Validate outline ranges tile 1..N with no gaps/overlaps. */
export function validateOutlineTiles(
  periods: OutlinePeriod[],
  totalDays: number,
): string[] {
  const errors: string[] = [];
  const safePeriods = Array.isArray(periods) ? periods : [];
  if (!safePeriods.length) return ["Outline has no periods."];
  const sorted = [...safePeriods].sort((a, b) => a.start - b.start);
  if (sorted[0].start !== 1) errors.push(`First period must start at 1 (got ${sorted[0].start}).`);
  if (sorted[sorted.length - 1].end !== totalDays) {
    errors.push(`Last period must end at ${totalDays} (got ${sorted[sorted.length - 1].end}).`);
  }
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (p.end < p.start) errors.push(`Period ${p.label}: end < start.`);
    if (i > 0) {
      const prev = sorted[i - 1];
      if (p.start !== prev.end + 1) {
        errors.push(
          `Gap/overlap between ${prev.label} (ends ${prev.end}) and ${p.label} (starts ${p.start}).`,
        );
      }
    }
  }
  return errors;
}

/** Deterministic period tiling from the builder grouping preference. */
export function skeletonOutlinePeriods(
  totalDays: number,
  grouping: PlanGrouping,
): OutlinePeriod[] {
  const scopes = buildPeriodScopes(totalDays, grouping);
  const periods =
    scopes.find((s) => s.key === "week")?.periods ||
    scopes.find((s) => s.key === "month")?.periods ||
    [{ label: "All days", sub: "Full campaign", start: 1, end: totalDays }];
  return periods.map((p) => ({
    label: p.label,
    theme: p.sub || p.label,
    start: p.start,
    end: p.end,
  }));
}

/**
 * Snap a model outline onto a valid tiling. Keeps themes/domainMix when ranges
 * overlap; never requires a second LLM call for bad boundaries.
 */
export function snapOutlineToSkeleton(
  rawOutline: OutlinePeriod[],
  rawSkeleton: OutlinePeriod[],
): OutlinePeriod[] {
  const outline = Array.isArray(rawOutline) ? rawOutline : [];
  const skeleton = Array.isArray(rawSkeleton) ? rawSkeleton : [];
  if (!skeleton.length) return outline;
  if (outline.length > 0 && validateOutlineTiles(outline, skeleton[skeleton.length - 1].end).length === 0) {
    return [...outline].sort((a, b) => a.start - b.start);
  }
  return skeleton.map((sk, i) => {
    const overlap =
      outline.find((o) => o && typeof o === "object" && o.start <= sk.end && o.end >= sk.start) ||
      outline[Math.min(i, Math.max(0, outline.length - 1))];
    return {
      label: sk.label,
      theme: (overlap?.theme || sk.theme || "").trim() || sk.theme,
      start: sk.start,
      end: sk.end,
      domainMix: overlap?.domainMix,
    };
  });
}

/** Only re-roll a period when the model missed a large chunk of days. */
export function shouldRetryPeriod(
  issues: PeriodValidationIssue[],
  period: OutlinePeriod,
): boolean {
  const expected = period.end - period.start + 1;
  const hard = issues.filter((i) => i.code === "missing_day" || i.code === "day_count");
  if (hard.length >= Math.max(2, Math.ceil(expected * 0.35))) return true;
  if (issues.filter((i) => i.code === "exclusion").length >= 3) return true;
  return false;
}

function wordCount(topic: string): number {
  return topic.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extract a string from model output that may be a bare string or
 * `{ title|topic|name|… }` — never String(object) → "[object Object]".
 */
export function coerceTopicString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of ["title", "topic", "name", "text", "label", "concept"]) {
      const hit = obj[key];
      if (typeof hit === "string" && hit.trim()) return hit.trim();
    }
  }
  return "";
}

const PLACEHOLDER_TOPIC_RE =
  /^(topic|example|placeholder|sample|dummy)\s*[a-z0-9_-]*$/i;

/**
 * Clean and validate a topic string. Returns "" when the text is unusable
 * (HTML junk, example placeholders like "Topic A", mostly punctuation, etc.).
 */
export function scrubTopicText(value: unknown): string {
  let s = coerceTopicString(value);
  if (!s) return "";

  // Collapse markup / broken tag runs the model sometimes emits (</</</…).
  s = s.replace(/<\/?[a-zA-Z][^>]{0,40}>/g, " ");
  s = s.replace(/[<>\/\\]{2,}/g, " ");
  s = s.replace(/[<>]+/g, " ");
  // Strip other control / zero-width junk
  s = s.replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";

  if (s.toLowerCase() === "[object object]") return "";
  if (PLACEHOLDER_TOPIC_RE.test(s)) return "";
  // "Topic A", "Topic 1", "topic b" — repair-prompt leaks
  if (/^topics?\s+[a-z0-9]+$/i.test(s)) return "";

  const letters = (s.match(/\p{L}/gu) || []).length;
  if (letters < 4) return "";
  if (letters / s.length < 0.45) return "";

  // Detect pathological repetition (e.g. same 2–3 char chunk many times)
  if (s.length >= 24) {
    const chunk = s.slice(0, 3);
    if (chunk.trim() && s.split(chunk).length > 8) return "";
  }

  if (s.length > 100) s = s.slice(0, 100).trim();

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 12) s = words.slice(0, 12).join(" ");

  return s.trim();
}

export function normalizeTopic(t: unknown): string {
  return scrubTopicText(t).toLowerCase().replace(/\s+/g, " ");
}

export type PeriodValidationIssue = {
  code: string;
  message: string;
};

type RawGenDay = { day: number; topics: string[]; domains?: string[] };

/**
 * Models often number days 1..N inside a period even when the period is
 * days 15–21. Remap relative sequences onto the absolute period range.
 */
function alignDaysToPeriod(
  rawDays: RawGenDay[],
  period: OutlinePeriod,
): RawGenDay[] {
  const days = Array.isArray(rawDays)
    ? rawDays.filter((d) => d && typeof d === "object" && typeof d.day === "number" && Array.isArray(d.topics))
    : [];
  const expected = period.end - period.start + 1;
  if (!days.length) return [];

  const inRange = days.filter((d) => d.day >= period.start && d.day <= period.end);
  if (inRange.length === days.length) return inRange;
  // Enough absolute hits to trust — keep them and let padding fill gaps.
  if (inRange.length >= Math.ceil(expected / 2)) return inRange;

  const sorted = [...days].sort((a, b) => a.day - b.day);
  return sorted.slice(0, expected).map((d, i) => ({
    ...d,
    day: period.start + i,
  }));
}

function placeholderTopic(dayNum: number, slot: number): string {
  // Must be 2–10 words and unique enough to pass duplicate checks when padded.
  return slot === 0
    ? `Needs review topic ${dayNum}`
    : `Needs review follow-up ${dayNum}-${slot + 1}`;
}

function padTopics(
  topics: string[],
  domains: string[],
  topicsPerDay: number,
  dayNum: number,
  domainIds: string[],
): { topics: string[]; domains: string[]; padded: boolean } {
  const nextTopics: string[] = [];
  let padded = false;
  for (let i = 0; i < topics.length && nextTopics.length < topicsPerDay; i++) {
    const s = scrubTopicText(topics[i]);
    if (!s) {
      nextTopics.push(placeholderTopic(dayNum, nextTopics.length));
      padded = true;
      continue;
    }
    const words = s.split(/\s+/).filter(Boolean);
    let topic = s;
    if (words.length < 2) {
      topic = `${s} fundamentals`;
      // Re-scrub in case append made it weird; keep unique enough for dedupe.
      topic = scrubTopicText(topic) || placeholderTopic(dayNum, nextTopics.length);
      padded = true;
    } else if (words.length > 10) {
      topic = words.slice(0, 10).join(" ");
      padded = true;
    }
    nextTopics.push(topic);
  }
  while (nextTopics.length < topicsPerDay) {
    nextTopics.push(placeholderTopic(dayNum, nextTopics.length));
    padded = true;
  }
  const trimmedTopics = nextTopics.slice(0, topicsPerDay);
  const nextDomains = domains.map((d) => {
    const raw = typeof d === "string" ? d.trim() : scrubTopicText(d);
    return raw;
  });
  const trimmedDomains = trimmedTopics.map((t, i) => {
    const d = nextDomains[i];
    if (d && domainIds.includes(d)) return d;
    return classifyDomain(t, domainIds);
  });
  return { topics: trimmedTopics, domains: trimmedDomains, padded };
}

export function validatePeriodDays(opts: {
  days: RawGenDay[];
  period: OutlinePeriod;
  topicsPerDay: number;
  exclusions: string[];
  seenTopics: Set<string>;
  domainIds: string[];
}): { issues: PeriodValidationIssue[]; fixedDays: PlanDay[]; newTopics: string[] } {
  const { period, topicsPerDay, exclusions, seenTopics, domainIds } = opts;
  const issues: PeriodValidationIssue[] = [];
  const excl = new Set(exclusions.map(normalizeTopic));
  const expectedDays = period.end - period.start + 1;
  const aligned = alignDaysToPeriod(opts.days, period);

  if (aligned.length !== expectedDays) {
    issues.push({
      code: "day_count",
      message: `Expected ${expectedDays} days for ${period.label}, got ${aligned.length}.`,
    });
  }

  const byDay = new Map(aligned.map((d) => [d.day, d]));
  const fixedDays: PlanDay[] = [];
  const newTopics: string[] = [];
  const localSeen = new Set(seenTopics);

  for (let dayNum = period.start; dayNum <= period.end; dayNum++) {
    const raw = byDay.get(dayNum);
    if (!raw) {
      issues.push({ code: "missing_day", message: `Missing day ${dayNum} — filled with placeholders.` });
      const filled = padTopics([], [], topicsPerDay, dayNum, domainIds);
      filled.topics.forEach((t) => {
        localSeen.add(normalizeTopic(t));
        newTopics.push(t);
      });
      fixedDays.push({
        day: dayNum,
        id: "",
        topics: filled.topics,
        domains: filled.domains,
      });
      continue;
    }

    if (raw.topics.length !== topicsPerDay) {
      issues.push({
        code: "topics_per_day",
        message: `Day ${dayNum}: expected ${topicsPerDay} topics, got ${raw.topics.length}.`,
      });
    }

    const filled = padTopics(
      raw.topics,
      raw.domains || [],
      topicsPerDay,
      dayNum,
      domainIds,
    );
    if (filled.padded) {
      issues.push({
        code: "topics_padded",
        message: `Day ${dayNum}: padded missing topics with placeholders.`,
      });
    }

    filled.topics.forEach((t, i) => {
      const words = wordCount(t);
      if (words < 2 || words > 10) {
        issues.push({
          code: "topic_length",
          message: `Day ${dayNum} topic ${i + 1}: word count ${words} (need 2–10).`,
        });
      }
      const key = normalizeTopic(t);
      if (excl.has(key)) {
        issues.push({
          code: "exclusion",
          message: `Day ${dayNum}: topic matches exclusion "${t}".`,
        });
      }
      if (localSeen.has(key)) {
        issues.push({
          code: "duplicate",
          message: `Day ${dayNum}: duplicate topic "${t}".`,
        });
      } else {
        localSeen.add(key);
        newTopics.push(t);
      }
    });

    fixedDays.push({
      day: dayNum,
      id: "",
      topics: filled.topics,
      domains: filled.domains,
    });
  }

  return { issues, fixedDays, newTopics };
}

/** Guarantee every day 1..totalDays exists after generation. */
export function ensureContiguousDays(opts: {
  days: PlanDay[];
  totalDays: number;
  topicsPerDay: number;
  domainIds: string[];
  planId: string;
}): PlanDay[] {
  const { totalDays, topicsPerDay, domainIds, planId } = opts;
  const byDay = new Map(opts.days.map((d) => [d.day, d]));
  const out: PlanDay[] = [];
  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const existing = byDay.get(dayNum);
    if (existing) {
      const filled = padTopics(
        existing.topics,
        existing.domains || [],
        topicsPerDay,
        dayNum,
        domainIds,
      );
      out.push({
        ...existing,
        id: existing.id || `${planId}:${dayNum}`,
        topics: filled.topics,
        domains: filled.domains,
      });
      continue;
    }
    const filled = padTopics([], [], topicsPerDay, dayNum, domainIds);
    out.push({
      day: dayNum,
      id: `${planId}:${dayNum}`,
      topics: filled.topics,
      domains: filled.domains,
    });
  }
  return out;
}

/** Simple keyword fallback when the model returns an unknown domain. */
export function classifyDomain(topic: string, domainIds: string[]): string {
  const t = topic.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/react|frontend|css|browser|dom|vite|next\.?js ui/i, "frontend"],
    [/node|nest|express|fastify|backend/i, "backend-node"],
    [/dynamo|postgres|mysql|redis|mongo|elastic|database|sql/i, "databases"],
    [/kubernetes|docker|aws|lambda|terraform|cloud|eks/i, "infra-cloud"],
    [/kafka|flink|spark|etl|pipeline|data eng/i, "data-eng"],
    [/raft|consensus|distributed|quorum|crdt/i, "distributed-sys"],
    [/security|oauth|jwt|tls|owasp|auth/i, "security"],
    [/otel|prometheus|tracing|observab|metrics/i, "observability"],
    [/perf|latency|profil|benchmark|cache stampede/i, "perf"],
    [/llm|rag|embedding|transformer|agent|gpt|model/i, "ai-ml"],
  ];
  for (const [re, id] of rules) {
    if (re.test(t) && domainIds.includes(id)) return id;
  }
  return domainIds[0] || "systems-eng";
}

export async function parseJsonWithRepair<T>(
  raw: string,
  schema: z.ZodType<T>,
  repair: (error: string, raw: string) => Promise<string>,
): Promise<T> {
  const tryParse = (text: string): T | null => {
    try {
      const data = coercePlanAiPayload(parseJsonText(text));
      return schema.parse(data);
    } catch {
      return null;
    }
  };

  const first = tryParse(raw);
  if (first !== null) return first;

  const msg = formatParseError(raw);
  const seed = sanitizeJsonText(raw);
  let repaired: string = "";
  try {
    repaired = await repair(msg, seed || raw);
    const second = tryParse(repaired);
    if (second !== null) return second;
  } catch {
    /* proceed to soft recovery */
  }

  try {
    const rawCoerced = coercePlanAiPayload(parseJsonText(repaired || seed || raw));
    const fallbackParsed = schema.safeParse(rawCoerced);
    if (fallbackParsed.success) {
      return fallbackParsed.data;
    }
    if (rawCoerced && typeof rawCoerced === "object") {
      const rec = rawCoerced as Record<string, unknown>;
      if (Array.isArray(rec.days) && rec.days.length > 0) {
        return { days: rec.days } as unknown as T;
      }
      if (Array.isArray(rec.periods) && rec.periods.length > 0) {
        return { periods: rec.periods } as unknown as T;
      }
    }
  } catch {
    /* proceed to final error */
  }

  throw new ContentError(
    "The AI returned malformed plan data that could not be repaired. Try again.",
  );
}

/** Human-readable Zod / JSON errors for repair prompts and toasts. */
export function formatParseError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues
      .slice(0, 8)
      .map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "root";
        if (issue.code === "too_small" && String(path).includes("topics")) {
          return `${path}: needs at least one topic`;
        }
        if (issue.code === "too_small" && String(path).includes("days")) {
          return `${path}: needs at least one day`;
        }
        if (issue.code === "too_small" && String(path).includes("periods")) {
          return `${path}: needs at least one period`;
        }
        return `${path}: ${issue.message}`;
      })
      .join("; ");
  }
  if (err instanceof SyntaxError) {
    const m = err.message;
    if (/Expected ':' after property name/i.test(m)) {
      return "missing ':' after a property name";
    }
    if (/Expected ',' or ']'|Expected ',' or '}'/i.test(m)) {
      return "missing comma between values";
    }
    if (/Unterminated string/i.test(m)) return "unterminated string";
    if (/Unexpected (token|end)/i.test(m)) return "unexpected token in JSON";
    return "invalid JSON";
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function coerceStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => scrubTopicText(x)).filter(Boolean);
  }
  if (typeof value === "string") {
    const lines = value
      .split(/[\n;\r]+/)
      .map((s) => s.replace(/^[-*•\d.\s]+/, "").trim())
      .map((s) => scrubTopicText(s))
      .filter(Boolean);
    if (lines.length > 1) return lines;
    const comma = value
      .split(/,\s+/)
      .map((s) => scrubTopicText(s))
      .filter(Boolean);
    if (comma.length > 1) return comma;
  }
  const single = scrubTopicText(value);
  return single ? [single] : [];
}

function coerceGeneratedDay(item: unknown, index: number): Record<string, unknown> {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return { day: index + 1, topics: [] };
  }
  const d = item as Record<string, unknown>;
  let dayNum = Number(d.day);
  if (!Number.isFinite(dayNum)) {
    const m = String(d.day ?? "").match(/\d+/);
    if (m) dayNum = parseInt(m[0], 10);
  }

  let topics = coerceStringList(d.topics);
  if (!topics.length) topics = coerceStringList(d.topic);
  if (!topics.length) topics = coerceStringList(d.title);
  if (!topics.length) topics = coerceStringList(d.concepts);

  const domains = coerceStringList(d.domains);
  if (!domains.length) {
    const singular = coerceStringList(d.domain);
    if (singular.length) domains.push(...singular);
  }

  const deliverable = typeof d.deliverable === "string" ? d.deliverable.trim() : undefined;

  let est = Number(d.estimatedMinutes ?? d.estimated_minutes ?? d.estimatedTime ?? d.duration);
  if (!Number.isFinite(est)) {
    const m = String(d.estimatedMinutes ?? d.estimated_minutes ?? d.duration ?? "").match(/\d+/);
    if (m) est = parseInt(m[0], 10);
  }
  const estimatedMinutes = Number.isFinite(est) && est > 0 ? Math.trunc(est) : undefined;

  const rawCog = String(d.cognitiveLoad ?? d.cognitive_load ?? d.load ?? "").toLowerCase();
  const cognitiveLoad =
    rawCog.includes("light")
      ? "light"
      : rawCog.includes("heavy")
      ? "heavy"
      : rawCog.includes("medium")
      ? "medium"
      : undefined;

  return {
    day: Number.isFinite(dayNum) && dayNum > 0 ? Math.trunc(dayNum) : index + 1,
    topics,
    ...(domains.length ? { domains } : {}),
    ...(deliverable ? { deliverable } : {}),
    ...(estimatedMinutes ? { estimatedMinutes } : {}),
    ...(cognitiveLoad ? { cognitiveLoad } : {}),
  };
}

function coerceOutlinePeriod(item: unknown, index: number): Record<string, unknown> {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return {
      label: `Period ${index + 1}`,
      theme: "Core topics",
      start: index + 1,
      end: index + 1,
    };
  }
  const d = item as Record<string, unknown>;
  let start = Number(d.start);
  if (!Number.isFinite(start)) {
    const m = String(d.start ?? "").match(/\d+/);
    if (m) start = parseInt(m[0], 10);
  }
  let end = Number(d.end);
  if (!Number.isFinite(end)) {
    const m = String(d.end ?? "").match(/\d+/);
    if (m) end = parseInt(m[0], 10);
  }

  start = Math.trunc(start);
  end = Math.trunc(end);
  if (!Number.isFinite(start) || start < 1) start = index + 1;
  if (!Number.isFinite(end) || end < 1) end = start;
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  const domainMix = coerceStringList(d.domainMix ?? d.domains);
  const capstone = typeof d.capstone === "string" ? d.capstone.trim() : undefined;
  return {
    label: String(d.label ?? d.name ?? d.title ?? "").trim() || `Period ${index + 1}`,
    theme: String(d.theme ?? d.description ?? d.overview ?? "").trim() || "Core topics",
    start,
    end,
    ...(domainMix.length ? { domainMix } : {}),
    ...(capstone ? { capstone } : {}),
  };
}

/**
 * Local structural repairs so flaky model JSON still validates.
 * Empty topics stay empty — validatePeriodDays pads placeholders later.
 */
export function coercePlanAiPayload(data: unknown): unknown {
  if (!data) return data;

  if (Array.isArray(data)) {
    if (!data.length) return { days: [] };
    const first = data[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      if ("start" in first || "theme" in first || "label" in first) {
        return { periods: data.map((item, i) => coerceOutlinePeriod(item, i)) };
      }
    }
    return { days: data.map((item, i) => coerceGeneratedDay(item, i)) };
  }

  if (typeof data !== "object") return data;
  let obj = { ...(data as Record<string, unknown>) };

  for (const key of ["data", "result", "payload", "plan", "output", "response", "periodDays", "outline", "period"]) {
    if (obj[key] && typeof obj[key] === "object") {
      const inner = obj[key];
      if (Array.isArray(inner) || "days" in inner || "periods" in inner || "topics" in inner || "day" in inner) {
        return coercePlanAiPayload(inner);
      }
    }
  }

  if (!("periods" in obj) && !("days" in obj) && ("start" in obj || "theme" in obj)) {
    obj = { periods: [obj] };
  }

  if (!("days" in obj) && !("periods" in obj) && ("day" in obj || "topics" in obj || "topic" in obj)) {
    obj = { days: [obj] };
  }

  if (obj.days && typeof obj.days === "object" && !Array.isArray(obj.days)) {
    obj.days = Object.values(obj.days);
  }

  if (obj.periods && typeof obj.periods === "object" && !Array.isArray(obj.periods)) {
    obj.periods = Object.values(obj.periods);
  }

  if (Array.isArray(obj.days)) {
    obj.days = obj.days.map((item, i) => coerceGeneratedDay(item, i));
  }

  if (Array.isArray(obj.periods)) {
    obj.periods = obj.periods.map((item, i) => coerceOutlinePeriod(item, i));
  }

  // Single-day regenerate shape: { topics, domains }
  if ("topics" in obj && !("days" in obj) && !("periods" in obj)) {
    let topics = coerceStringList(obj.topics);
    if (!topics.length) topics = coerceStringList(obj.topic);
    obj.topics = topics;
    let domains = coerceStringList(obj.domains);
    if (!domains.length) domains = coerceStringList(obj.domain);
    if (domains.length) obj.domains = domains;
    else delete obj.domains;
  }

  // Domain suggest shape: { domains: [{ label, weight }] }
  if (Array.isArray(obj.domains) && obj.domains.some((d) => d && typeof d === "object" && !Array.isArray(d))) {
    obj.domains = obj.domains
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const d = item as Record<string, unknown>;
        const label = String(d.label ?? d.name ?? d.id ?? "").trim();
        if (!label) return null;
        const rawWeight = String(d.weight ?? "medium").toLowerCase();
        const weight =
          rawWeight === "small" || rawWeight === "large" || rawWeight === "medium"
            ? rawWeight
            : "medium";
        const id = String(d.id ?? "").trim();
        return id ? { id, label, weight } : { label, weight };
      })
      .filter(Boolean);
  }

  return obj;
}

const PLAN_SYSTEM = `You are a master instructional designer and cognitive science expert specializing in adult learning, deliberate practice, Bloom's Taxonomy, and active recall.
Your daily learning plans build mastery through structured progression:
1. Cognitive Progression: Early periods establish mental models and core mechanisms (Understand & Remember); middle periods analyze trade-offs and edge cases (Analyze & Evaluate); final periods synthesize hands-on projects and failure recovery (Create & Apply).
2. Active Recall Specificity: Write every topic name as a testable concept (something the learner can answer a quiz question about). Never write generic lecture titles.
3. Universal Scope: Adapt precisely to the user's domain — tech, economics, languages, health, trades, or history. Do not default to software engineering unless requested.
4. Clean JSON: Never use double-quote characters inside string values. Write plain words or parentheses.`;

function domainCatalog(draft: BuilderDraft): string {
  return draft.domains
    .map((d) => `- ${d.id} — ${d.label} (emphasis: ${d.weight})`)
    .join("\n");
}

const INDEX_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "your", "that", "this", "using",
]);

/**
 * Dedupe context covering the whole plan: recent topics verbatim, older ones
 * collapsed to a keyword index. Validation rejects duplicates against every
 * topic generated so far, so the model has to see something for all of them.
 */
export function topicIndex(topics: string[], recentMax = 18): string {
  const safeTopics = Array.isArray(topics) ? topics : [];
  if (!safeTopics.length) return "(none yet — this is the first period)";
  const recent = safeTopics.slice(-recentMax);
  const older = safeTopics.slice(0, Math.max(0, safeTopics.length - recentMax));
  const parts = [
    `Recent ${recent.length} topics (do not repeat):`,
    ...recent.map((t) => `- ${t}`),
  ];
  if (older.length) {
    const keywords = Array.from(
      new Set(
        older.flatMap((t) => t.toLowerCase().match(/[a-z][a-z0-9+.#-]{2,}/g) || []),
      ),
    )
      .filter((w) => !INDEX_STOPWORDS.has(w))
      .slice(0, 20);
    parts.push(`The earlier ${older.length} topics covered: ${keywords.join(", ")}`);
  }
  return parts.join("\n");
}

export type GeneratePlanOptions = {
  draft: BuilderDraft;
  signal?: AbortSignal;
  onProgress?: (p: GenProgress) => void;
  resume?: {
    outline: OutlinePeriod[];
    days: PlanDay[];
    periodIndex: number;
    failedPeriods: number[];
  };
};

export async function generatePlan(opts: GeneratePlanOptions): Promise<{
  plan: Plan;
  telemetry: GenerationTelemetry;
  totalPeriods: number;
  failedPeriods: number;
  placeholderDays: number;
}> {
  const { draft, signal, onProgress } = opts;
  const telemetry = newTelemetry();

  // Only the first attempt at a plan (not a resume of an interrupted one)
  // consumes a managed allowance, and only when this will actually use managed
  // (server-key) AI rather than the caller's own BYOK key.
  if (!opts.resume && willUseManagedAi()) {
    await reservePlanGeneration(draft.totalDays, signal);
  }

  const meta = draftToPlanRequest(draft);
  const domainIds = draft.domains.map((d) => d.id);
  const exclusions = meta.exclusions || [];
  const planId = createPlanId();

  const progress: GenProgress = {
    phase: "outline",
    periodIndex: 0,
    periodTotal: 0,
    message: "Requesting outline…",
    topicsSoFar: [],
    failedPeriods: opts.resume?.failedPeriods || [],
    days: opts.resume?.days ? [...opts.resume.days] : [],
    outline: opts.resume?.outline,
  };
  const emit = () => onProgress?.({ ...progress, topicsSoFar: [...progress.topicsSoFar], days: [...progress.days] });

  let outline = opts.resume?.outline;
  if (!outline) {
    emit();
    const skeleton = skeletonOutlinePeriods(draft.totalDays, draft.grouping);
    const rawOutline = await fetchOutline(draft, meta, skeleton, signal, telemetry);
    outline = snapOutlineToSkeleton(rawOutline, skeleton);
    progress.outline = outline;
  }

  progress.phase = "periods";
  progress.periodTotal = outline.length;
  progress.message = `Outline ready · ${outline.length} periods`;
  emit();

  const seen = new Set(progress.days.flatMap((d) => d.topics.map(normalizeTopic)));
  progress.topicsSoFar = progress.days.flatMap((d) => d.topics);

  const startIdx = opts.resume?.periodIndex ?? 0;
  const concurrency = generationConcurrency();
  for (let i = startIdx; i < outline.length; i += concurrency) {
    if (signal?.aborted) {
      progress.phase = "cancelled";
      progress.message = "Cancelled";
      progress.periodIndex = i;
      emit();
      throw new DOMException("Aborted", "AbortError");
    }

    const batch = outline.slice(i, Math.min(i + concurrency, outline.length));
    const topicsSnapshot = [...progress.topicsSoFar];
    progress.periodIndex = i;
    progress.message =
      batch.length === 1
        ? `Period ${i + 1} of ${outline.length}: ${batch[0].label}`
        : `Periods ${i + 1}–${i + batch.length} of ${outline.length}`;
    emit();

    const rawBatches = await Promise.all(
      batch.map((period) =>
        fetchPeriodDays({
          draft,
          meta,
          period,
          topicsSoFar: topicsSnapshot,
          signal,
          telemetry,
        }),
      ),
    );

    for (let j = 0; j < batch.length; j++) {
      const period = batch[j];
      const periodIndex = i + j;
      progress.periodIndex = periodIndex;

      let rawDays = rawBatches[j];
      let validated = validatePeriodDays({
        days: rawDays,
        period,
        topicsPerDay: draft.topicsPerDay,
        exclusions,
        seenTopics: seen,
        domainIds,
      });

      if (shouldRetryPeriod(validated.issues, period) && !signal?.aborted) {
        progress.message = `Retrying ${period.label}…`;
        emit();
        rawDays = await fetchPeriodDays({
          draft,
          meta,
          period,
          topicsSoFar: progress.topicsSoFar,
          violations: validated.issues,
          signal,
          telemetry,
        });
        validated = validatePeriodDays({
          days: rawDays,
          period,
          topicsPerDay: draft.topicsPerDay,
          exclusions,
          seenTopics: seen,
          domainIds,
        });
      }

      if (shouldRetryPeriod(validated.issues, period)) {
        progress.failedPeriods.push(periodIndex);
        progress.message = `Period ${period.label} needs attention (${validated.issues.length} issues)`;
      }

      const stamped = validated.fixedDays.map((d) => ({ ...d, id: `${planId}:${d.day}` }));
      for (const d of stamped) {
        if (!progress.days.some((x) => x.day === d.day)) {
          progress.days.push(d);
          d.topics.forEach((t) => {
            const k = normalizeTopic(t);
            if (!seen.has(k)) {
              seen.add(k);
              progress.topicsSoFar.push(t);
            }
          });
        }
      }
      emit();
    }
  }

  progress.days.sort((a, b) => a.day - b.day);
  progress.days = ensureContiguousDays({
    days: progress.days,
    totalDays: draft.totalDays,
    topicsPerDay: draft.topicsPerDay,
    domainIds,
    planId,
  });
  const hasPlaceholders = progress.days.some((d) =>
    d.topics.some((t) => /needs review/i.test(t)),
  );

  progress.phase = "done";
  progress.message = progress.failedPeriods.length || hasPlaceholders
    ? `Done — ${draft.totalDays} days ready; review any placeholder topics`
    : "Generation complete";
  emit();

  const periodScopes = buildPeriodScopes(draft.totalDays, draft.grouping);
  // Prefer model outline themes on the primary navigable scope
  const primary =
    periodScopes.find((s) => s.key === "week") ||
    periodScopes.find((s) => s.key === "month") ||
    null;
  if (primary && outline.length) {
    primary.periods = outline.map((p) => ({
      label: p.label,
      sub: p.theme,
      start: p.start,
      end: p.end,
    }));
  }

  return {
    plan: {
      id: planId,
      routeSlug: createPlanRouteSlug(draft.name.trim() || "CUSTOM PLAN", planId),
      name: draft.name.trim() || "CUSTOM PLAN",
      subtitle: draft.subtitle.trim() || `${draft.totalDays}-day custom campaign`,
      builtin: false,
      createdAt: Date.now(),
      totalDays: draft.totalDays,
      topicsPerDay: draft.topicsPerDay,
      accentRole: "auto",
      periodScopes,
      days: progress.days,
      meta,
      status: progress.failedPeriods.length || hasPlaceholders ? "draft" : "ready",
    },
    telemetry,
    totalPeriods: outline.length,
    failedPeriods: progress.failedPeriods.length,
    placeholderDays: progress.days.filter((d) =>
      d.topics.some((t) => /needs review/i.test(t)),
    ).length,
  };
}

async function fetchOutline(
  draft: BuilderDraft,
  meta: PlanRequest,
  skeleton: OutlinePeriod[],
  signal?: AbortSignal,
  telemetry?: GenerationTelemetry,
): Promise<OutlinePeriod[]> {
  const bounds = skeleton
    .map((p) => `- ${p.label}: days ${p.start}-${p.end}`)
    .join("\n");

  const personaInstruction =
    meta.persona === "academic"
      ? "Pedagogical Tone: Academic & First-Principles (rigorous foundations, formal concepts, paper/spec depth)."
      : meta.persona === "quest"
      ? "Pedagogical Tone: Quest Master (immersive mission titles, milestone challenges, gamified progression)."
      : "Pedagogical Tone: Tactical Bootcamp (concise, high-intensity, practical application).";

  const pacingInstruction =
    meta.pacingProfile === "micro"
      ? "Target daily time: ~15 mins per day (light cognitive load)."
      : meta.pacingProfile === "deep"
      ? "Target daily time: ~90 mins per day (heavy cognitive load)."
      : "Target daily time: ~45 mins per day (medium cognitive load).";

  const prompt = `Produce a learning-plan OUTLINE only — themes, capstone project, and domain mix for fixed periods. No day topics.

Plan
- Name: ${draft.name}
- Total days: ${draft.totalDays}
- Grouping preference: ${draft.grouping}
- Goal: ${meta.goal}
- Learner level: ${meta.level || "unspecified"}
- ${personaInstruction}
- ${pacingInstruction}

Domains (use these exact ids in domainMix)
${domainCatalog(draft)}
${meta.mustInclude?.length ? `\nMust-include topics — assign each to the period where it fits best:\n${meta.mustInclude.map((m) => `- ${m}`).join("\n")}` : ""}
${meta.exclusions?.length ? `\nNever cover:\n${meta.exclusions.map((e) => `- ${e}`).join("\n")}` : ""}

Use EXACTLY these period boundaries (same labels, start, and end — do not change them):
${bounds}

Rules
- Return one period object per boundary row, keeping exact labels, start, and end days.
- Pedagogical Arc: Structure themes sequentially (Foundations -> Applied Mechanics -> System Synthesis & Edge Cases).
- Milestone Capstones: Provide a concrete, hands-on capstone project for each period that tests the period's core objectives.
- Domain Allocation: Order domainMix IDs by emphasis for that period.
- Do not use double-quote characters inside label, theme, or capstone text.`;

  const parsed = await chatStructured({
    system: PLAN_SYSTEM,
    prompt,
    maxTokens: 2000,
    temperature: 0.2,
    signal,
    kind: "plan",
    schema: outlineSchema,
    structured: {
      name: "submit_outline",
      description: "Submit the learning-plan outline periods.",
      schema: OUTLINE_JSON_SCHEMA as unknown as Record<string, unknown>,
    },
    parse: parseJsonWithRepair,
    repairPrompt: (error, bad) =>
      `Fix this into valid JSON matching {"periods":[{"label":"string","theme":"string","start":1,"end":7,"capstone":"string","domainMix":["id"]}]}.
domainMix and capstone are optional. Use double quotes only for JSON syntax — never inside string values. No trailing commas. No markdown.
Parser error: ${error}
Broken input:
${bad.slice(0, 6000)}
Return corrected JSON only.`,
    telemetry,
  });
  return Array.isArray(parsed?.periods) ? parsed.periods : Array.isArray(parsed) ? parsed : [];
}

async function fetchPeriodDays(opts: {
  draft: BuilderDraft;
  meta: PlanRequest;
  period: OutlinePeriod;
  topicsSoFar: string[];
  violations?: PeriodValidationIssue[];
  signal?: AbortSignal;
  telemetry?: GenerationTelemetry;
}): Promise<Array<{ day: number; topics: string[]; domains?: string[]; deliverable?: string; estimatedMinutes?: number; cognitiveLoad?: "light" | "medium" | "heavy" }>> {
  const { draft, meta, period, topicsSoFar, violations, signal, telemetry } = opts;
  const dayCount = period.end - period.start + 1;
  // Tight cap to reduce latency and output token overhead on OpenRouter models.
  const maxTokens = Math.min(1800, Math.max(500, 200 + dayCount * draft.topicsPerDay * 45));
  const pending = (meta.mustInclude || []).filter(
    (m) => !topicsSoFar.some((t) => normalizeTopic(t).includes(normalizeTopic(m))),
  );

  const personaInstruction =
    meta.persona === "academic"
      ? "Pedagogical Tone: Academic & First-Principles (rigorous foundations, formal concepts)."
      : meta.persona === "quest"
      ? "Pedagogical Tone: Quest Master (immersive mission titles, gamified objective)."
      : "Pedagogical Tone: Tactical Bootcamp (concise, high-intensity, practical).";

  const pacingTarget =
    meta.pacingProfile === "micro"
      ? "15 mins (light load)"
      : meta.pacingProfile === "deep"
      ? "90 mins (heavy load)"
      : "45 mins (medium load)";

  const prompt = `Generate the daily topics for one period of an existing plan.

Period: ${period.label}, days ${period.start}-${period.end} (${dayCount} days)
Theme: ${period.theme}
Plan goal: ${meta.goal}
Learner level: ${meta.level || "unspecified"}
${personaInstruction}
Pacing Profile Target: ${pacingTarget}

Domains — tag every topic with exactly one of these ids
${domainCatalog(draft)}
${period.domainMix?.length ? `\nThis period should draw mainly from, in order of emphasis: ${period.domainMix.join(", ")}` : ""}

Topic rules
- Exactly ${dayCount} day objects, numbered with ABSOLUTE day numbers ${period.start} through ${period.end} (not 1..${dayCount}).
- Exactly ${draft.topicsPerDay} topics per day, each 2–10 words.
- Include a "deliverable" string per day (a specific hands-on task/exercise for applying the topics).
- Include "estimatedMinutes" (number, e.g. 15, 30, 45, 60, 90) and "cognitiveLoad" ("light" | "medium" | "heavy").
- Each topic names one specific mechanism, technique, or concept — something you could write a quiz question about.
- No filler: never Review, Recap, Catch-up, Rest day, Practice session, Introduction to X, Overview of X, Deep dive into X, or X basics.
- Never use placeholder labels like Topic A, Topic B, Example topic, or Sample topic.
- Never include HTML, XML, or markup characters (< > /) inside topic text.
- No duplicates of already-covered topics (rephrasing counts).
- Prerequisites before dependents within the period.
- Do not use double-quote characters inside topic or deliverable text. Prefer parentheses for acronyms, e.g. Remote Procedure Call (RPC).
${pending.length ? `\nStill unplaced must-include topics — work these in if this period fits:\n${pending.map((m) => `- ${m}`).join("\n")}` : ""}
${meta.exclusions?.length ? `\nNever cover:\n${meta.exclusions.map((e) => `- ${e}`).join("\n")}` : ""}

Already covered (do not repeat):
${topicIndex(topicsSoFar, 18)}

Example specificity (do not reuse):
day 8: Raft leader election and terms; Write-ahead log fsync tradeoffs
deliverable: Implement leader lease expiration timer in state machine
estimatedMinutes: 45
cognitiveLoad: medium
${violations?.length ? `\nPrevious attempt rejected — fix every issue:\n${violations.map((v) => v.message).join("\n")}` : ""}`;

  const parsed = await chatStructured({
    system: PLAN_SYSTEM,
    prompt,
    maxTokens,
    temperature: 0.15,
    signal,
    kind: "plan",
    schema: periodDaysSchema,
    structured: {
      name: "submit_period_days",
      description: "Submit the daily topics for this period.",
      schema: PERIOD_DAYS_JSON_SCHEMA as unknown as Record<string, unknown>,
    },
    parse: parseJsonWithRepair,
    repairPrompt: (error, bad) =>
      `Fix this into valid JSON matching {"days":[{"day":15,"topics":["Working memory capacity limits","Cognitive load theory basics"],"deliverable":"Map cognitive load drivers","estimatedMinutes":45,"cognitiveLoad":"medium","domains":["cognitive-sci"]}]}.
Use real, specific topic phrases — never placeholders like "Topic A" or "Topic B". Never include HTML or markup characters (< > /).
domains, deliverable, estimatedMinutes, cognitiveLoad are optional. Use double quotes only for JSON syntax — never inside strings. No trailing commas. No markdown.
Parser error: ${error}
Broken input:
${bad.slice(0, 8000)}
Return corrected JSON only.`,
    telemetry,
  });
  return Array.isArray(parsed?.days) ? parsed.days : Array.isArray(parsed) ? parsed : [];
}

/** Persist/resume helpers for draft generation state. */
const DRAFT_GEN_KEY = "dualtrack:gen-draft";

export type PersistedGenDraft = {
  draft: BuilderDraft;
  progress: GenProgress;
  planId?: string;
  updatedAt: number;
};

export function saveGenDraft(state: PersistedGenDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_GEN_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function loadGenDraft(): PersistedGenDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_GEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedGenDraft;
  } catch {
    return null;
  }
}

export function clearGenDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_GEN_KEY);
  } catch { /* ignore */ }
}
