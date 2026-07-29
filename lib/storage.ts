/**
 * Legacy client snapshot keys from the pre-Neon era.
 * Learning data now lives in Postgres; these are only removed on sign-in.
 * BYOK credentials use a separate key in `lib/providers/types.ts` and are kept.
 */
export const LEGACY_SNAPSHOT_KEYS = [
  "dualtrack:state:v1",
  "dualtrack:meta",
  "dualtrack:plans",
  "dualtrack:userdata",
] as const;

/** @deprecated Prefer LEGACY_SNAPSHOT_KEYS. */
export const KEYS = {
  legacy: LEGACY_SNAPSHOT_KEYS[0],
  meta: LEGACY_SNAPSHOT_KEYS[1],
  plans: LEGACY_SNAPSHOT_KEYS[2],
  userdata: LEGACY_SNAPSHOT_KEYS[3],
} as const;

/** idb-keyval's historical default DB name (older builds stored snapshots here). */
const IDB_KEYVAL_DB = "keyval-store";

type LsLike = {
  removeItem(key: string): void;
};

type IdbLike = {
  deleteDatabase(name: string): {
    onsuccess: null | (() => void);
    onerror: null | (() => void);
    onblocked: null | (() => void);
  };
};

function getLocalStorage(): LsLike | null {
  try {
    const g = globalThis as { localStorage?: LsLike };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

function getIndexedDb(): IdbLike | null {
  try {
    const g = globalThis as { indexedDB?: IdbLike };
    return g.indexedDB ?? null;
  } catch {
    return null;
  }
}

function clearLegacyLocalStorage(): void {
  const ls = getLocalStorage();
  if (!ls) return;
  for (const key of LEGACY_SNAPSHOT_KEYS) {
    try {
      ls.removeItem(key);
    } catch {
      // best-effort
    }
  }
}

function deleteLegacyIndexedDb(): Promise<void> {
  const idb = getIndexedDb();
  if (!idb) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const req = idb.deleteDatabase(IDB_KEYVAL_DB);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Best-effort wipe of pre-Neon campaign caches (localStorage + old IndexedDB).
 * Does not touch BYOK credentials or unrelated browser storage.
 */
export async function purgeLocalAppData(): Promise<void> {
  clearLegacyLocalStorage();
  await deleteLegacyIndexedDb();
}
