import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ensureContiguousDays,
  normalizeTopic,
  parseJsonWithRepair,
  shouldRetryPeriod,
  skeletonOutlinePeriods,
  snapOutlineToSkeleton,
  topicIndex,
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

  it("builds a weekly skeleton that tiles 1..N", () => {
    const skeleton = skeletonOutlinePeriods(21, "weekly");
    expect(validateOutlineTiles(skeleton, 21)).toEqual([]);
    expect(skeleton[0].start).toBe(1);
    expect(skeleton[skeleton.length - 1].end).toBe(21);
  });

  it("snaps a broken model outline onto the skeleton without a second LLM call", () => {
    const skeleton = skeletonOutlinePeriods(14, "weekly");
    const snapped = snapOutlineToSkeleton(
      [
        { label: "Weird", theme: "Foundations of RPC", start: 1, end: 10 },
        { label: "Also weird", theme: "Applied systems", start: 12, end: 20 },
      ],
      skeleton,
    );
    expect(validateOutlineTiles(snapped, 14)).toEqual([]);
    expect(snapped.some((p) => /Foundations/i.test(p.theme))).toBe(true);
  });
});

describe("period retry policy", () => {
  it("does not retry soft padding issues", () => {
    expect(
      shouldRetryPeriod(
        [{ code: "topics_padded", message: "padded" }],
        { label: "W1", theme: "x", start: 1, end: 7 },
      ),
    ).toBe(false);
  });

  it("retries when many days are missing", () => {
    const issues = Array.from({ length: 4 }, (_, i) => ({
      code: "missing_day",
      message: `Missing day ${i + 1}`,
    }));
    expect(
      shouldRetryPeriod(issues, { label: "W1", theme: "x", start: 1, end: 7 }),
    ).toBe(true);
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

  it("remaps relative 1..N day numbers onto the absolute period range", () => {
    const { fixedDays, issues } = validatePeriodDays({
      period: { label: "W2", theme: "Core", start: 8, end: 14 },
      topicsPerDay: 2,
      exclusions: [],
      seenTopics: new Set(),
      domainIds: ["distributed-sys"],
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        topics: [`Relative topic alpha ${i + 1}`, `Relative topic beta ${i + 1}`],
        domains: ["distributed-sys", "distributed-sys"],
      })),
    });
    expect(fixedDays.map((d) => d.day)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(issues.filter((i) => i.code === "missing_day")).toHaveLength(0);
  });

  it("fills missing days and short topic lists so the period stays contiguous", () => {
    const { fixedDays, issues } = validatePeriodDays({
      period: { label: "W1", theme: "Foundations", start: 1, end: 7 },
      topicsPerDay: 2,
      exclusions: [],
      seenTopics: new Set(),
      domainIds: ["distributed-sys"],
      days: [
        { day: 1, topics: ["Characteristics of distributed systems", "Remote Procedure Call RPC"], domains: ["distributed-sys", "distributed-sys"] },
        { day: 2, topics: ["Distributed concurrency control"], domains: ["distributed-sys"] },
        { day: 4, topics: ["Network"], domains: ["distributed-sys"] },
      ],
    });
    expect(fixedDays).toHaveLength(7);
    expect(fixedDays.every((d) => d.topics.length === 2)).toBe(true);
    expect(fixedDays.find((d) => d.day === 4)!.topics[0]).toMatch(/core concepts/i);
    expect(fixedDays.find((d) => d.day === 3)!.topics[0]).toMatch(/needs review/i);
    expect(issues.some((i) => i.code === "missing_day" || i.code === "topics_padded" || i.code === "topics_per_day")).toBe(true);
  });

  it("ensureContiguousDays backfills gaps across the whole plan", () => {
    const days = ensureContiguousDays({
      days: [
        { id: "p:1", day: 1, topics: ["Alpha topic one", "Beta topic one"], domains: ["distributed-sys", "distributed-sys"] },
        { id: "p:8", day: 8, topics: ["Alpha topic eight", "Beta topic eight"], domains: ["distributed-sys", "distributed-sys"] },
      ],
      totalDays: 10,
      topicsPerDay: 2,
      domainIds: ["distributed-sys"],
      planId: "p",
    });
    expect(days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(days.every((d) => d.topics.length === 2)).toBe(true);
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

describe("topicIndex", () => {
  it("says none yet when empty", () => {
    expect(topicIndex([])).toMatch(/none yet/i);
  });

  it("lists recent topics verbatim and indexes older ones as keywords", () => {
    const topics = Array.from({ length: 160 }, (_, i) => `Raft Consensus Round ${i + 1}`);
    const text = topicIndex(topics, 10);
    expect(text).toContain("Raft Consensus Round 160");
    expect(text).toContain("Raft Consensus Round 151");
    expect(text).not.toContain("Raft Consensus Round 1\n");
    expect(text).toMatch(/earlier 150 topics/i);
    expect(text).toMatch(/raft/i);
    expect(text).toMatch(/consensus/i);
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
