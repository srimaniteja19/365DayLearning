import { and, eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { bookmarkItems } from "@/lib/db/schema";
import type { BookmarkItem, BookmarksList } from "@/lib/types";

function rowValues(userId: string, item: BookmarkItem) {
  return {
    id: item.id,
    userId,
    url: item.url,
    kind: item.kind,
    title: item.title,
    note: item.note ?? null,
    tags: item.tags ?? null,
    favorite: item.favorite === true,
    archived: item.archived === true,
    preview: item.preview ?? null,
    insight: item.insight ?? null,
    createdAt: new Date(item.createdAt),
  };
}

export async function upsertBookmarkItem(userId: string, item: BookmarkItem): Promise<void> {
  if (!hasDatabase()) return;
  try {
    const db = getDb();
    const values = rowValues(userId, item);
    await db
      .insert(bookmarkItems)
      .values(values)
      .onConflictDoUpdate({
        target: bookmarkItems.id,
        set: {
          url: values.url,
          kind: values.kind,
          title: values.title,
          note: values.note,
          tags: values.tags,
          favorite: values.favorite,
          archived: values.archived,
          preview: values.preview,
          insight: values.insight,
        },
      });
  } catch (err) {
    console.error("[upsertBookmarkItem] DB error:", err);
  }
}

export async function deleteBookmarkItem(userId: string, id: string): Promise<void> {
  if (!hasDatabase()) return;
  try {
    const db = getDb();
    await db.delete(bookmarkItems).where(and(eq(bookmarkItems.userId, userId), eq(bookmarkItems.id, id)));
  } catch (err) {
    console.error("[deleteBookmarkItem] DB error:", err);
  }
}

export async function deleteAllBookmarkItems(userId: string): Promise<void> {
  if (!hasDatabase()) return;
  try {
    const db = getDb();
    await db.delete(bookmarkItems).where(eq(bookmarkItems.userId, userId));
  } catch (err) {
    console.error("[deleteAllBookmarkItems] DB error:", err);
  }
}

export async function listBookmarkItems(userId: string): Promise<BookmarksList> {
  if (!hasDatabase()) return [];
  try {
    const db = getDb();
    const rows = await db.select().from(bookmarkItems).where(eq(bookmarkItems.userId, userId));
    return rows
      .map((r) => ({
        id: r.id,
        url: r.url,
        kind: r.kind as BookmarkItem["kind"],
        title: r.title,
        note: r.note ?? undefined,
        tags: (r.tags as string[] | null) ?? undefined,
        favorite: r.favorite === true,
        archived: r.archived === true ? true : undefined,
        preview: (r.preview as BookmarkItem["preview"]) ?? undefined,
        insight: r.insight ?? undefined,
        createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error("[listBookmarkItems] DB error:", err);
    return [];
  }
}

/** Idempotent — safe to call repeatedly (e.g. once per GET while legacy data remains). */
export async function backfillBookmarkItems(userId: string, bookmarks: BookmarksList): Promise<void> {
  if (!hasDatabase() || !bookmarks.length) return;
  const db = getDb();
  await db
    .insert(bookmarkItems)
    .values(bookmarks.map((item) => rowValues(userId, item)))
    .onConflictDoNothing({ target: bookmarkItems.id });
}
