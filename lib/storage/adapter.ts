export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }
}

class IndexedDBAdapter implements StorageAdapter {
  private ready: Promise<typeof import("idb-keyval")>;

  constructor() {
    this.ready = import("idb-keyval");
  }

  async get(key: string): Promise<string | null> {
    const { get } = await this.ready;
    const value = await get<string>(key);
    return value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const { set } = await this.ready;
    await set(key, value);
  }

  async remove(key: string): Promise<void> {
    const { del } = await this.ready;
    await del(key);
  }
}

let cached: StorageAdapter | null = null;
let testOverride: StorageAdapter | null | undefined = undefined;

/** Prefer IndexedDB; fall back to localStorage when IDB is unavailable. */
export async function getStorageAdapter(): Promise<StorageAdapter | null> {
  if (testOverride !== undefined) return testOverride;
  if (typeof window === "undefined") return null;
  if (cached) return cached;

  try {
    const idb = new IndexedDBAdapter();
    const probe = `__dualtrack_probe_${Date.now()}`;
    await idb.set(probe, "1");
    await idb.remove(probe);
    cached = idb;
    return cached;
  } catch {
    try {
      const ls = new LocalStorageAdapter();
      const probe = `__dualtrack_probe_${Date.now()}`;
      await ls.set(probe, "1");
      await ls.remove(probe);
      cached = ls;
      return cached;
    } catch {
      return null;
    }
  }
}

/** Test helper — inject adapter (pass `undefined` to restore normal resolution). */
export function setStorageAdapterForTests(adapter: StorageAdapter | null | undefined): void {
  testOverride = adapter;
  cached = null;
}
