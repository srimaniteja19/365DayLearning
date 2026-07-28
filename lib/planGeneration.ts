import { z } from "zod";
import { sanitizeJsonText } from "@/lib/stripFences";
import { chatStructured, willUseManagedAi } from "@/lib/claude-client";
import { reservePlanGeneration } from "@/lib/subscriptions";
import {
  buildPeriodScopes,
  draftToPlanRequest,
  type BuilderDraft,
} from "@/lib/planBuilder";
import type { Plan, PlanDay, PlanRequest } from "@/lib/types";
import { ContentError } from "@/lib/providers/errors";

export const outlinePeriodSchema = z.object({
  label: z.string().min(1),
  theme: z.string().min(1),
  start: z.number().int().positive(),
  end: z.number().int().positive(),
  domainMix: z.array(z.string()).optional(),
});

export const outlineSchema = z.object({
  periods: z.array(outlinePeriodSchema).min(1),
});

export const generatedDaySchema = z.object({
  day: z.number().int().positive(),
  topics: z.array(z.string().min(1)).min(1),
  domains: z.array(z.string()).optional(),
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
  if (!periods.length) return ["Outline has no periods."];
  const sorted = [...periods].sort((a, b) => a.start - b.start);
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

function wordCount(topic: string): number {
  return topic.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeTopic(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
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
export function alignDaysToPeriod(
  days: RawGenDay[],
  period: OutlinePeriod,
): RawGenDay[] {
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
    let s = topics[i]?.trim() || "";
    if (!s) {
      nextTopics.push(placeholderTopic(dayNum, nextTopics.length));
      padded = true;
      continue;
    }
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      s = `${s} core concepts`;
      padded = true;
    } else if (words.length > 10) {
      s = words.slice(0, 10).join(" ");
      padded = true;
    }
    nextTopics.push(s);
  }
  while (nextTopics.length < topicsPerDay) {
    nextTopics.push(placeholderTopic(dayNum, nextTopics.length));
    padded = true;
  }
  const trimmedTopics = nextTopics.slice(0, topicsPerDay);
  const nextDomains = domains.map((d) => d.trim());
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
  const tryParse = (text: string): T => {
    const cleaned = sanitizeJsonText(text);
    const data = JSON.parse(cleaned) as unknown;
    return schema.parse(data);
  };

  try {
    return tryParse(raw);
  } catch (first) {
    const msg = first instanceof Error ? first.message : String(first);
    const seed = sanitizeJsonText(raw);
    let repaired: string;
    try {
      repaired = await repair(msg, seed || raw);
    } catch {
      throw new ContentError(
        `Could not parse the AI response as JSON (${msg}). Try again.`,
      );
    }
    try {
      return tryParse(repaired);
    } catch (second) {
      // One more local pass in case the repair model added fences/prose
      // but left fixable comma issues.
      try {
        return tryParse(sanitizeJsonText(repaired));
      } catch {
        const detail = second instanceof Error ? second.message : "JSON repair failed.";
        throw new ContentError(
          `Could not parse the AI response as JSON (${detail}). Try again.`,
        );
      }
    }
  }
}

const PLAN_SYSTEM = `You are a senior curriculum designer who builds daily technical learning plans for working engineers.
Every topic you write names one specific, teachable concept that someone can study in a single sitting and be quizzed on afterward.
Never put double-quote characters inside label, theme, or topic text — use plain words only (write RPC not "RPC").
When a structured tool is available, call it. Otherwise reply with a single strict JSON object and nothing else.`;

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
export function topicIndex(topics: string[], recentMax = 150): string {
  if (!topics.length) return "(none yet — this is the first period)";
  const recent = topics.slice(-recentMax);
  const older = topics.slice(0, Math.max(0, topics.length - recentMax));
  const parts = [
    `Most recent ${recent.length} topics, verbatim — do not repeat or rephrase any of these:`,
    ...recent.map((t) => `- ${t}`),
  ];
  if (older.length) {
    const keywords = Array.from(
      new Set(
        older.flatMap((t) => t.toLowerCase().match(/[a-z][a-z0-9+.#-]{2,}/g) || []),
      ),
    ).filter((w) => !INDEX_STOPWORDS.has(w));
    parts.push(
      "",
      `The earlier ${older.length} topics already covered these subjects — do not revisit them:`,
      keywords.join(", "),
    );
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

export async function generatePlan(opts: GeneratePlanOptions): Promise<Plan> {
  const { draft, signal, onProgress } = opts;

  // Only the first attempt at a plan (not a resume of an interrupted one)
  // consumes a monthly slot, and only when this will actually use managed
  // (server-key) AI rather than the caller's own BYOK key.
  if (!opts.resume && willUseManagedAi()) {
    await reservePlanGeneration(signal);
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
    outline = await fetchOutline(draft, meta, domainIds, signal);
    const tileErrors = validateOutlineTiles(outline, draft.totalDays);
    if (tileErrors.length) {
      // one repair pass with violations
      outline = await fetchOutline(draft, meta, domainIds, signal, tileErrors);
      const again = validateOutlineTiles(outline, draft.totalDays);
      if (again.length) {
        progress.phase = "error";
        progress.message = again.join(" ");
        emit();
        throw new ContentError(again.join(" "));
      }
    }
    progress.outline = outline;
  }

  progress.phase = "periods";
  progress.periodTotal = outline.length;
  progress.message = `Outline ready · ${outline.length} periods`;
  emit();

  const seen = new Set(progress.days.flatMap((d) => d.topics.map(normalizeTopic)));
  progress.topicsSoFar = progress.days.flatMap((d) => d.topics);

  const startIdx = opts.resume?.periodIndex ?? 0;
  for (let i = startIdx; i < outline.length; i++) {
    if (signal?.aborted) {
      progress.phase = "cancelled";
      progress.message = "Cancelled";
      progress.periodIndex = i;
      emit();
      throw new DOMException("Aborted", "AbortError");
    }

    const period = outline[i];
    progress.periodIndex = i;
    progress.message = `Period ${i + 1} of ${outline.length}: ${period.label}`;
    emit();

    let ok = false;
    let lastIssues: PeriodValidationIssue[] = [];
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      const rawDays = await fetchPeriodDays({
        draft,
        meta,
        period,
        topicsSoFar: progress.topicsSoFar,
        violations: attempt === 0 ? undefined : lastIssues,
        signal,
      });
      const { issues, fixedDays, newTopics } = validatePeriodDays({
        days: rawDays,
        period,
        topicsPerDay: draft.topicsPerDay,
        exclusions,
        seenTopics: seen,
        domainIds,
      });
      if (issues.length === 0) {
        const stamped = fixedDays.map((d) => ({ ...d, id: `${planId}:${d.day}` }));
        progress.days.push(...stamped);
        newTopics.forEach((t) => {
          seen.add(normalizeTopic(t));
          progress.topicsSoFar.push(t);
        });
        ok = true;
      } else {
        lastIssues = issues;
        if (attempt === 1) {
          progress.failedPeriods.push(i);
          // accept best-effort stamped days so user can edit later
          const stamped = fixedDays.map((d) => ({ ...d, id: `${planId}:${d.day}` }));
          // only add days not already present
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
          progress.message = `Period ${period.label} needs attention (${issues.length} issues)`;
          emit();
        }
      }
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
    id: planId,
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
  };
}

async function fetchOutline(
  draft: BuilderDraft,
  meta: PlanRequest,
  domainIds: string[],
  signal?: AbortSignal,
  priorErrors?: string[],
): Promise<OutlinePeriod[]> {
  const prompt = `Produce a learning-plan OUTLINE only — period boundaries and themes, no day topics yet.

Plan
- Name: ${draft.name}
- Total days: ${draft.totalDays}
- Grouping preference: ${draft.grouping}
- Goal: ${meta.goal}
- Learner level: ${meta.level || "unspecified"}

Domains (use these exact ids in domainMix)
${domainCatalog(draft)}
${meta.mustInclude?.length ? `\nMust-include topics — assign each to the period where it fits best:\n${meta.mustInclude.map((m) => `- ${m}`).join("\n")}` : ""}
${meta.exclusions?.length ? `\nNever cover:\n${meta.exclusions.map((e) => `- ${e}`).join("\n")}` : ""}

Rules
- Periods must tile days 1..${draft.totalDays} exactly: first starts at 1, last ends at ${draft.totalDays}, no gaps, no overlaps.
- Match the grouping preference: weekly means ~7-day periods, monthly ~30, quarterly ~90.
- Themes must show progression — foundations first, then things that depend on them, then applied or advanced work.
- domainMix lists the domain ids that period should draw from, ordered by how much time they get. Respect the emphasis levels above across the plan as a whole.
- Do not use double-quote characters inside label or theme text.
${priorErrors?.length ? `\nYour previous outline was rejected:\n${priorErrors.join("\n")}\nReturn a corrected outline.` : ""}`;

  const parsed = await chatStructured({
    system: PLAN_SYSTEM,
    prompt,
    maxTokens: 3500,
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
      `Fix this into valid JSON matching {"periods":[{"label":"string","theme":"string","start":1,"end":7,"domainMix":["id"]}]}.
domainMix is optional. Use double quotes only for JSON syntax — never inside string values. No trailing commas. No markdown.
Parser error: ${error}
Broken input:
${bad.slice(0, 6000)}
Return corrected JSON only.`,
  });
  return parsed.periods;
}

async function fetchPeriodDays(opts: {
  draft: BuilderDraft;
  meta: PlanRequest;
  period: OutlinePeriod;
  topicsSoFar: string[];
  violations?: PeriodValidationIssue[];
  signal?: AbortSignal;
}): Promise<Array<{ day: number; topics: string[]; domains?: string[] }>> {
  const { draft, meta, period, topicsSoFar, violations, signal } = opts;
  const dayCount = period.end - period.start + 1;
  const maxTokens = Math.min(8000, Math.max(2000, 800 + dayCount * draft.topicsPerDay * 80));
  const pending = (meta.mustInclude || []).filter(
    (m) => !topicsSoFar.some((t) => normalizeTopic(t).includes(normalizeTopic(m))),
  );

  const prompt = `Generate the daily topics for one period of an existing plan.

Period: ${period.label}, days ${period.start}-${period.end} (${dayCount} days)
Theme: ${period.theme}
Plan goal: ${meta.goal}
Learner level: ${meta.level || "unspecified"}

Domains — tag every topic with exactly one of these ids
${domainCatalog(draft)}
${period.domainMix?.length ? `\nThis period should draw mainly from, in order of emphasis: ${period.domainMix.join(", ")}` : ""}

Topic rules
- Exactly ${dayCount} day objects, numbered with ABSOLUTE day numbers ${period.start} through ${period.end} (not 1..${dayCount}).
- Exactly ${draft.topicsPerDay} topics per day, each 2–10 words.
- Each topic names one specific mechanism, technique, or concept — something you could write a quiz question about.
- No filler or scaffolding topics. Never emit Review, Recap, Catch-up, Rest day, Practice session, Introduction to X, Overview of X, Deep dive into X, or X basics.
- No duplicates or near-duplicates of anything already covered. Rephrasing an earlier topic counts as a duplicate.
- Within the period, order topics so prerequisites come before whatever depends on them.
- Do not use double-quote characters inside topic text. Prefer parentheses for acronyms, e.g. Remote Procedure Call (RPC).
${pending.length ? `\nStill unplaced must-include topics — work these in here if this period is a sensible home for them:\n${pending.map((m) => `- ${m}`).join("\n")}` : ""}
${meta.exclusions?.length ? `\nNever cover these subjects, including their sub-topics:\n${meta.exclusions.map((e) => `- ${e}`).join("\n")}` : ""}

Already covered
${topicIndex(topicsSoFar)}

Expected granularity — match this level of specificity, but do not reuse these topics:
day 8 topics: Raft leader election and terms; Write-ahead log fsync tradeoffs
day 9 topics: Quorum reads during network partition; Hinted handoff in Dynamo-style stores
${violations?.length ? `\nYour previous attempt was rejected:\n${violations.map((v) => v.message).join("\n")}\nFix every one of these.` : ""}`;

  const parsed = await chatStructured({
    system: PLAN_SYSTEM,
    prompt,
    maxTokens,
    temperature: 0.3,
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
      `Fix this into valid JSON matching {"days":[{"day":1,"topics":["Topic A"],"domains":["ai-ml"]}]}.
domains is optional. Use double quotes only for JSON syntax — never inside topic strings. No trailing commas. No markdown.
Parser error: ${error}
Broken input:
${bad.slice(0, 8000)}
Return corrected JSON only.`,
  });
  return parsed.days;
}

/** Persist/resume helpers for draft generation state. */
export const DRAFT_GEN_KEY = "dualtrack:gen-draft";

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
