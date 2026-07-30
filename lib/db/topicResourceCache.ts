import { and, gt, inArray, sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { topicResourceCache } from "@/lib/db/schema";
import { TOPIC_RESOURCE_TTL_MS } from "@/lib/topicResourceShared";
import type { TopicResource } from "@/lib/types";

export type CachedTopicResource = {
  topicKey: string;
  resource: TopicResource | null;
  hit: boolean;
  fetchedAt: number;
};

function rowToResource(row: {
  url: string | null;
  title: string | null;
  snippet: string | null;
}): TopicResource | null {
  if (!row.url) return null;
  return {
    url: row.url,
    title: row.title || row.url,
    snippet: row.snippet || undefined,
  };
}

/** Batch lookup; skips stale rows (older than TTL). */
export async function lookupTopicResources(
  topicKeys: string[],
): Promise<CachedTopicResource[]> {
  if (!hasDatabase() || !topicKeys.length) {
    return topicKeys.map((topicKey) => ({
      topicKey,
      resource: null,
      hit: false,
      fetchedAt: 0,
    }));
  }

  const db = getDb();
  const cutoff = new Date(Date.now() - TOPIC_RESOURCE_TTL_MS);
  const rows = await db
    .select()
    .from(topicResourceCache)
    .where(
      and(
        inArray(topicResourceCache.topicKey, topicKeys),
        gt(topicResourceCache.fetchedAt, cutoff),
      ),
    );

  const byKey = new Map(rows.map((r) => [r.topicKey, r]));
  return topicKeys.map((topicKey) => {
    const row = byKey.get(topicKey);
    if (!row) {
      return { topicKey, resource: null, hit: false, fetchedAt: 0 };
    }
    return {
      topicKey,
      resource: rowToResource(row),
      hit: true,
      fetchedAt: row.fetchedAt.getTime(),
    };
  });
}

/** Upsert cache rows (including negative cache when resource is null). */
export async function storeTopicResources(
  entries: Array<{ topicKey: string; resource: TopicResource | null }>,
): Promise<void> {
  if (!hasDatabase() || !entries.length) return;
  const db = getDb();
  const now = new Date();

  for (const entry of entries) {
    const key = entry.topicKey.trim();
    if (!key) continue;
    await db
      .insert(topicResourceCache)
      .values({
        topicKey: key,
        url: entry.resource?.url ?? null,
        title: entry.resource?.title ?? null,
        snippet: entry.resource?.snippet ?? null,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: topicResourceCache.topicKey,
        set: {
          url: entry.resource?.url ?? null,
          title: entry.resource?.title ?? null,
          snippet: entry.resource?.snippet ?? null,
          fetchedAt: now,
        },
      });
  }
}

/** Optional maintenance: drop rows older than TTL. */
export async function pruneStaleTopicResources(): Promise<number> {
  if (!hasDatabase()) return 0;
  const db = getDb();
  const cutoff = new Date(Date.now() - TOPIC_RESOURCE_TTL_MS);
  const result = await db
    .delete(topicResourceCache)
    .where(sql`${topicResourceCache.fetchedAt} < ${cutoff}`);
  return Number((result as { rowCount?: number }).rowCount || 0);
}
