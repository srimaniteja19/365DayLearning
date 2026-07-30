import { getCredentials } from "@/lib/providers/credentials";
import { willUseManagedAi } from "@/lib/claude-client";
import { openrouterProvider } from "@/lib/providers/openrouter";
import { openRouterWebSearch } from "@/lib/openrouterWebSearch";
import {
  asResourcePair,
  cacheKeyForKind,
  citationToResource,
  domainLabelForSearch,
  isPlaceholderTopic,
  normalizeTopicResourceKey,
  pairHasAnyResource,
  searchPromptForKind,
  TOPIC_RESOURCE_SEARCH_MODEL,
} from "@/lib/topicResourceShared";
import type {
  Plan,
  PlanDay,
  TopicResource,
  TopicResourceKind,
  TopicResourcePair,
} from "@/lib/types";

export {
  TOPIC_RESOURCE_TTL_MS,
  TOPIC_RESOURCE_SEARCH_MODEL,
  normalizeTopicResourceKey,
  domainLabelForSearch,
  citationToResource,
  isPlaceholderTopic,
  asResourcePair,
  pairHasAnyResource,
  cacheKeyForKind,
} from "@/lib/topicResourceShared";

const SEARCH_CONCURRENCY = 2;
const CACHE_LOOKUP_BATCH = 40;

const VIDEO_DOMAINS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "www.vimeo.com",
];

type CacheApiResult = {
  topicKey: string;
  resource: TopicResource | null;
  hit: boolean;
};

async function lookupCache(
  topicKeys: string[],
  signal?: AbortSignal,
): Promise<Map<string, CacheApiResult>> {
  const out = new Map<string, CacheApiResult>();
  const keys = [...new Set(topicKeys.filter(Boolean))];
  for (let i = 0; i < keys.length; i += CACHE_LOOKUP_BATCH) {
    const batch = keys.slice(i, i + CACHE_LOOKUP_BATCH);
    try {
      const res = await fetch("/api/topic-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ action: "lookup", topicKeys: batch }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: CacheApiResult[] };
      for (const row of data.results || []) {
        out.set(row.topicKey, row);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      console.warn("[topic-resources] cache lookup failed", err);
    }
  }
  return out;
}

async function storeCache(
  entries: Array<{ topicKey: string; resource: TopicResource | null }>,
  signal?: AbortSignal,
): Promise<void> {
  if (!entries.length) return;
  try {
    await fetch("/api/topic-resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ action: "store", entries }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.warn("[topic-resources] cache store failed", err);
  }
}

async function searchOne(
  title: string,
  category: string,
  kind: TopicResourceKind,
  signal?: AbortSignal,
): Promise<TopicResource | null> {
  const prompt = searchPromptForKind(title, category, kind);

  try {
    if (willUseManagedAi()) {
      const res = await fetch("/api/topic-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          action: "search",
          title,
          category,
          kind,
        }),
      });
      if (!res.ok) {
        console.warn("[topic-resources] managed search failed", res.status);
        return null;
      }
      const data = (await res.json()) as { resource?: TopicResource | null };
      const resource = data.resource ?? null;
      return resource ? { ...resource, kind } : null;
    }

    const creds = getCredentials();
    if (!creds.apiKey?.trim()) {
      console.warn("[topic-resources] no OpenRouter key; skipping search");
      return null;
    }

    const result = await openRouterWebSearch({
      apiKey: creds.apiKey,
      model: TOPIC_RESOURCE_SEARCH_MODEL,
      prompt,
      maxTokens: 600,
      signal,
      baseUrl: creds.baseUrl || openrouterProvider.defaultBaseUrl,
      maxResults: 3,
      allowedDomains: kind === "video" ? VIDEO_DOMAINS : undefined,
    });
    return citationToResource(result.citation, kind);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.warn("[topic-resources] search error", kind, title, err);
    return null;
  }
}

export type TopicSlot = {
  dayIndex: number;
  topicIndex: number;
  title: string;
  domain?: string;
  topicKey: string;
};

/** Collect topic slots that still need resources (no article and no video). */
export function collectPendingTopicSlots(plan: Plan): TopicSlot[] {
  const slots: TopicSlot[] = [];
  plan.days.forEach((day, dayIndex) => {
    day.topics.forEach((title, topicIndex) => {
      if (isPlaceholderTopic(title)) return;
      const slot = day.resources?.[topicIndex];
      if (slot !== undefined) return;
      const topicKey = normalizeTopicResourceKey(title);
      if (!topicKey) return;
      slots.push({
        dayIndex,
        topicIndex,
        title,
        domain: day.domains[topicIndex],
        topicKey,
      });
    });
  });
  return slots;
}

function ensureResourcesArray(
  day: PlanDay,
): Array<TopicResourcePair | TopicResource | null | undefined> {
  return Array.from({ length: day.topics.length }, (_, i) => day.resources?.[i]);
}

/** Apply a full pair onto a plan immutably. */
export function applyTopicResourcePair(
  plan: Plan,
  dayIndex: number,
  topicIndex: number,
  pair: TopicResourcePair | null,
): Plan {
  const days = plan.days.map((day, di) => {
    if (di !== dayIndex) return day;
    const resources = ensureResourcesArray(day);
    resources[topicIndex] = pair;
    return { ...day, resources };
  });
  return { ...plan, days };
}

/** @deprecated Prefer applyTopicResourcePair — kept for auto-enrich article-only fills. */
export function applyTopicResource(
  plan: Plan,
  dayIndex: number,
  topicIndex: number,
  resource: TopicResource | null,
): Plan {
  const pair: TopicResourcePair | null = resource
    ? { article: { ...resource, kind: resource.kind || "article" }, video: undefined }
    : null;
  return applyTopicResourcePair(plan, dayIndex, topicIndex, pair);
}

/**
 * On-demand: find 1 article + 1 video for a single topic.
 * Uses cache when available; fail-soft (partial results OK).
 */
export async function generateTopicResourcePair(opts: {
  title: string;
  domain?: string;
  signal?: AbortSignal;
}): Promise<TopicResourcePair> {
  const topicKey = normalizeTopicResourceKey(opts.title);
  const category = domainLabelForSearch(opts.domain);
  const articleKey = cacheKeyForKind(topicKey, "article");
  const videoKey = cacheKeyForKind(topicKey, "video");

  const cache = await lookupCache([articleKey, videoKey], opts.signal);
  let article = cache.get(articleKey)?.hit
    ? cache.get(articleKey)!.resource
    : undefined;
  let video = cache.get(videoKey)?.hit ? cache.get(videoKey)!.resource : undefined;

  const toStore: Array<{ topicKey: string; resource: TopicResource | null }> = [];

  const canSearch = willUseManagedAi() || !!getCredentials().apiKey?.trim();

  // Run article + video searches in parallel — each is a full OpenRouter
  // web_search round-trip, so sequential waits roughly double the latency.
  const searches: Array<Promise<void>> = [];
  if (article === undefined && canSearch) {
    searches.push(
      searchOne(opts.title, category, "article", opts.signal).then((r) => {
        article = r;
        toStore.push({ topicKey: articleKey, resource: r });
      }),
    );
  }
  if (video === undefined && canSearch) {
    searches.push(
      searchOne(opts.title, category, "video", opts.signal).then((r) => {
        video = r;
        toStore.push({ topicKey: videoKey, resource: r });
      }),
    );
  }
  if (searches.length) {
    await Promise.all(searches);
  }

  if (toStore.length) {
    await storeCache(toStore, opts.signal);
  }

  return {
    article: article ?? null,
    video: video ?? null,
  };
}

export type EnrichResourcesOpts = {
  plan: Plan;
  signal?: AbortSignal;
  onPlanUpdate: (plan: Plan) => void;
};

/**
 * Background enrichment: prefer article from shared cache / search.
 * Video is left for the explicit Generate button (cost control).
 */
export async function enrichPlanResources(opts: EnrichResourcesOpts): Promise<Plan> {
  const { signal, onPlanUpdate } = opts;
  let plan = opts.plan;
  const pending = collectPendingTopicSlots(plan);
  if (!pending.length) return plan;

  const UPDATE_BATCH_MS = 2500;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const flush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!dirty) return;
    dirty = false;
    onPlanUpdate(plan);
  };

  const scheduleUpdate = () => {
    dirty = true;
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, UPDATE_BATCH_MS);
  };

  const articleKeys = pending.map((p) => cacheKeyForKind(p.topicKey, "article"));
  const cache = await lookupCache(articleKeys, signal);

  const needSearch: TopicSlot[] = [];
  const toStore: Array<{ topicKey: string; resource: TopicResource | null }> = [];

  for (const slot of pending) {
    if (signal?.aborted) break;
    const articleKey = cacheKeyForKind(slot.topicKey, "article");
    const hit = cache.get(articleKey);
    if (hit?.hit) {
      plan = applyTopicResourcePair(plan, slot.dayIndex, slot.topicIndex, {
        article: hit.resource,
        video: undefined,
      });
      scheduleUpdate();
      continue;
    }
    needSearch.push(slot);
  }

  if (!needSearch.length) {
    flush();
    return plan;
  }

  const canSearch = willUseManagedAi() || !!getCredentials().apiKey?.trim();
  if (!canSearch) {
    flush();
    return plan;
  }

  const byKey = new Map<string, TopicSlot[]>();
  for (const slot of needSearch) {
    const list = byKey.get(slot.topicKey) || [];
    list.push(slot);
    byKey.set(slot.topicKey, list);
  }

  const uniqueKeys = [...byKey.keys()];
  let cursor = 0;

  async function worker() {
    while (cursor < uniqueKeys.length) {
      if (signal?.aborted) return;
      const idx = cursor++;
      const key = uniqueKeys[idx];
      const slots = byKey.get(key)!;
      const sample = slots[0];
      const category = domainLabelForSearch(sample.domain);
      const article = await searchOne(sample.title, category, "article", signal);
      toStore.push({ topicKey: cacheKeyForKind(key, "article"), resource: article });
      for (const slot of slots) {
        plan = applyTopicResourcePair(plan, slot.dayIndex, slot.topicIndex, {
          article,
          video: undefined,
        });
      }
      scheduleUpdate();
    }
  }

  const workers = Array.from(
    { length: Math.min(SEARCH_CONCURRENCY, uniqueKeys.length) },
    () => worker(),
  );
  await Promise.all(workers);

  if (toStore.length && !signal?.aborted) {
    await storeCache(toStore, signal);
  }

  flush();
  return plan;
}
