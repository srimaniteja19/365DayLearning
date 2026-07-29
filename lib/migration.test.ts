import { describe, expect, it } from "vitest";
import {
  migrateDayId,
  migrateLog,
  migrateNotes,
  migrateProgress,
  migrateRefs,
  migrateSrs,
  migrateUserData,
  purgePlanUserData,
} from "@/lib/migration";
import { BUILTIN_365_ID, BUILTIN_45_ID, SCHEMA_VERSION } from "@/lib/types";

describe("day id migration", () => {
  it("rewrites 365-N and 45-N to builtin plan namespaces", () => {
    expect(migrateDayId("365-12")).toBe(`${BUILTIN_365_ID}:12`);
    expect(migrateDayId("45-3")).toBe(`${BUILTIN_45_ID}:3`);
    expect(migrateDayId("builtin-365:12")).toBe("builtin-365:12");
    expect(migrateDayId("custom:9")).toBe("custom:9");
  });

  it("rewrites progress, notes, refs, srs, and log together", () => {
    const migrated = migrateUserData({
      progress: { "365-12": { 0: true }, "45-1": { 1: true } },
      notes: { "365-12": "hello" },
      refs: { "45-1": { text: "t", topic: "x", style: "explainer", at: 1 } },
      srs: {
        "365-12": { idx: 0, due: 100, graduated: false, reps: 1, last: 1 },
      },
      log: [
        { d: "365-12", i: 0, at: 10 },
        { d: "45-1", i: 1, at: 20 },
      ],
    });

    expect(migrated.progress[`${BUILTIN_365_ID}:12`]).toEqual({ 0: true });
    expect(migrated.progress[`${BUILTIN_45_ID}:1`]).toEqual({ 1: true });
    expect(migrated.notes[`${BUILTIN_365_ID}:12`]).toBe("hello");
    expect(migrated.refs[`${BUILTIN_45_ID}:1`]?.topic).toBe("x");
    expect(migrated.srs[`${BUILTIN_365_ID}:12`]?.reps).toBe(1);
    expect(migrated.log.map((e) => e.d)).toEqual([
      `${BUILTIN_365_ID}:12`,
      `${BUILTIN_45_ID}:1`,
    ]);
    expect(migrated.progress["365-12"]).toBeUndefined();
  });

  it("exposes SCHEMA_VERSION for one-shot guard", () => {
    expect(SCHEMA_VERSION).toBe(3);
  });

  it("migrates each store independently", () => {
    expect(migrateProgress({ "365-1": { 0: true } })[`${BUILTIN_365_ID}:1`]).toEqual({
      0: true,
    });
    expect(migrateNotes({ "45-2": "n" })[`${BUILTIN_45_ID}:2`]).toBe("n");
    expect(migrateRefs({ "365-2": { text: "a", topic: "b", style: "c", at: 1 } })[
      `${BUILTIN_365_ID}:2`
    ].topic).toBe("b");
    expect(migrateSrs({ "45-9": { idx: 1, due: null, graduated: true, reps: 2, last: 3 } })[
      `${BUILTIN_45_ID}:9`
    ].graduated).toBe(true);
    expect(migrateLog([{ d: "365-9", i: 0, at: 1 }])[0].d).toBe(`${BUILTIN_365_ID}:9`);
  });

  it("purgePlanUserData removes only that plan's entries", () => {
    const next = purgePlanUserData(
      {
        progress: {
          [`${BUILTIN_365_ID}:1`]: { 0: true },
          [`${BUILTIN_45_ID}:1`]: { 0: true },
        },
        notes: { [`${BUILTIN_365_ID}:1`]: "a", [`${BUILTIN_45_ID}:1`]: "b" },
        refs: {
          [`${BUILTIN_365_ID}:1`]: { text: "r", topic: "t", style: "explainer", at: 1 },
          [`${BUILTIN_45_ID}:1`]: { text: "r2", topic: "t2", style: "explainer", at: 2 },
        },
        srs: { [`${BUILTIN_365_ID}:1`]: { idx: 0, due: 1, graduated: false, reps: 0, last: 1 } },
        log: [
          { d: `${BUILTIN_365_ID}:1`, i: 0, at: 1 },
          { d: `${BUILTIN_45_ID}:1`, i: 0, at: 2 },
        ],
        learned: {
          "2026-07-27": [
            { id: "l1", title: "Keep me", body: "journal", createdAt: 1 },
          ],
        },
        bookmarks: [
          {
            id: "b1",
            url: "https://example.com",
            kind: "link",
            title: "Keep clip",
            createdAt: 1,
          },
        ],
      },
      BUILTIN_365_ID,
    );
    expect(next.progress[`${BUILTIN_365_ID}:1`]).toBeUndefined();
    expect(next.progress[`${BUILTIN_45_ID}:1`]).toEqual({ 0: true });
    expect(next.notes[`${BUILTIN_45_ID}:1`]).toBe("b");
    expect(next.refs[`${BUILTIN_365_ID}:1`]).toBeUndefined();
    expect(next.refs[`${BUILTIN_45_ID}:1`]?.topic).toBe("t2");
    expect(next.srs[`${BUILTIN_365_ID}:1`]).toBeUndefined();
    expect(next.log).toHaveLength(1);
    expect(next.log[0].d).toBe(`${BUILTIN_45_ID}:1`);
    expect(next.learned["2026-07-27"]?.[0]?.title).toBe("Keep me");
    expect(next.bookmarks?.[0]?.title).toBe("Keep clip");
  });

  it("migrateUserData is idempotent (second pass is a no-op)", () => {
    const once = migrateUserData({
      progress: { "365-12": { 0: true } },
      notes: { "45-3": "x" },
      refs: {},
      srs: {},
      log: [{ d: "365-12", i: 0, at: 1 }],
    });
    const twice = migrateUserData(once);
    expect(twice).toEqual(once);
  });
});
