import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Plan } from "@/lib/types";
import {
  applyFullImport,
  applyPlanImport,
  detectImport,
  exportAll,
  exportPlan,
  remintPlanIds,
  serializeExport,
  type AppDataSlice,
  type FullBackupFile,
} from "@/lib/exportImport";
import {
  forgetCredentials,
  getCredentials,
  setCredentials,
} from "@/lib/providers/credentials";

function samplePlan(id = "plan-share"): Plan {
  return {
    id,
    name: "Shared Stack",
    subtitle: "30-day share",
    builtin: false,
    createdAt: 1,
    totalDays: 2,
    topicsPerDay: 2,
    accentRole: "auto",
    periodScopes: [],
    days: [
      {
        day: 1,
        id: `${id}:1`,
        topics: ["Topic alpha one", "Topic alpha two"],
        domains: ["systems-eng", "systems-eng"],
      },
      {
        day: 2,
        id: `${id}:2`,
        topics: ["Topic beta one", "Topic beta two"],
        domains: ["systems-eng", "systems-eng"],
      },
    ],
    meta: {},
    status: "ready",
  };
}

function slice(partial: Partial<AppDataSlice> = {}): AppDataSlice {
  return {
    plans: { "plan-a": samplePlan("plan-a") },
    progress: { "plan-a:1": { 0: true } },
    notes: { "plan-a:1": "mine" },
    refs: {},
    srs: {},
    log: [{ d: "plan-a:1", i: 0, at: 1 }],
    learned: {},
    bookmarks: [],
    themeKey: "signal",
    activePlanId: "plan-a",
    ...partial,
  };
}

describe("exportPlan / exportAll", () => {
  beforeEach(() => {
    setCredentials({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-5",
      apiKey: "sk-or-export-test-KEY-9999",
      remember: false,
    });
  });
  afterEach(() => forgetCredentials());

  it("exportAll() output contains no substring of the stored API key", () => {
    const key = getCredentials().apiKey!;
    const payload = exportAll({
      plans: { "plan-a": samplePlan("plan-a") },
      userdata: {
        progress: {},
        notes: {},
        refs: {},
        srs: {},
        log: [],
        learned: {},
        bookmarks: [],
      },
      themeKey: "signal",
      activePlanId: "plan-a",
    });
    const js = serializeExport(payload);
    expect(js).not.toContain(key);
    expect(payload.kind).toBe("dualtrack-full");
    expect(js).not.toMatch(/apiKey|credentials/i);
  });

  it("exportPlan is plan-only with kind marker", () => {
    const share = exportPlan(samplePlan());
    expect(share.kind).toBe("dualtrack-plan");
    expect(share.plan.name).toBe("Shared Stack");
    expect((share as { progress?: unknown }).progress).toBeUndefined();
    const js = serializeExport(share);
    expect(js).not.toContain(getCredentials().apiKey!);
  });
});

describe("detectImport + apply", () => {
  it("detects plan share and merges without touching userdata", () => {
    const detected = detectImport(exportPlan(samplePlan("plan-new")));
    expect(detected.kind).toBe("dualtrack-plan");
    if (detected.kind !== "dualtrack-plan") return;
    const current = slice();
    const { plans, plan } = applyPlanImport(current.plans, detected.plan);
    expect(plans["plan-new"] || plans[plan.id]).toBeTruthy();
    expect(Object.keys(current.progress)).toEqual(["plan-a:1"]);
  });

  it("remints colliding plan ids", () => {
    const { plan } = applyPlanImport(
      { "plan-share": samplePlan("plan-share") },
      samplePlan("plan-share"),
    );
    expect(plan.id).not.toBe("plan-share");
    expect(plan.days[0].id.startsWith(`${plan.id}:`)).toBe(true);
  });

  it("full replace swaps userdata and keeps builtins when missing", () => {
    const backup: FullBackupFile = {
      app: "dualtrack",
      kind: "dualtrack-full",
      version: 3,
      schemaVersion: 3,
      exportedAt: "2026-01-01T00:00:00.000Z",
      progress: { "custom:1": { 0: true } },
      notes: {},
      refs: {},
      srs: {},
      log: [],
      plans: { custom: samplePlan("custom") },
      themeKey: "matte" as never,
      activePlanId: "custom",
    };
    const next = applyFullImport(slice(), backup, "replace");
    expect(next.progress).toEqual({ "custom:1": { 0: true } });
    expect(next.notes).toEqual({});
    expect(next.plans.custom).toBeTruthy();
    expect(next.plans["builtin-365"]).toBeTruthy();
    expect(next.themeKey).toBe("afterburn");
    expect(next.activePlanId).toBe("custom");
  });

  it("full merge keeps local keys and overlays incoming", () => {
    const backup: FullBackupFile = {
      app: "dualtrack",
      kind: "dualtrack-full",
      version: 3,
      schemaVersion: 3,
      exportedAt: "2026-01-01T00:00:00.000Z",
      progress: { "plan-b:1": { 0: true, 1: true } },
      notes: { "plan-b:1": "theirs" },
      refs: {},
      srs: {},
      log: [{ d: "plan-b:1", i: 0, at: 2 }],
      plans: { "plan-b": samplePlan("plan-b") },
      activePlanId: "plan-b",
    };
    const next = applyFullImport(slice(), backup, "merge");
    expect(next.progress["plan-a:1"]).toEqual({ 0: true });
    expect(next.progress["plan-b:1"]).toEqual({ 0: true, 1: true });
    expect(next.notes["plan-a:1"]).toBe("mine");
    expect(next.notes["plan-b:1"]).toBe("theirs");
    expect(next.log).toHaveLength(2);
    expect(next.plans["plan-a"]).toBeTruthy();
    expect(next.plans["plan-b"]).toBeTruthy();
  });

  it("detectImport migrates legacy day ids in full backups", () => {
    const detected = detectImport({
      app: "dualtrack",
      version: 2,
      progress: { "365-12": { 0: true } },
      notes: { "45-3": "hi" },
      refs: {},
      srs: {},
      log: [{ d: "365-1", i: 0, at: 1 }],
    });
    expect(detected.kind).toBe("dualtrack-full");
    if (detected.kind !== "dualtrack-full") return;
    expect(detected.backup.progress["builtin-365:12"]).toEqual({ 0: true });
    expect(detected.backup.notes["builtin-45:3"]).toBe("hi");
    expect(detected.backup.log[0].d).toBe("builtin-365:1");
  });

  it("remintPlanIds rewrites day ids", () => {
    const reminted = remintPlanIds(samplePlan("old"), "plan-newid");
    expect(reminted.id).toBe("plan-newid");
    expect(reminted.days.map((d) => d.id)).toEqual(["plan-newid:1", "plan-newid:2"]);
  });
});
