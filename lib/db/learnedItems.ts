import { and, eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { learnedItems } from "@/lib/db/schema";
import type { LearnedItem, LearnedMap } from "@/lib/types";

export async function upsertLearnedItem(
  userId: string,
  dateKey: string,
  item: LearnedItem,
): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db
    .insert(learnedItems)
    .values({
      id: item.id,
      userId,
      dateKey,
      title: item.title,
      body: item.body,
      insight: item.insight ?? null,
      tags: item.tags ?? null,
      createdAt: new Date(item.createdAt),
    })
    .onConflictDoUpdate({
      target: learnedItems.id,
      set: {
        dateKey,
        title: item.title,
        body: item.body,
        insight: item.insight ?? null,
        tags: item.tags ?? null,
      },
    });
}

export async function deleteLearnedItem(userId: string, id: string): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db.delete(learnedItems).where(and(eq(learnedItems.userId, userId), eq(learnedItems.id, id)));
}

export async function deleteAllLearnedItems(userId: string): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db.delete(learnedItems).where(eq(learnedItems.userId, userId));
}

export async function listLearnedItems(userId: string): Promise<LearnedMap> {
  if (!hasDatabase()) return {};
  const db = getDb();
  const rows = await db.select().from(learnedItems).where(eq(learnedItems.userId, userId));
  const out: LearnedMap = {};
  for (const r of rows) {
    const item: LearnedItem = {
      id: r.id,
      title: r.title,
      body: r.body,
      insight: r.insight ?? undefined,
      tags: (r.tags as string[] | null) ?? undefined,
      createdAt: r.createdAt.getTime(),
    };
    (out[r.dateKey] ??= []).push(item);
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }
  return out;
}

/** Idempotent — safe to call repeatedly (e.g. once per GET while legacy data remains). */
export async function backfillLearnedItems(userId: string, learned: LearnedMap): Promise<void> {
  if (!hasDatabase()) return;
  const entries = Object.entries(learned).flatMap(([dateKey, items]) =>
    items.map((item) => ({
      id: item.id,
      userId,
      dateKey,
      title: item.title,
      body: item.body,
      insight: item.insight ?? null,
      tags: item.tags ?? null,
      createdAt: new Date(item.createdAt),
    })),
  );
  if (!entries.length) return;
  const db = getDb();
  await db.insert(learnedItems).values(entries).onConflictDoNothing({ target: learnedItems.id });
}
