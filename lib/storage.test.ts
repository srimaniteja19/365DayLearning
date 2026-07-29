import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { KEYS, LEGACY_SNAPSHOT_KEYS, purgeLocalAppData } from "@/lib/storage";

describe("purgeLocalAppData", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    vi.stubGlobal("indexedDB", {
      deleteDatabase: () => {
        const req: {
          onsuccess: null | (() => void);
          onerror: null | (() => void);
          onblocked: null | (() => void);
        } = { onsuccess: null, onerror: null, onblocked: null };
        queueMicrotask(() => req.onsuccess?.());
        return req;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes legacy snapshot keys from localStorage and keeps credentials", async () => {
    for (const key of LEGACY_SNAPSHOT_KEYS) {
      store.set(key, "stale");
    }
    store.set("dualtrack:credentials", JSON.stringify({ remember: true }));
    store.set("unrelated", "keep");

    await purgeLocalAppData();

    for (const key of LEGACY_SNAPSHOT_KEYS) {
      expect(store.has(key)).toBe(false);
    }
    expect(store.get("dualtrack:credentials")).toBeTruthy();
    expect(store.get("unrelated")).toBe("keep");
    expect(KEYS.meta).toBe("dualtrack:meta");
  });
});
