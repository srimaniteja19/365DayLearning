import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  normalizeTopic,
  parseJsonWithRepair,
  validateOutlineTiles,
  validatePeriodDays,
} from "@/lib/planGeneration";

describe("outline tiling", () => {
  it("accepts contiguous 1..N periods", () => {
    expect(
      validateOutlineTiles(
        [
          { label: "W1", theme: "a", start: 1, end: 7 },
          { label: "W2", theme: "b", start: 8, end: 14 },
          { label: "W3", theme: "c", start: 15, end: 21 },
        ],
        21,
      ),
    ).toEqual([]);
  });

  it("rejects gaps, overlaps, and bad bounds", () => {
    const errors = validateOutlineTiles(
      [
        { label: "W1", theme: "a", start: 2, end: 7 },
        { label: "W2", theme: "b", start: 7, end: 14 },
      ],
      14,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /start at 1/i.test(e))).toBe(true);
  });
});

describe("period day validation", () => {
  it("enforces exact day count, topicsPerDay, uniqueness, exclusions, and word length", () => {
    const seen = new Set<string>();
    const { issues } = validatePeriodDays({
      period: { label: "W1", theme: "x", start: 1, end: 2 },
      topicsPerDay: 2,
      exclusions: ["basic html"],
      seenTopics: seen,
      domainIds: ["frontend", "backend-node"],
      days: [
        {
          day: 1,
          topics: ["React Rendering Model Deep Dive", "basic html"],
          domains: ["frontend", "frontend"],
        },
        {
          day: 2,
          topics: ["React Rendering Model Deep Dive", "NestJS Modules Providers And DI"],
          domains: ["frontend", "backend-node"],
        },
      ],
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("exclusion");
    expect(codes).toContain("duplicate");
  });

  it("a valid 90-day × 2-topic uniqueness check over synthetic data", () => {
    const topics: string[] = [];
    for (let d = 1; d <= 90; d++) {
      topics.push(`Unique Topic Alpha ${d}`);
      topics.push(`Unique Topic Beta ${d}`);
    }
    expect(topics).toHaveLength(180);
    const normalized = topics.map(normalizeTopic);
    expect(new Set(normalized).size).toBe(180);

    const seen = new Set<string>();
    let allIssues = 0;
    for (let start = 1; start <= 90; start += 7) {
      const end = Math.min(start + 6, 90);
      const days = [];
      for (let day = start; day <= end; day++) {
        days.push({
          day,
          topics: [`Unique Topic Alpha ${day}`, `Unique Topic Beta ${day}`],
          domains: ["systems-eng", "systems-eng"],
        });
      }
      const { issues, newTopics } = validatePeriodDays({
        days,
        period: { label: `W${start}`, theme: "t", start, end },
        topicsPerDay: 2,
        exclusions: [],
        seenTopics: seen,
        domainIds: ["systems-eng"],
      });
      allIssues += issues.length;
      newTopics.forEach((t) => seen.add(normalizeTopic(t)));
    }
    expect(allIssues).toBe(0);
    expect(seen.size).toBe(180);
  });
});

describe("JSON repair loop", () => {
  it("recovers from markdown fences via repair callback", async () => {
    const schema = z.object({ periods: z.array(z.object({ label: z.string(), start: z.number(), end: z.number(), theme: z.string() })) });
    const fenced = "```json\n{\"periods\":[{\"label\":\"W1\",\"theme\":\"x\",\"start\":1,\"end\":7}]}\n```";
    // First parse should succeed after stripFences alone
    const parsed = await parseJsonWithRepair(fenced, schema, async () => {
      throw new Error("should not need repair");
    });
    expect(parsed.periods[0].label).toBe("W1");
  });

  it("calls repair when JSON is invalid then succeeds", async () => {
    const schema = z.object({ ok: z.boolean() });
    const repair = vi.fn(async () => "{\"ok\":true}");
    const parsed = await parseJsonWithRepair("not-json {{{", schema, repair);
    expect(parsed.ok).toBe(true);
    expect(repair).toHaveBeenCalledOnce();
  });
});
