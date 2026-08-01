import { z } from "zod";
import type {
  AppSnapshot,
  LearnedMap,
  BookmarksList,
  LogEntry,
  NotesMap,
  Plan,
  PlansState,
  ProgressMap,
  RefsMap,
  SrsMap,
  ThemeKey,
  UserDataState,
} from "@/lib/types";
import { createPlanId } from "@/lib/planGeneration";
import { migrateUserData } from "@/lib/migration";
import { sanitizeLearned } from "@/lib/learned";
import { mergeBookmarks, sanitizeBookmarks } from "@/lib/bookmarks";
import { seedBuiltinPlans } from "@/data/builtinPlans";
import { DEFAULT_THEME_KEY, resolveThemeKey } from "@/theme/themes";
import { DEFAULT_FONT_KEY, resolveFontKey } from "@/theme/fonts";
import {
  assertNoCredentialsInExport,
  getCredentials,
  stripCredentialsFromObject,
} from "@/lib/providers/credentials";
import { BUILTIN_365_ID, SCHEMA_VERSION } from "@/lib/types";

export type PlanShareFile = {
  app: "dualtrack";
  kind: "dualtrack-plan";
  version: number;
  schemaVersion: number;
  exportedAt: string;
  plan: Plan;
};

export type FullBackupFile = {
  app: "dualtrack";
  kind: "dualtrack-full";
  version: number;
  schemaVersion: number;
  exportedAt: string;
  progress: ProgressMap;
  notes: NotesMap;
  refs: RefsMap;
  srs: SrsMap;
  log: LogEntry[];
  learned?: LearnedMap;
  bookmarks?: BookmarksList;
  themeKey?: ThemeKey;
  plans: PlansState;
  activePlanId?: string;
};

export type DetectedImport =
  | { kind: "dualtrack-plan"; plan: Plan }
  | { kind: "dualtrack-full"; backup: FullBackupFile };

export type ImportMode = "merge" | "replace";

export type AppDataSlice = {
  plans: PlansState;
  progress: ProgressMap;
  notes: NotesMap;
  refs: RefsMap;
  srs: SrsMap;
  log: LogEntry[];
  learned: LearnedMap;
  bookmarks: BookmarksList;
  themeKey: ThemeKey;
  activePlanId: string;
};

function isoNow(): string {
  return new Date().toISOString();
}

/** Rewrite day ids when a plan gets a new id. */
export function remintPlanIds(plan: Plan, newId?: string): Plan {
  const id = newId || createPlanId();
  return {
    ...plan,
    id,
    builtin: false,
    hidden: false,
    days: plan.days.map((d) => ({
      ...d,
      id: `${id}:${d.day}`,
      topics: [...d.topics],
      domains: [...d.domains],
    })),
  };
}

export function exportPlan(plan: Plan): PlanShareFile {
  const cleaned = stripCredentialsFromObject({
    app: "dualtrack" as const,
    kind: "dualtrack-plan" as const,
    version: SCHEMA_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: isoNow(),
    plan: {
      ...plan,
      // share definition only — strip UI-only flags that shouldn't travel
      hidden: undefined,
    },
  });
  return cleaned as PlanShareFile;
}

export function exportAll(slice: {
  plans: PlansState;
  userdata: UserDataState;
  themeKey: ThemeKey;
  activePlanId?: string;
}): FullBackupFile {
  const payload = stripCredentialsFromObject({
    app: "dualtrack" as const,
    kind: "dualtrack-full" as const,
    version: SCHEMA_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: isoNow(),
    progress: slice.userdata.progress,
    notes: slice.userdata.notes,
    refs: slice.userdata.refs,
    srs: slice.userdata.srs,
    log: slice.userdata.log,
    learned: slice.userdata.learned || {},
    bookmarks: slice.userdata.bookmarks || [],
    themeKey: slice.themeKey,
    plans: slice.plans,
    activePlanId: slice.activePlanId,
  });
  return payload as FullBackupFile;
}

export function serializeExport(payload: PlanShareFile | FullBackupFile): string {
  const js = JSON.stringify(payload, null, 2);
  assertNoCredentialsInExport(js, getCredentials().apiKey);
  return js;
}

// --- Import validation -------------------------------------------------
// Structural fields (ids, days, counts) are validated strictly; cosmetic
// fields fall back to safe defaults so old or hand-edited files still load.

const topicResourceSchema = z
  .object({
    url: z.string().min(1),
    title: z.string().catch(""),
    snippet: z.string().optional().catch(undefined),
    kind: z.enum(["article", "video"]).optional().catch(undefined),
  })
  .nullable();

const topicResourcePairSchema = z
  .object({
    article: topicResourceSchema.optional().catch(undefined),
    video: topicResourceSchema.optional().catch(undefined),
  })
  .or(topicResourceSchema);

const planDaySchema = z.object({
  day: z.number().int().positive(),
  id: z.string().optional(),
  topics: z.array(z.string()).catch([]),
  domains: z.array(z.string()).catch([]),
  resources: z.array(topicResourcePairSchema.nullable()).optional().catch(undefined),
});

const planPeriodSchema = z.object({
  label: z.string(),
  sub: z.string().catch(""),
  start: z.number(),
  end: z.number(),
});

const planSchema = z.object({
  id: z.string().min(1),
  routeSlug: z.string().min(1).optional().catch(undefined),
  name: z.string().min(1),
  subtitle: z.string().catch(""),
  builtin: z.boolean().catch(false),
  createdAt: z.number().catch(() => Date.now()),
  totalDays: z.number().int().positive(),
  topicsPerDay: z.number().int().positive(),
  accentRole: z.enum(["main", "sprint", "auto"]).catch("auto"),
  periodScopes: z
    .array(z.object({ key: z.string(), label: z.string(), periods: z.array(planPeriodSchema) }))
    .catch([]),
  days: z.array(planDaySchema),
  meta: z.record(z.string(), z.unknown()).catch({}),
  status: z.enum(["draft", "ready"]).optional().catch(undefined),
  hidden: z.boolean().optional().catch(undefined),
});

const progressEntrySchema = z.record(z.string(), z.boolean());
const noteEntrySchema = z.string();
const refEntrySchema = z.object({
  text: z.string(),
  topic: z.string().catch(""),
  style: z.string().catch(""),
  at: z.number().catch(0),
});
const srsEntrySchema = z.object({
  idx: z.number().catch(0),
  due: z.number().nullable().catch(null),
  graduated: z.boolean().catch(false),
  reps: z.number().catch(0),
  last: z.number().catch(0),
});
const logEntrySchema = z.object({ d: z.string(), i: z.number(), at: z.number() });

/** Keep entries that parse; silently drop corrupt ones instead of rejecting the whole file. */
function sanitizeRecord<T>(raw: unknown, schema: z.ZodType<T>): Record<string, T> {
  const out: Record<string, T> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = schema.safeParse(value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out;
}

function sanitizeLog(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LogEntry[] = [];
  for (const entry of raw) {
    const parsed = logEntrySchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function parsePlan(raw: unknown): Plan | null {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  return {
    ...p,
    days: p.days.map((d) => ({
      ...d,
      id: d.id || `${p.id}:${d.day}`,
    })),
  } as Plan;
}

function sanitizePlans(raw: unknown): PlansState {
  const out: PlansState = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const value of Object.values(raw as Record<string, unknown>)) {
    const plan = parsePlan(value);
    if (plan) out[plan.id] = plan;
  }
  return out;
}

/**
 * Normalize an account cloud snapshot for persistence. Drops corrupt entries
 * instead of rejecting the whole document (same spirit as import sanitizers).
 */
export function sanitizeAppSnapshot(raw: unknown): AppSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const metaRaw =
    data.meta && typeof data.meta === "object" && !Array.isArray(data.meta)
      ? (data.meta as Record<string, unknown>)
      : {};
  const userdataRaw =
    data.userdata && typeof data.userdata === "object" && !Array.isArray(data.userdata)
      ? (data.userdata as Record<string, unknown>)
      : null;
  if (!userdataRaw) return null;

  const userdata = migrateUserData({
    progress: sanitizeRecord(userdataRaw.progress, progressEntrySchema) as ProgressMap,
    notes: sanitizeRecord(userdataRaw.notes, noteEntrySchema) as NotesMap,
    refs: sanitizeRecord(userdataRaw.refs, refEntrySchema) as RefsMap,
    srs: sanitizeRecord(userdataRaw.srs, srsEntrySchema) as SrsMap,
    log: sanitizeLog(userdataRaw.log),
    learned: sanitizeLearned(userdataRaw.learned),
    bookmarks: sanitizeBookmarks(userdataRaw.bookmarks),
  });

  const plans = sanitizePlans(data.plans);
  const hiddenPlanIds = Array.isArray(metaRaw.hiddenPlanIds)
    ? metaRaw.hiddenPlanIds.filter((id): id is string => typeof id === "string").slice(0, 200)
    : [];

  const activePlanId =
    typeof metaRaw.activePlanId === "string" && metaRaw.activePlanId
      ? metaRaw.activePlanId
      : BUILTIN_365_ID;

  return {
    meta: {
      schemaVersion:
        typeof metaRaw.schemaVersion === "number" ? metaRaw.schemaVersion : SCHEMA_VERSION,
      activePlanId,
      themeKey: metaRaw.themeKey != null ? resolveThemeKey(metaRaw.themeKey) : DEFAULT_THEME_KEY,
      fontKey: metaRaw.fontKey != null ? resolveFontKey(metaRaw.fontKey) : DEFAULT_FONT_KEY,
      hiddenPlanIds,
      updatedAt: typeof metaRaw.updatedAt === "number" ? metaRaw.updatedAt : Date.now(),
    },
    plans,
    userdata,
  };
}

/** Detect import kind from a parsed JSON blob. */
export function detectImport(raw: unknown): DetectedImport {
  if (!raw || typeof raw !== "object") {
    throw new Error("Not a Refrainly backup file");
  }
  const data = raw as Record<string, unknown>;

  if (data.kind === "dualtrack-plan" || (data.plan && !data.progress && !data.notes)) {
    const plan = parsePlan(data.plan);
    if (!plan) throw new Error("Plan share is missing a valid plan");
    return { kind: "dualtrack-plan", plan };
  }

  const hasUser =
    data.progress || data.notes || data.refs || data.srs || data.log || data.learned || data.bookmarks || data.plans;
  if (!hasUser && data.kind !== "dualtrack-full") {
    throw new Error("No progress, notes, or plans found in that file");
  }

  const userdata = migrateUserData({
    progress: sanitizeRecord(data.progress, progressEntrySchema) as ProgressMap,
    notes: sanitizeRecord(data.notes, noteEntrySchema) as NotesMap,
    refs: sanitizeRecord(data.refs, refEntrySchema) as RefsMap,
    srs: sanitizeRecord(data.srs, srsEntrySchema) as SrsMap,
    log: sanitizeLog(data.log),
    learned: sanitizeLearned(data.learned),
    bookmarks: sanitizeBookmarks(data.bookmarks),
  });

  const plans: PlansState = sanitizePlans(data.plans);

  return {
    kind: "dualtrack-full",
    backup: {
      app: "dualtrack",
      kind: "dualtrack-full",
      version: typeof data.version === "number" ? data.version : SCHEMA_VERSION,
      schemaVersion:
        typeof data.schemaVersion === "number" ? data.schemaVersion : SCHEMA_VERSION,
      exportedAt:
        typeof data.exportedAt === "string" ? data.exportedAt : isoNow(),
      progress: userdata.progress,
      notes: userdata.notes,
      refs: userdata.refs,
      srs: userdata.srs,
      log: userdata.log,
      learned: userdata.learned,
      bookmarks: userdata.bookmarks,
      themeKey: data.themeKey != null ? resolveThemeKey(data.themeKey) : undefined,
      plans,
      activePlanId:
        typeof data.activePlanId === "string" ? data.activePlanId : undefined,
    },
  };
}

/** Add a shared plan; remint id on collision so existing data stays intact. */
export function applyPlanImport(
  existingPlans: PlansState,
  incoming: Plan,
): { plans: PlansState; plan: Plan } {
  let plan = {
    ...incoming,
    builtin: false,
    status: incoming.status || "ready",
  } as Plan;

  if (existingPlans[plan.id]) {
    plan = remintPlanIds(plan);
  } else {
    // ensure day ids match plan id prefix
    plan = {
      ...plan,
      days: plan.days.map((d) => ({
        ...d,
        id: d.id?.startsWith(`${plan.id}:`) ? d.id : `${plan.id}:${d.day}`,
      })),
    };
  }

  return {
    plans: { ...existingPlans, [plan.id]: plan },
    plan,
  };
}

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  return { ...a, ...b };
}

export function applyFullImport(
  current: AppDataSlice,
  backup: FullBackupFile,
  mode: ImportMode,
): AppDataSlice {
  if (mode === "replace") {
    const builtins = seedBuiltinPlans();
    const plans = { ...builtins, ...(backup.plans || {}) };
    const activePlanId =
      backup.activePlanId && plans[backup.activePlanId]
        ? backup.activePlanId
        : current.activePlanId in plans
          ? current.activePlanId
          : Object.keys(plans)[0];
    return {
      plans,
      progress: backup.progress || {},
      notes: backup.notes || {},
      refs: backup.refs || {},
      srs: backup.srs || {},
      log: Array.isArray(backup.log) ? backup.log : [],
      learned: backup.learned || {},
      bookmarks: backup.bookmarks || [],
      themeKey: resolveThemeKey(backup.themeKey || current.themeKey),
      activePlanId,
    };
  }

  // merge
  const plans = { ...current.plans, ...(backup.plans || {}) };
  return {
    plans,
    progress: mergeRecords(current.progress, backup.progress || {}),
    notes: mergeRecords(current.notes, backup.notes || {}),
    refs: mergeRecords(current.refs, backup.refs || {}),
    srs: mergeRecords(current.srs, backup.srs || {}),
    log: [...current.log, ...(Array.isArray(backup.log) ? backup.log : [])],
    learned: mergeLearned(current.learned || {}, backup.learned || {}),
    bookmarks: mergeBookmarks(current.bookmarks || [], backup.bookmarks || []),
    themeKey: resolveThemeKey(backup.themeKey || current.themeKey),
    activePlanId:
      backup.activePlanId && plans[backup.activePlanId]
        ? backup.activePlanId
        : current.activePlanId,
  };
}

function mergeLearned(a: LearnedMap, b: LearnedMap): LearnedMap {
  const out: LearnedMap = { ...a };
  for (const [date, items] of Object.entries(b)) {
    const existing = out[date] || [];
    const seen = new Set(existing.map((x) => x.id));
    const merged = [...existing];
    for (const item of items) {
      if (!seen.has(item.id)) {
        merged.push(item);
        seen.add(item.id);
      }
    }
    out[date] = merged;
  }
  return out;
}
