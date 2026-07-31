import { and, eq, like } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { topicCompletions } from "@/lib/db/schema";
import type { LogEntry } from "@/lib/types";

export async function upsertTopicCompletion(
  userId: string,
  day: string,
  topicIndex: number,
  completedAt: Date,
): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db
    .insert(topicCompletions)
    .values({ userId, day, topicIndex, completedAt })
    .onConflictDoUpdate({
      target: [topicCompletions.userId, topicCompletions.day, topicCompletions.topicIndex],
      set: { completedAt },
    });
}

export async function deleteTopicCompletion(
  userId: string,
  day: string,
  topicIndex: number,
): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db
    .delete(topicCompletions)
    .where(
      and(
        eq(topicCompletions.userId, userId),
        eq(topicCompletions.day, day),
        eq(topicCompletions.topicIndex, topicIndex),
      ),
    );
}

export async function deleteTopicCompletionsByPlanPrefix(
  userId: string,
  planId: string,
): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db
    .delete(topicCompletions)
    .where(and(eq(topicCompletions.userId, userId), like(topicCompletions.day, `${planId}:%`)));
}

export async function deleteAllTopicCompletions(userId: string): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db.delete(topicCompletions).where(eq(topicCompletions.userId, userId));
}

export async function listTopicCompletions(userId: string): Promise<LogEntry[]> {
  if (!hasDatabase()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(topicCompletions)
    .where(eq(topicCompletions.userId, userId));
  return rows.map((r) => ({ d: r.day, i: r.topicIndex, at: r.completedAt.getTime() }));
}

/** Idempotent — safe to call repeatedly (e.g. once per GET while legacy data remains). */
export async function backfillTopicCompletions(userId: string, entries: LogEntry[]): Promise<void> {
  if (!hasDatabase() || !entries.length) return;
  const db = getDb();
  await db
    .insert(topicCompletions)
    .values(
      entries.map((e) => ({
        userId,
        day: e.d,
        topicIndex: e.i,
        completedAt: new Date(e.at),
      })),
    )
    .onConflictDoNothing({
      target: [topicCompletions.userId, topicCompletions.day, topicCompletions.topicIndex],
    });
}
