import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import {
  lookupTopicResources,
  storeTopicResources,
} from "@/lib/db/topicResourceCache";
import { requireManagedAiTier, reserveAiActionQuota } from "@/lib/db/subscriptionQuota";
import { clientIp, isRateLimited, isSameOrigin } from "@/lib/httpGuard";
import { openRouterWebSearch } from "@/lib/openrouterWebSearch";
import {
  cacheKeyForKind,
  citationToResource,
  isVideoCitationUrl,
  normalizeTopicResourceKey,
  pairFromCitations,
  searchPromptForKind,
  searchPromptForPair,
  TOPIC_RESOURCE_SEARCH_MODEL,
} from "@/lib/topicResourceShared";
import type { TopicResource, TopicResourceKind, TopicResourcePair } from "@/lib/types";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;
const MAX_LOOKUP_KEYS = 50;
const MAX_STORE_ENTRIES = 50;
const UPSTREAM_TIMEOUT_MS = 45_000;

type LookupBody = {
  action: "lookup";
  topicKeys?: unknown;
};

type StoreBody = {
  action: "store";
  entries?: unknown;
};

type SearchBody = {
  action: "search";
  title?: unknown;
  category?: unknown;
  kind?: unknown;
};

type Body = LookupBody | StoreBody | SearchBody | { action?: unknown };

function readTopicKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const key = normalizeTopicResourceKey(item) || item.trim().toLowerCase();
    if (key) keys.push(key);
    if (keys.length >= MAX_LOOKUP_KEYS) break;
  }
  return [...new Set(keys)];
}

function readStoreEntries(
  value: unknown,
): Array<{ topicKey: string; resource: TopicResource | null }> {
  if (!Array.isArray(value)) return [];
  const out: Array<{ topicKey: string; resource: TopicResource | null }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const rawKey = typeof obj.topicKey === "string" ? obj.topicKey : "";
    const topicKey = normalizeTopicResourceKey(rawKey) || rawKey.trim().toLowerCase();
    if (!topicKey) continue;

    let resource: TopicResource | null = null;
    const r = obj.resource;
    if (r && typeof r === "object") {
      const rec = r as Record<string, unknown>;
      const url = typeof rec.url === "string" ? rec.url.trim() : "";
      if (url && /^https?:\/\//i.test(url)) {
        resource = {
          url: url.slice(0, 2000),
          title: (typeof rec.title === "string" ? rec.title : url).slice(0, 300),
          snippet:
            typeof rec.snippet === "string" ? rec.snippet.slice(0, 500) : undefined,
        };
      }
    }
    out.push({ topicKey, resource });
    if (out.length >= MAX_STORE_ENTRIES) break;
  }
  return out;
}

/**
 * Shared topic-resource cache + managed OpenRouter web_search.
 *
 * - lookup: return cached resources (including negative hits)
 * - store: upsert cache rows from client BYOK searches
 * - search: managed-AI path — server OpenRouter key + url_citation parse
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (await isRateLimited(`topic-resources:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "lookup") {
    if (!hasDatabase()) {
      return NextResponse.json({ results: [] });
    }
    const topicKeys = readTopicKeys((body as LookupBody).topicKeys);
    const results = await lookupTopicResources(topicKeys);
    return NextResponse.json({ results });
  }

  if (action === "store") {
    if (!hasDatabase()) {
      return NextResponse.json({ ok: true, stored: 0 });
    }
    const entries = readStoreEntries((body as StoreBody).entries);
    await storeTopicResources(entries);
    return NextResponse.json({ ok: true, stored: entries.length });
  }

  if (action === "search") {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured on this server." },
        { status: 503 },
      );
    }

    const searchBody = body as SearchBody;
    const titleRaw = searchBody.title;
    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
    if (!title || title.length > 300) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }
    const categoryRaw = searchBody.category;
    const category =
      typeof categoryRaw === "string" && categoryRaw.trim()
        ? categoryRaw.trim().slice(0, 120)
        : "General";
    const kindRaw = searchBody.kind;
    const kindMode: TopicResourceKind | "pair" =
      kindRaw === "video" ? "video" : kindRaw === "pair" ? "pair" : "article";

    if (hasDatabase()) {
      const tierOk = await requireManagedAiTier(session.user.id);
      if (!tierOk.ok) {
        return NextResponse.json({ error: tierOk.message }, { status: tierOk.status });
      }
      // One AI action per search miss (cache hits never reach here).
      // Pair mode is still one upstream call → one quota unit.
      const reserved = await reserveAiActionQuota(session.user.id);
      if (!reserved.ok) {
        return NextResponse.json({ error: reserved.message }, { status: reserved.status });
      }
    }

    const prompt =
      kindMode === "pair"
        ? searchPromptForPair(title, category)
        : searchPromptForKind(title, category, kindMode);
    const allowedDomains =
      kindMode === "video"
        ? ["youtube.com", "www.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com"]
        : undefined;

    try {
      const result = await openRouterWebSearch({
        apiKey,
        model: process.env.OPENROUTER_MODEL?.trim() || TOPIC_RESOURCE_SEARCH_MODEL,
        prompt,
        maxTokens: 200,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        maxResults: kindMode === "article" ? 3 : 5,
        allowedDomains,
        referer: process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://refrainly.dev",
      });

      if (kindMode === "pair") {
        const pair: TopicResourcePair = pairFromCitations(result.citations);
        const baseKey = normalizeTopicResourceKey(title);
        if (hasDatabase() && baseKey) {
          await storeTopicResources([
            {
              topicKey: cacheKeyForKind(baseKey, "article"),
              resource: pair.article ?? null,
            },
            {
              topicKey: cacheKeyForKind(baseKey, "video"),
              resource: pair.video ?? null,
            },
          ]);
        }
        return NextResponse.json({ pair, kind: "pair" });
      }

      let resource: TopicResource | null = null;
      if (kindMode === "video") {
        const hit =
          result.citations.find((c) => c.url && isVideoCitationUrl(c.url)) ||
          (result.citation?.url && isVideoCitationUrl(result.citation.url)
            ? result.citation
            : null);
        resource = citationToResource(hit, "video");
      } else {
        const hit =
          result.citations.find((c) => c.url && !isVideoCitationUrl(c.url)) ||
          (result.citation?.url && !isVideoCitationUrl(result.citation.url)
            ? result.citation
            : null);
        resource = citationToResource(hit, "article");
      }

      const baseKey = normalizeTopicResourceKey(title);
      const topicKey = baseKey ? cacheKeyForKind(baseKey, kindMode) : "";
      if (hasDatabase() && topicKey) {
        await storeTopicResources([{ topicKey, resource }]);
      }
      return NextResponse.json({ resource, topicKey, kind: kindMode });
    } catch (err) {
      console.error("[api/topic-resources] search failed", kindMode, title, err);
      // Fail soft — caller treats null as "no resource".
      if (kindMode === "pair") {
        return NextResponse.json({
          pair: { article: null, video: null },
          kind: "pair",
        });
      }
      return NextResponse.json({ resource: null, kind: kindMode });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
