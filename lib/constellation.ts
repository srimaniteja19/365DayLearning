import type { BookmarksList, LearnedMap, PlanDay } from "@/lib/types";

const STOPWORDS = new Set(["the","and","for","with","from","into","that","this","your","are","its",
  "how","why","what","when","design","designs","patterns","pattern","internals","internal","deep","dive",
  "advanced","modern","production","systems","system","using","use","based","across","over","under","vs"]);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .split(/[\s\-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Below this many total nodes there isn't enough data for a meaningful graph. */
export const CONSTELLATION_MIN_NODES = 3;

/** Term-overlap score (IDF-weighted) at or above this counts as a "similarity" edge. Tune to taste. */
export const CONSTELLATION_SIMILARITY_THRESHOLD = 1.1;

export type ConstellationNodeType = "day" | "learned" | "bookmark";

export type ConstellationNode = {
  id: string;
  type: ConstellationNodeType;
  refId: string;
  label: string;
  subtitle: string;
  dayNumber?: number;
  createdAt?: number;
  domains: string[];
  weight: number;
  x: number;
  y: number;
};

export type ConstellationEdgeKind = "similarity" | "domain";

export type ConstellationEdge = {
  source: string;
  target: string;
  kind: ConstellationEdgeKind;
  score: number;
};

export type ConstellationGraph = {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
};

type DocEntry = { id: string; tokens: Set<string>; domains: string[]; isDay: boolean };

/**
 * Builds the node + edge set for the Constellation view. Pure function, no layout —
 * call layoutConstellation() separately (and memoize both independently) so a
 * data change doesn't force-recompute positions any more than necessary.
 */
export function buildConstellationGraph(input: {
  completedDays: PlanDay[];
  learned: LearnedMap;
  bookmarks: BookmarksList;
  threshold?: number;
}): ConstellationGraph {
  const threshold = input.threshold ?? CONSTELLATION_SIMILARITY_THRESHOLD;
  const nodes: ConstellationNode[] = [];
  const docs: DocEntry[] = [];

  input.completedDays.forEach((d) => {
    const id = `day:${d.id}`;
    nodes.push({
      id,
      type: "day",
      refId: d.id,
      label: `Day ${d.day}`,
      subtitle: d.topics.join(" · "),
      dayNumber: d.day,
      domains: d.domains || [],
      weight: d.topics.length,
      x: 0,
      y: 0,
    });
    docs.push({
      id,
      tokens: new Set(d.topics.flatMap(tokenize)),
      domains: d.domains || [],
      isDay: true,
    });
  });

  Object.entries(input.learned || {}).forEach(([, items]) => {
    (items || []).forEach((item) => {
      const id = `learned:${item.id}`;
      nodes.push({
        id,
        type: "learned",
        refId: item.id,
        label: item.title,
        subtitle: item.insight || item.body || "",
        createdAt: item.createdAt,
        domains: [],
        weight: 1,
        x: 0,
        y: 0,
      });
      docs.push({
        id,
        tokens: new Set(tokenize([item.title, item.body, item.insight].filter(Boolean).join(" "))),
        domains: [],
        isDay: false,
      });
    });
  });

  (input.bookmarks || []).forEach((item) => {
    const id = `bookmark:${item.id}`;
    nodes.push({
      id,
      type: "bookmark",
      refId: item.id,
      label: item.title,
      subtitle: item.note || item.url,
      createdAt: item.createdAt,
      domains: [],
      weight: 1,
      x: 0,
      y: 0,
    });
    docs.push({
      id,
      tokens: new Set(tokenize([item.title, item.note, ...(item.tags || [])].filter(Boolean).join(" "))),
      domains: [],
      isDay: false,
    });
  });

  const edges = buildEdges(docs, threshold);
  return { nodes, edges };
}

function buildEdges(docs: DocEntry[], threshold: number): ConstellationEdge[] {
  const df = new Map<string, number>();
  docs.forEach((d) => d.tokens.forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const n = docs.length;
  const idf = new Map<string, number>();
  df.forEach((c, w) => idf.set(w, Math.log(n / (1 + c))));

  const edges: ConstellationEdge[] = [];
  for (let i = 0; i < docs.length; i++) {
    const a = docs[i];
    for (let j = i + 1; j < docs.length; j++) {
      const b = docs[j];
      let score = 0;
      a.tokens.forEach((w) => {
        if (b.tokens.has(w)) score += Math.max(0.15, idf.get(w) || 0);
      });
      if (score >= threshold) {
        edges.push({ source: a.id, target: b.id, kind: "similarity", score });
        continue;
      }
      // Cheaper, guaranteed-connected fallback: same-domain plan days only.
      if (a.isDay && b.isDay && a.domains.some((dm) => b.domains.includes(dm))) {
        edges.push({ source: a.id, target: b.id, kind: "domain", score: 0.45 });
      }
    }
  }
  return edges;
}

/** Deterministic PRNG (mulberry32) so layout is stable across re-renders of the same graph. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromNodes(nodes: ConstellationNode[]): number {
  let h = 2166136261;
  for (const n of nodes) {
    for (let i = 0; i < n.id.length; i++) {
      h ^= n.id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

export const CONSTELLATION_WIDTH = 960;
export const CONSTELLATION_HEIGHT = 600;

/**
 * Fruchterman-Reingold-style force layout. Runs a fixed, cooling-schedule
 * number of ticks synchronously (not an animation loop) so it's a one-shot
 * cost paid once per memoized graph, not per frame. O(n^2) per tick from
 * pairwise repulsion; iteration count backs off for larger graphs to keep
 * the total work bounded even at a few hundred nodes.
 */
export function layoutConstellation(
  nodes: ConstellationNode[],
  edges: ConstellationEdge[],
): ConstellationNode[] {
  const n = nodes.length;
  if (n === 0) return nodes;
  const W = CONSTELLATION_WIDTH;
  const H = CONSTELLATION_HEIGHT;
  const rand = mulberry32(seedFromNodes(nodes) || 1);
  const cx = W / 2;
  const cy = H / 2;

  const pos = nodes.map((_, i) => {
    const angle = (i / n) * Math.PI * 2;
    const r = Math.min(W, H) * 0.32;
    return {
      x: cx + Math.cos(angle) * r + (rand() - 0.5) * 20,
      y: cy + Math.sin(angle) * r + (rand() - 0.5) * 20,
    };
  });
  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  const edgePairs = edges
    .map((e) => ({ a: idx.get(e.source), b: idx.get(e.target) }))
    .filter((p): p is { a: number; b: number } => p.a !== undefined && p.b !== undefined);

  const area = W * H;
  const k = Math.sqrt(area / Math.max(n, 1));
  const iterations = n > 250 ? 140 : 220;
  let temp = Math.max(W, H) * 0.08;

  for (let it = 0; it < iterations; it++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        disp[i].x += dx;
        disp[i].y += dy;
        disp[j].x -= dx;
        disp[j].y -= dy;
      }
    }

    for (const { a, b } of edgePairs) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const ux = (dx / dist) * force;
      const uy = (dy / dist) * force;
      disp[a].x -= ux;
      disp[a].y -= uy;
      disp[b].x += ux;
      disp[b].y += uy;
    }

    for (let i = 0; i < n; i++) {
      // Gentle pull toward center so the graph doesn't drift off-canvas.
      disp[i].x += (cx - pos[i].x) * 0.01;
      disp[i].y += (cy - pos[i].y) * 0.01;

      const dLen = Math.sqrt(disp[i].x * disp[i].x + disp[i].y * disp[i].y) || 0.01;
      const clamped = Math.min(dLen, temp);
      pos[i].x += (disp[i].x / dLen) * clamped;
      pos[i].y += (disp[i].y / dLen) * clamped;
      pos[i].x = Math.min(W - 24, Math.max(24, pos[i].x));
      pos[i].y = Math.min(H - 24, Math.max(24, pos[i].y));
    }

    temp *= 0.96;
  }

  return nodes.map((node, i) => ({ ...node, x: pos[i].x, y: pos[i].y }));
}
