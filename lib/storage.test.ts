import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  KEYS,
  loadAppSnapshot,
  needsSchemaMigration,
} from "@/lib/storage";
import {
  setStorageAdapterForTests,
  type StorageAdapter,
} from "@/lib/storage/adapter";
import { SCHEMA_VERSION, BUILTIN_365_ID } from "@/lib/types";

class MemoryAdapter implements StorageAdapter {
  store = new Map<string, string>();
  async get(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
  }
  async remove(key: string) {
    this.store.delete(key);
  }
}

describe("schema migration guard", () => {
  it("needsSchemaMigration is true until SCHEMA_VERSION is set", () => {
    expect(needsSchemaMigration(null)).toBe(true);
    expect(needsSchemaMigration({ schemaVersion: 2 } as never)).toBe(true);
    expect(
      needsSchemaMigration({
        schemaVersion: SCHEMA_VERSION,
        activePlanId: BUILTIN_365_ID,
        themeKey: "ion",
        hiddenPlanIds: [],
      }),
    ).toBe(false);
  });
});

describe("loadAppSnapshot migration runs once", () => {
  let mem: MemoryAdapter;

  beforeEach(() => {
    mem = new MemoryAdapter();
    setStorageAdapterForTests(mem);
  });

  afterEach(() => {
    setStorageAdapterForTests(undefined);
  });

  it("rewrites legacy day ids once, then leaves already-migrated data alone", async () => {
    await mem.set(
      KEYS.legacy,
      JSON.stringify({
        progress: { "365-12": { 0: true } },
        notes: { "45-3": "note" },
        refs: {},
        srs: { "365-12": { idx: 0, due: 1, graduated: false, reps: 0, last: 1 } },
        log: [{ d: "365-12", i: 0, at: 1 }],
        themeKey: "ledger",
      }),
    );

    const first = await loadAppSnapshot();
    expect(first).toBeTruthy();
    expect(first!.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(first!.userdata.progress["builtin-365:12"]).toEqual({ 0: true });
    expect(first!.userdata.notes["builtin-45:3"]).toBe("note");
    expect(first!.userdata.progress["365-12"]).toBeUndefined();
    expect(first!.meta.themeKey).toBe("folio");

    // Mutate stored userdata to a new key that must not be rewritten on second load
    const storedUser = JSON.parse((await mem.get(KEYS.userdata))!);
    storedUser.notes["custom:1"] = "keep";
    // Also reintroduce a legacy key artificially — second load must NOT remigrate
    // because schemaVersion is current (guard). Legacy rewrite only when needs migration.
    storedUser.progress["365-99"] = { 0: true };
    await mem.set(KEYS.userdata, JSON.stringify(storedUser));

    const second = await loadAppSnapshot();
    expect(second!.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(second!.userdata.notes["custom:1"]).toBe("keep");
    // Because migration is skipped, the planted legacy key stays as-is
    expect(second!.userdata.progress["365-99"]).toEqual({ 0: true });
    expect(second!.userdata.progress["builtin-365:99"]).toBeUndefined();
  });
});
