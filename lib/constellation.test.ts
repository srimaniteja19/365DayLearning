import { describe, expect, it } from "vitest";
import {
  CONSTELLATION_DOMAIN_CHAIN_NEIGHBORS,
  CONSTELLATION_HEIGHT,
  CONSTELLATION_SIMILARITY_NEIGHBORS,
  CONSTELLATION_SIMILARITY_THRESHOLD,
  CONSTELLATION_WIDTH,
  buildConstellationGraph,
  layoutConstellation,
} from "@/lib/constellation";
import type { BookmarkItem, LearnedItem, PlanDay } from "@/lib/types";

function day(id: string, day: number, topics: string[], domains: string[]): PlanDay {
  return { id, day, topics, domains };
}

function learnedItem(id: string, title: string, body: string, createdAt = 1): LearnedItem {
  return { id, title, body, createdAt };
}

function bookmarkItem(id: string, title: string, note = "", createdAt = 1): BookmarkItem {
  return { id, url: "https://example.com", kind: "article", title, note, createdAt };
}

describe("buildConstellationGraph", () => {
  it("creates one node per completed day, learned item, and bookmark", () => {
    const graph = buildConstellationGraph({
      completedDays: [day("d1", 1, ["React hooks"], ["frontend"])],
      learned: { "2026-01-01": [learnedItem("l1", "React hooks talk", "notes")] },
      bookmarks: [bookmarkItem("b1", "React hooks article")],
    });
    expect(graph.nodes).toHaveLength(3);
    const types = graph.nodes.map((n) => n.type).sort();
    expect(types).toEqual(["bookmark", "day", "learned"]);
    expect(graph.nodes.find((n) => n.type === "day")?.id).toBe("day:d1");
    expect(graph.nodes.find((n) => n.type === "learned")?.id).toBe("learned:l1");
    expect(graph.nodes.find((n) => n.type === "bookmark")?.id).toBe("bookmark:b1");
  });

  it("draws a similarity edge across node types when text overlaps enough", () => {
    const graph = buildConstellationGraph({
      completedDays: [day("d1", 1, ["Distributed consensus algorithms"], ["distributed-sys"])],
      learned: { "2026-01-01": [learnedItem("l1", "Distributed consensus notes", "raft paxos")] },
      bookmarks: [],
      threshold: 0.2,
    });
    const edge = graph.edges.find((e) => e.kind === "similarity");
    expect(edge).toBeDefined();
    expect([edge!.source, edge!.target].sort()).toEqual(["day:d1", "learned:l1"]);
  });

  it("falls back to a domain edge for same-domain days with no term overlap", () => {
    const graph = buildConstellationGraph({
      completedDays: [
        day("d1", 1, ["Foo bar baz"], ["frontend"]),
        day("d2", 2, ["Qux quux corge"], ["frontend"]),
      ],
      learned: {},
      bookmarks: [],
    });
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].kind).toBe("domain");
  });

  it("chains a large same-domain cluster instead of connecting every pair (no hairball)", () => {
    const days = Array.from({ length: 30 }, (_, i) =>
      day(`d${i}`, i + 1, [`Unrelated topic ${i} zz${i}`], ["frontend"]),
    );
    const graph = buildConstellationGraph({ completedDays: days, learned: {}, bookmarks: [] });
    expect(graph.edges.every((e) => e.kind === "domain")).toBe(true);
    // A complete subgraph over 30 same-domain days would be 30*29/2 = 435 edges;
    // the chained fallback caps each day at CONSTELLATION_DOMAIN_CHAIN_NEIGHBORS forward links.
    expect(graph.edges.length).toBeLessThanOrEqual(days.length * CONSTELLATION_DOMAIN_CHAIN_NEIGHBORS);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("caps similarity edges per node instead of connecting every templated-text pair (no hairball)", () => {
    // Simulates a run of AI-summarized notes that share heavy template phrasing —
    // an absolute score threshold alone doesn't bound density for a corpus like this.
    const shared = "the video exposes critical but often overlooked obstacles in advancement particularly focusing on";
    const items = Array.from({ length: 30 }, (_, i) =>
      learnedItem(`l${i}`, `Note ${i}`, `${shared} topic${i} detail${i}`),
    );
    const graph = buildConstellationGraph({
      completedDays: [],
      learned: { "2026-01-01": items },
      bookmarks: [],
      threshold: 0.2,
    });
    expect(graph.edges.every((e) => e.kind === "similarity")).toBe(true);
    // A complete graph over 30 nodes would be 30*29/2 = 435 edges.
    expect(graph.edges.length).toBeLessThan(items.length * CONSTELLATION_SIMILARITY_NEIGHBORS);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("never draws a domain-fallback edge between two non-day nodes", () => {
    const graph = buildConstellationGraph({
      completedDays: [],
      learned: { "2026-01-01": [learnedItem("l1", "Foo", "bar")] },
      bookmarks: [bookmarkItem("b1", "Baz", "qux")],
    });
    expect(graph.edges).toHaveLength(0);
  });

  it("respects a custom threshold", () => {
    const days = [
      day("d1", 1, ["Neural network optimization"], ["ai-ml"]),
      day("d2", 2, ["Neural network training"], ["ai-ml"]),
    ];
    const strict = buildConstellationGraph({ completedDays: days, learned: {}, bookmarks: [], threshold: 50 });
    const loose = buildConstellationGraph({ completedDays: days, learned: {}, bookmarks: [], threshold: 0.01 });
    expect(strict.edges.every((e) => e.kind !== "similarity")).toBe(true);
    expect(loose.edges.some((e) => e.kind === "similarity")).toBe(true);
  });

  it("defaults to the exported similarity threshold", () => {
    expect(CONSTELLATION_SIMILARITY_THRESHOLD).toBeGreaterThan(0);
  });
});

describe("layoutConstellation", () => {
  it("returns an empty array for an empty graph", () => {
    expect(layoutConstellation([], [])).toEqual([]);
  });

  it("places every node within canvas bounds", () => {
    const graph = buildConstellationGraph({
      completedDays: [
        day("d1", 1, ["Foo bar"], ["frontend"]),
        day("d2", 2, ["Baz qux"], ["backend-node"]),
        day("d3", 3, ["Foo bar baz"], ["frontend"]),
      ],
      learned: { "2026-01-01": [learnedItem("l1", "Foo bar notes", "baz")] },
      bookmarks: [bookmarkItem("b1", "Foo bar link")],
    });
    const laid = layoutConstellation(graph.nodes, graph.edges);
    expect(laid).toHaveLength(graph.nodes.length);
    for (const node of laid) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(CONSTELLATION_WIDTH);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(CONSTELLATION_HEIGHT);
    }
  });

  it("is deterministic for the same input graph", () => {
    const graph = buildConstellationGraph({
      completedDays: [
        day("d1", 1, ["Foo bar"], ["frontend"]),
        day("d2", 2, ["Baz qux"], ["backend-node"]),
      ],
      learned: {},
      bookmarks: [],
    });
    const a = layoutConstellation(graph.nodes, graph.edges);
    const b = layoutConstellation(graph.nodes, graph.edges);
    expect(a.map((n) => [n.x, n.y])).toEqual(b.map((n) => [n.x, n.y]));
  });

  it("does not mutate the input nodes", () => {
    const graph = buildConstellationGraph({
      completedDays: [day("d1", 1, ["Foo"], ["frontend"]), day("d2", 2, ["Bar"], ["frontend"])],
      learned: {},
      bookmarks: [],
    });
    const before = graph.nodes.map((n) => [n.x, n.y]);
    layoutConstellation(graph.nodes, graph.edges);
    const after = graph.nodes.map((n) => [n.x, n.y]);
    expect(after).toEqual(before);
  });
});
