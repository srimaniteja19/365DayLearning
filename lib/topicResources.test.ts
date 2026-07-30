import { describe, expect, it } from "vitest";
import { parseUrlCitations } from "@/lib/openrouterWebSearch";
import {
  applyTopicResource,
  applyTopicResourcePair,
  collectPendingTopicSlots,
} from "@/lib/topicResources";
import {
  asResourcePair,
  citationToResource,
  isVideoCitationUrl,
  normalizeTopicResourceKey,
  pairFromCitations,
} from "@/lib/topicResourceShared";
import type { Plan } from "@/lib/types";

describe("normalizeTopicResourceKey", () => {
  it("lowercases, trims, strips punctuation, collapses space", () => {
    expect(normalizeTopicResourceKey("  React Hooks!!  ")).toBe("react hooks");
    expect(normalizeTopicResourceKey("TCP/IP — Basics")).toBe("tcp ip basics");
    expect(normalizeTopicResourceKey("")).toBe("");
  });
});

describe("parseUrlCitations", () => {
  it("reads nested url_citation annotations", () => {
    const citations = parseUrlCitations([
      {
        type: "url_citation",
        url_citation: {
          url: "https://react.dev/reference/react/hooks",
          title: "Built-in React Hooks",
          content: "Hooks let you use different React features…",
        },
      },
    ]);
    expect(citations).toHaveLength(1);
    expect(citations[0].url).toBe("https://react.dev/reference/react/hooks");
    expect(citations[0].title).toBe("Built-in React Hooks");
  });

  it("reads flat annotation shapes", () => {
    const citations = parseUrlCitations([
      {
        type: "url_citation",
        url: "https://nodejs.org/docs",
        title: "Node.js docs",
        content: "API reference",
      },
    ]);
    expect(citations[0].url).toBe("https://nodejs.org/docs");
  });

  it("ignores non-citation annotations and empty urls", () => {
    expect(
      parseUrlCitations([
        { type: "file_citation", file_id: "x" },
        { type: "url_citation", url_citation: { url: "" } },
      ]),
    ).toEqual([]);
  });
});

describe("citationToResource", () => {
  it("rejects non-http urls", () => {
    expect(citationToResource({ url: "javascript:alert(1)" })).toBeNull();
    expect(citationToResource({ url: "https://example.com/a", title: "A" })?.url).toBe(
      "https://example.com/a",
    );
  });
});

describe("pairFromCitations", () => {
  it("splits mixed citations into article + video", () => {
    const pair = pairFromCitations([
      { url: "https://www.typescriptlang.org/docs/handbook/generics.html", title: "Generics" },
      { url: "https://www.youtube.com/watch?v=abc123", title: "TS Generics" },
      { url: "https://example.com/extra", title: "Extra" },
    ]);
    expect(pair.article?.url).toContain("typescriptlang.org");
    expect(pair.video?.url).toContain("youtube.com");
  });

  it("detects youtu.be as video", () => {
    expect(isVideoCitationUrl("https://youtu.be/abc")).toBe(true);
    expect(isVideoCitationUrl("https://react.dev/hooks")).toBe(false);
  });
});

function samplePlan(overrides?: Partial<Plan>): Plan {
  return {
    id: "p1",
    name: "Test",
    subtitle: "",
    builtin: false,
    createdAt: 1,
    totalDays: 1,
    topicsPerDay: 2,
    accentRole: "auto",
    periodScopes: [],
    days: [
      {
        day: 1,
        id: "p1:1",
        topics: ["React Hooks", "Needs review topic 1"],
        domains: ["frontend", "frontend"],
      },
    ],
    meta: {},
    ...overrides,
  };
}

describe("collectPendingTopicSlots / applyTopicResourcePair", () => {
  it("skips placeholders and already-resolved slots (including misses)", () => {
    const plan = samplePlan();
    const pending = collectPendingTopicSlots(plan);
    expect(pending).toHaveLength(1);
    expect(pending[0].title).toBe("React Hooks");

    const withRes = applyTopicResourcePair(plan, 0, 0, {
      article: { url: "https://react.dev", title: "React", kind: "article" },
      video: { url: "https://youtube.com/watch?v=1", title: "React video", kind: "video" },
    });
    expect(collectPendingTopicSlots(withRes)).toHaveLength(0);
    const pair = asResourcePair(withRes.days[0].resources?.[0]);
    expect(pair?.article?.url).toBe("https://react.dev");
    expect(pair?.video?.url).toBe("https://youtube.com/watch?v=1");
    // Other topic index must stay unresolved (undefined), not null.
    expect(withRes.days[0].resources?.[1]).toBeUndefined();

    const withMiss = applyTopicResourcePair(plan, 0, 0, {
      article: null,
      video: null,
    });
    expect(withMiss.days[0].resources?.[0]).toEqual({ article: null, video: null });
    expect(collectPendingTopicSlots(withMiss)).toHaveLength(0);
  });

  it("applyTopicResource legacy helper wraps article only", () => {
    const plan = samplePlan();
    const withRes = applyTopicResource(plan, 0, 0, {
      url: "https://react.dev",
      title: "React",
    });
    const pair = asResourcePair(withRes.days[0].resources?.[0]);
    expect(pair?.article?.url).toBe("https://react.dev");
    expect(pair?.video).toBeUndefined();
  });
});
