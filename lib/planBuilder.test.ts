import { describe, expect, it } from "vitest";
import {
  buildPeriodScopes,
  draftToPlanRequest,
  defaultBuilderDraft,
  validateContent,
  validateShape,
} from "@/lib/planBuilder";

describe("plan builder shape helpers", () => {
  it("validates required shape fields", () => {
    const d = defaultBuilderDraft();
    expect(validateShape(d).some((e) => /name/i.test(e))).toBe(true);
    d.name = "Ops";
    d.totalDays = 45;
    expect(validateShape(d)).toEqual([]);
  });

  it("builds weekly scopes for a 45-day plan", () => {
    const scopes = buildPeriodScopes(45, "weekly");
    expect(scopes.map((s) => s.key)).toEqual(["all", "week"]);
    const weeks = scopes.find((s) => s.key === "week")!.periods;
    expect(weeks[0]).toMatchObject({ start: 1, end: 7 });
    expect(weeks[weeks.length - 1].end).toBe(45);
  });

  it("builds quarter+month scopes for 365", () => {
    const scopes = buildPeriodScopes(365, "quarterly-monthly");
    expect(scopes.map((s) => s.key)).toEqual(["all", "week", "month", "quarter"]);
    expect(scopes.find((s) => s.key === "month")!.periods).toHaveLength(12);
    expect(scopes.find((s) => s.key === "quarter")!.periods).toHaveLength(4);
  });

  it("draftToPlanRequest maps exclusions and domains", () => {
    const d = defaultBuilderDraft();
    d.name = "X";
    d.goal = "Staff backend";
    d.exclusionsText = "HTML basics\n\nCSS intro";
    d.mustIncludeText = "DynamoDB single-table";
    d.domains = [
      { id: "backend-node", label: "Node / Nest", weight: "large", color: "#3FE0D0" },
      { id: "databases", label: "Databases", weight: "medium", color: "#6EE7B7" },
    ];
    const req = draftToPlanRequest(d);
    expect(req.exclusions).toEqual(["HTML basics", "CSS intro"]);
    expect(req.mustInclude).toEqual(["DynamoDB single-table"]);
    expect(req.domains).toHaveLength(2);
    expect(validateContent(d)).toEqual([]);
  });

  it("starts with no domains and requires at least one", () => {
    const d = defaultBuilderDraft();
    expect(d.domains).toEqual([]);
    d.goal = "Learn Rust";
    expect(validateContent(d).some((e) => /domain/i.test(e))).toBe(true);
  });
});
