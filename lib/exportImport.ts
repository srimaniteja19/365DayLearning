import type {
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
import { seedBuiltinPlans } from "@/data/builtinPlans";
import {
  assertNoCredentialsInExport,
  getCredentials,
  stripCredentialsFromObject,
} from "@/lib/providers/credentials";

export const SCHEMA_VERSION = 3;

export type ExportKind = "dualtrack-plan" | "dualtrack-full";

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

function isPlanLike(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Plan>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    Array.isArray(p.days) &&
    typeof p.totalDays === "number" &&
    typeof p.topicsPerDay === "number"
  );
}

/** Detect import kind from a parsed JSON blob. */
export function detectImport(raw: unknown): DetectedImport {
  if (!raw || typeof raw !== "object") {
    throw new Error("Not a Meridian backup file");
  }
  const data = raw as Record<string, unknown>;

  if (data.kind === "dualtrack-plan" || (data.plan && !data.progress && !data.notes)) {
    if (!isPlanLike(data.plan)) throw new Error("Plan share is missing a valid plan");
    return { kind: "dualtrack-plan", plan: data.plan };
  }

  const hasUser =
    data.progress || data.notes || data.refs || data.srs || data.log || data.plans;
  if (!hasUser && data.kind !== "dualtrack-full") {
    throw new Error("No progress, notes, or plans found in that file");
  }

  const userdata = migrateUserData({
    progress: data.progress as ProgressMap,
    notes: data.notes as NotesMap,
    refs: data.refs as RefsMap,
    srs: data.srs as SrsMap,
    log: data.log as LogEntry[],
  });

  let plans: PlansState = {};
  if (data.plans && typeof data.plans === "object") {
    plans = data.plans as PlansState;
  }

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
      themeKey: data.themeKey as ThemeKey | undefined,
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
      themeKey: backup.themeKey || current.themeKey,
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
    themeKey: backup.themeKey || current.themeKey,
    activePlanId:
      backup.activePlanId && plans[backup.activePlanId]
        ? backup.activePlanId
        : current.activePlanId,
  };
}
