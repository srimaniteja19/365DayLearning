import { getStorageAdapter, type StorageAdapter } from "@/lib/storage/adapter";
import { migrateUserData } from "@/lib/migration";
import { seedBuiltinPlans } from "@/data/builtinPlans";
import {
  BUILTIN_365_ID,
  SCHEMA_VERSION,
  type AppSnapshot,
  type MetaState,
  type PersistedState,
  type PlansState,
  type UserDataState,
} from "@/lib/types";
import { resolveThemeKey } from "@/theme/themes";

export const KEYS = {
  legacy: "dualtrack:state:v1",
  meta: "dualtrack:meta",
  plans: "dualtrack:plans",
  userdata: "dualtrack:userdata",
  credentials: "dualtrack:credentials",
} as const;

function emptyUserData(): UserDataState {
  return { progress: {}, notes: {}, refs: {}, srs: {}, log: [], learned: {} };
}

function defaultMeta(overrides?: Partial<MetaState>): MetaState {
  return {
    schemaVersion: SCHEMA_VERSION,
    activePlanId: BUILTIN_365_ID,
    themeKey: "signal",
    hiddenPlanIds: [],
    ...overrides,
  };
}

/**
 * Refreshes builtin day content for any builtin plan IDs already present in
 * `stored`, and passes custom plans through untouched. Deliberately does
 * *not* inject "OPERATION LONGHAUL"/"OPERATION FASTBURN" for accounts that
 * have never had them (i.e. `stored` is null — brand new, nothing saved
 * yet) — those are offered as opt-in examples in the UI instead. Existing
 * accounts that already reference these IDs keep them exactly as before.
 */
function mergeBuiltinPlans(stored: PlansState | null | undefined): PlansState {
  const seeded = seedBuiltinPlans();
  const merged: PlansState = {};
  if (stored) {
    for (const [id, plan] of Object.entries(stored)) {
      if (!plan || typeof plan !== "object") continue;
      // Always refresh builtin day content from seed; keep hidden flag from stored.
      if (seeded[id]) {
        merged[id] = {
          ...seeded[id],
          hidden: plan.hidden,
        };
      } else {
        merged[id] = plan;
      }
    }
  }
  return merged;
}

async function readJson<T>(adapter: StorageAdapter, key: string): Promise<T | null> {
  try {
    const raw = await adapter.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(adapter: StorageAdapter, key: string, value: unknown): Promise<void> {
  await adapter.set(key, JSON.stringify(value));
}

/**
 * Load app state. Migrates legacy `dualtrack:state:v1` and day-id namespaces once,
 * guarded by `schemaVersion`.
 */
export function needsSchemaMigration(meta: MetaState | null | undefined): boolean {
  return (
    !meta ||
    typeof meta.schemaVersion !== "number" ||
    meta.schemaVersion < SCHEMA_VERSION
  );
}

export async function loadAppSnapshot(): Promise<AppSnapshot | null> {
  const adapter = await getStorageAdapter();
  if (!adapter) return null;

  const metaRaw = await readJson<MetaState>(adapter, KEYS.meta);
  const plansRaw = await readJson<PlansState>(adapter, KEYS.plans);
  const userRaw = await readJson<UserDataState>(adapter, KEYS.userdata);
  const legacy = await readJson<PersistedState>(adapter, KEYS.legacy);

  const needsIdMigration = needsSchemaMigration(metaRaw);

  const meta = defaultMeta(metaRaw || undefined);
  meta.themeKey = resolveThemeKey(meta.themeKey);
  let plans = mergeBuiltinPlans(plansRaw);
  let userdata = userRaw ? { ...emptyUserData(), ...userRaw } : emptyUserData();

  if (legacy && (!userRaw || needsIdMigration)) {
    // Prefer legacy blob when migrating from v1 single-key storage.
    const migrated = migrateUserData(legacy);
    userdata = {
      progress: { ...migrated.progress, ...userdata.progress },
      notes: { ...migrated.notes, ...userdata.notes },
      refs: { ...migrated.refs, ...userdata.refs },
      srs: { ...migrated.srs, ...userdata.srs },
      log: [...migrated.log, ...userdata.log],
      learned: { ...migrated.learned, ...userdata.learned },
    };
    if (legacy.themeKey) {
      meta.themeKey = resolveThemeKey(legacy.themeKey);
    }
  } else if (needsIdMigration) {
    userdata = migrateUserData(userdata);
  }

  if (legacy?.plans) {
    plans = mergeBuiltinPlans({ ...plans, ...legacy.plans });
  }
  if (legacy?.activePlanId && plans[legacy.activePlanId]) {
    meta.activePlanId = legacy.activePlanId;
  }

  if (!plans[meta.activePlanId]) {
    meta.activePlanId = BUILTIN_365_ID;
  }

  meta.schemaVersion = SCHEMA_VERSION;
  meta.hiddenPlanIds = Array.isArray(meta.hiddenPlanIds) ? meta.hiddenPlanIds : [];

  // Apply hidden flags onto plan objects
  for (const id of meta.hiddenPlanIds) {
    if (plans[id]) plans[id] = { ...plans[id], hidden: true };
  }

  if (needsIdMigration || !metaRaw || !plansRaw || !userRaw) {
    await writeJson(adapter, KEYS.meta, meta);
    await writeJson(adapter, KEYS.plans, plans);
    await writeJson(adapter, KEYS.userdata, userdata);
    // Keep legacy key for one release as backup; do not delete automatically.
  }

  return { meta, plans, userdata };
}

export async function saveAppSnapshot(snapshot: AppSnapshot): Promise<boolean> {
  const adapter = await getStorageAdapter();
  if (!adapter) return false;
  try {
    const meta: MetaState = {
      ...snapshot.meta,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: Date.now(),
      hiddenPlanIds: Object.values(snapshot.plans)
        .filter((p) => p.hidden)
        .map((p) => p.id),
    };
    await writeJson(adapter, KEYS.meta, meta);
    await writeJson(adapter, KEYS.plans, snapshot.plans);
    await writeJson(adapter, KEYS.userdata, snapshot.userdata);
    return true;
  } catch {
    return false;
  }
}

export async function clearUserData(): Promise<boolean> {
  const adapter = await getStorageAdapter();
  if (!adapter) return false;
  try {
    const meta = (await readJson<MetaState>(adapter, KEYS.meta)) || defaultMeta();
    await writeJson(adapter, KEYS.userdata, emptyUserData());
    await writeJson(adapter, KEYS.meta, { ...meta, updatedAt: Date.now() });
    await adapter.remove(KEYS.legacy);
    return true;
  } catch {
    return false;
  }
}

export async function hasStorage(): Promise<boolean> {
  return (await getStorageAdapter()) !== null;
}

/** Back-compat wrappers used during transition. */
export async function loadState(): Promise<PersistedState | null> {
  const snap = await loadAppSnapshot();
  if (!snap) return null;
  return {
    progress: snap.userdata.progress,
    notes: snap.userdata.notes,
    refs: snap.userdata.refs,
    srs: snap.userdata.srs,
    log: snap.userdata.log,
    learned: snap.userdata.learned,
    themeKey: snap.meta.themeKey,
    updatedAt: snap.meta.updatedAt,
    schemaVersion: snap.meta.schemaVersion,
    activePlanId: snap.meta.activePlanId,
    plans: snap.plans,
  };
}

export async function saveState(state: PersistedState & { plans?: PlansState; activePlanId?: string }): Promise<boolean> {
  const current = await loadAppSnapshot();
  const plans = mergeBuiltinPlans(state.plans || current?.plans);
  const activePlanId =
    state.activePlanId && plans[state.activePlanId]
      ? state.activePlanId
      : current?.meta.activePlanId || BUILTIN_365_ID;

  return saveAppSnapshot({
    meta: defaultMeta({
      ...(current?.meta || {}),
      themeKey: state.themeKey,
      activePlanId,
      schemaVersion: SCHEMA_VERSION,
    }),
    plans,
    userdata: {
      progress: state.progress || {},
      notes: state.notes || {},
      refs: state.refs || {},
      srs: state.srs || {},
      log: Array.isArray(state.log) ? state.log : [],
      learned: state.learned || {},
    },
  });
}

export async function clearState(): Promise<boolean> {
  return clearUserData();
}
