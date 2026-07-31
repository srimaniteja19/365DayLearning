# Split log/learned/bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `log`, `learned`, `bookmarks` off the single-snapshot-blob sync model onto dedicated per-user tables with per-record writes, so an unrelated note edit no longer re-serializes a user's entire completion history and journal. The client's in-memory shape (`UserDataState.log/learned/bookmarks`, `lib/types.ts:123-163`) and every UI behavior stay identical — only the persistence layer changes.

**Architecture:** Three new per-user tables + DB access modules + three new API routes for per-record writes; a shared server-side hydration helper (backfill-on-read + table merge) used by both `GET /api/state` and `PUT /api/state`'s 409-conflict response; client-side wiring so each mutation fires its own immediate write and the debounced snapshot push stops carrying these three fields.

**Tech Stack:** Drizzle ORM (Neon Postgres, `drizzle-kit push` workflow — no migration files in this repo), Next.js App Router route handlers, React (`components/dualtrack/DualTrackConsole.tsx`, runs under `// @ts-nocheck`, no typecheck coverage for that file — lint is the only static check there).

## Global Constraints

- Client in-memory shape unchanged: `log: LogEntry[]`, `learned: LearnedMap`, `bookmarks: BookmarksList` React state in `DualTrackConsole.tsx` keep their exact current type and behavior.
- No debounce on the new per-record writes — each mutation fires immediately.
- No optimistic-concurrency check on per-record writes — last-write-wins per record, no `baseUpdatedAt`-style guard.
- No `SCHEMA_VERSION` bump — backward-compatible; old blobs with these fields still populated are read fine and backfilled.
- No offline queue, no pagination, no per-record versioning — out of scope (see spec's Non-goals).
- `handleReset` ("Delete all my data") and `handleDeletePlan` must bulk-delete the corresponding rows in the new tables — approved scope addition beyond the original spec draft, to avoid orphaned rows after a data-deletion flow.
- Any endpoint returning an `AppSnapshot`-shaped `snapshot` to the client (`GET /api/state`'s success response, and `PUT /api/state`'s 409-conflict response) must return `log`/`learned`/`bookmarks` merged from the new tables, not from the stale blob — otherwise a 409 conflict would wipe local state for these three fields via `applyCloudSnapshot` (`DualTrackConsole.tsx:433-449`), reintroducing exactly the silent-data-loss risk the item #2 conflict-recovery-stash work fixed.
- Backfill-on-read must not gate on "are the new tables completely empty" — a user who's made one post-cutover write (so the new table has 1 row) but still has other legacy data in the blob must still get that remaining legacy data backfilled. Backfill unconditionally on any non-empty legacy field, using `onConflictDoNothing` for idempotency, then always re-read from the tables as the source of truth for the response.

---

### Task 1: Schema — three new tables

**Files:**
- Modify: `lib/db/schema.ts`

**Interfaces:**
- Produces: `topicCompletions`, `learnedItems`, `bookmarkItems` Drizzle tables, consumed by Task 2's DB access modules.

- [ ] **Step 1: Add the `primaryKey` import**

In `lib/db/schema.ts`, change:
```ts
import { pgTable, text, timestamp, jsonb, uuid, integer } from "drizzle-orm/pg-core";
```
to:
```ts
import { pgTable, text, timestamp, jsonb, uuid, integer, primaryKey } from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Add the three tables**

Add after the `topicResourceCache` table definition (before the `export type UserRow = ...` block, or after it — either is fine, keep tables grouped together):

```ts
/**
 * One row per (user, day, topic) completion. Composite PK matches the
 * client's LogEntry {d, i, at} key exactly (lib/types.ts). Upserted on
 * topic-check, deleted on topic-uncheck — see app/api/log/route.ts.
 */
export const topicCompletions = pgTable(
  "topic_completions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    topicIndex: integer("topic_index").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.topicIndex] })],
);

/**
 * One row per "other things I learned" journal entry. `id` is the
 * client-minted id (createLearnedId(), lib/learned.ts) reused as PK.
 * `dateKey` is a real column, not derived from createdAt — entries can be
 * moved to a different date (updateLearned's toDate param).
 */
export const learnedItems = pgTable("learned_items", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dateKey: text("date_key").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  insight: text("insight"),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/**
 * One row per saved bookmark. `id` is the client-minted id
 * (createBookmarkId(), lib/bookmarks.ts) reused as PK.
 */
export const bookmarkItems = pgTable("bookmark_items", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  tags: jsonb("tags"),
  preview: jsonb("preview"),
  insight: text("insight"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
```

- [ ] **Step 3: Add row types**

In the existing `export type UserRow = ...` block at the bottom of the file, add:
```ts
export type TopicCompletionRow = typeof topicCompletions.$inferSelect;
export type LearnedItemRow = typeof learnedItems.$inferSelect;
export type BookmarkItemRow = typeof bookmarkItems.$inferSelect;
```

- [ ] **Step 4: Push the schema**

Run: `npm run db:push`
Expected: drizzle-kit reports the three new tables being created, applies cleanly.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts
git commit -m "$(cat <<'EOF'
Add topic_completions, learned_items, bookmark_items tables

Per-user, per-record tables to replace snapshot-blob storage for
log/learned/bookmarks. topicCompletions' composite PK (userId, day,
topicIndex) matches the client's existing LogEntry key exactly.
EOF
)"
```

---

### Task 2: DB access modules

**Files:**
- Create: `lib/db/topicCompletions.ts`
- Create: `lib/db/learnedItems.ts`
- Create: `lib/db/bookmarkItems.ts`

**Interfaces:**
- Consumes: `getDb`/`hasDatabase` (`lib/db/client.ts`), the three tables from Task 1, `LogEntry`/`LearnedMap`/`LearnedItem`/`BookmarksList`/`BookmarkItem` types (`lib/types.ts`), `migrateLog` (`lib/migration.ts`), `sanitizeLearned` (`lib/learned.ts`), `sanitizeBookmarks` (`lib/bookmarks.ts`).
- Produces (consumed by Task 3's routes and Task 4's hydration helper):
  - `lib/db/topicCompletions.ts`: `upsertTopicCompletion(userId, day, topicIndex, completedAt: Date): Promise<void>`, `deleteTopicCompletion(userId, day, topicIndex): Promise<void>`, `deleteTopicCompletionsByPlanPrefix(userId, planId): Promise<void>`, `deleteAllTopicCompletions(userId): Promise<void>`, `listTopicCompletions(userId): Promise<LogEntry[]>`, `backfillTopicCompletions(userId, entries: LogEntry[]): Promise<void>`.
  - `lib/db/learnedItems.ts`: `upsertLearnedItem(userId, dateKey, item: LearnedItem): Promise<void>`, `deleteLearnedItem(userId, id): Promise<void>`, `deleteAllLearnedItems(userId): Promise<void>`, `listLearnedItems(userId): Promise<LearnedMap>`, `backfillLearnedItems(userId, learned: LearnedMap): Promise<void>`.
  - `lib/db/bookmarkItems.ts`: `upsertBookmarkItem(userId, item: BookmarkItem): Promise<void>`, `deleteBookmarkItem(userId, id): Promise<void>`, `deleteAllBookmarkItems(userId): Promise<void>`, `listBookmarkItems(userId): Promise<BookmarksList>`, `backfillBookmarkItems(userId, bookmarks: BookmarksList): Promise<void>`.

- [ ] **Step 1: Write `lib/db/topicCompletions.ts`**

```ts
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
```

- [ ] **Step 2: Write `lib/db/learnedItems.ts`**

```ts
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
```

- [ ] **Step 3: Write `lib/db/bookmarkItems.ts`**

```ts
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
    preview: item.preview ?? null,
    insight: item.insight ?? null,
    createdAt: new Date(item.createdAt),
  };
}

export async function upsertBookmarkItem(userId: string, item: BookmarkItem): Promise<void> {
  if (!hasDatabase()) return;
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
        preview: values.preview,
        insight: values.insight,
      },
    });
}

export async function deleteBookmarkItem(userId: string, id: string): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db.delete(bookmarkItems).where(and(eq(bookmarkItems.userId, userId), eq(bookmarkItems.id, id)));
}

export async function deleteAllBookmarkItems(userId: string): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();
  await db.delete(bookmarkItems).where(eq(bookmarkItems.userId, userId));
}

export async function listBookmarkItems(userId: string): Promise<BookmarksList> {
  if (!hasDatabase()) return [];
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
      preview: (r.preview as BookmarkItem["preview"]) ?? undefined,
      insight: r.insight ?? undefined,
      createdAt: r.createdAt.getTime(),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
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
```

- [ ] **Step 4: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db/topicCompletions.ts lib/db/learnedItems.ts lib/db/bookmarkItems.ts
git commit -m "$(cat <<'EOF'
Add DB access modules for topic completions, learned items, bookmarks

Per-record CRUD plus idempotent backfill-from-legacy-blob functions
for each of the three new tables, modeled on the existing
topicResourceCache.ts access-module pattern.
EOF
)"
```

---

### Task 3: Per-record API routes

**Files:**
- Create: `app/api/log/route.ts`
- Create: `app/api/learned/route.ts`
- Create: `app/api/bookmarks/route.ts`

**Interfaces:**
- Consumes: Task 2's DB access modules; `auth` (`@/auth`), `hasDatabase`/`getDb` (`lib/db/client.ts`), `isSameOrigin` (`lib/httpGuard.ts`), `logError` (`lib/logError.ts`); `sanitizeLearned` (`lib/learned.ts`), `sanitizeBookmarks` (`lib/bookmarks.ts`) reused for single-item validation.
- Produces (consumed by Task 5's client wiring):
  - `POST /api/log` body `{day: string, topicIndex: number}` → upserts with `completedAt = now`, returns `{ok: true}`.
  - `DELETE /api/log?day=X&topicIndex=Y` → deletes one row. `DELETE /api/log?planId=X` → deletes all rows for that plan's days. `DELETE /api/log?all=true` → deletes all rows for the user. Exactly one mode must be specified.
  - `POST /api/learned` body `{dateKey: string, item: LearnedItem}` → upserts (add and update are the same operation — the row's `id` decides). `DELETE /api/learned?id=X` → deletes one row. `DELETE /api/learned?all=true` → deletes all rows for the user.
  - `POST /api/bookmarks` body `{item: BookmarkItem}` → upserts. `DELETE /api/bookmarks?id=X` → deletes one row. `DELETE /api/bookmarks?all=true` → deletes all rows for the user.
- **Implementation note vs. spec:** the spec's route sketch mentioned `PATCH` for updates. Since both add and update are upserts keyed by an already-client-minted `id` (or, for log, the composite `day`+`topicIndex` key), a single `POST` handles both — no separate `PATCH` needed. This is simpler with no behavioral difference from what the spec described.

- [ ] **Step 1: Write `app/api/log/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import {
  deleteAllTopicCompletions,
  deleteTopicCompletion,
  deleteTopicCompletionsByPlanPrefix,
  upsertTopicCompletion,
} from "@/lib/db/topicCompletions";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const payload = body as { day?: unknown; topicIndex?: unknown } | null;
  const day = typeof payload?.day === "string" ? payload.day.trim() : "";
  const topicIndex =
    typeof payload?.topicIndex === "number" && Number.isInteger(payload.topicIndex)
      ? payload.topicIndex
      : null;
  if (!day || topicIndex === null || topicIndex < 0) {
    return NextResponse.json({ error: "day and topicIndex are required." }, { status: 400 });
  }

  try {
    await upsertTopicCompletion(userId, day, topicIndex, new Date());
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/log", "POST failed", err);
    return NextResponse.json({ error: "Could not save completion." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const day = searchParams.get("day");
  const topicIndexRaw = searchParams.get("topicIndex");
  const planId = searchParams.get("planId");
  const all = searchParams.get("all") === "true";

  const modesSpecified = [day && topicIndexRaw != null, !!planId, all].filter(Boolean).length;
  if (modesSpecified !== 1) {
    return NextResponse.json(
      { error: "Specify exactly one of (day + topicIndex), planId, or all=true." },
      { status: 400 },
    );
  }

  try {
    if (all) {
      await deleteAllTopicCompletions(userId);
    } else if (planId) {
      await deleteTopicCompletionsByPlanPrefix(userId, planId);
    } else {
      const topicIndex = Number(topicIndexRaw);
      if (!day || !Number.isInteger(topicIndex)) {
        return NextResponse.json({ error: "Invalid day/topicIndex." }, { status: 400 });
      }
      await deleteTopicCompletion(userId, day, topicIndex);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/log", "DELETE failed", err);
    return NextResponse.json({ error: "Could not delete completion." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `app/api/learned/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { deleteAllLearnedItems, deleteLearnedItem, upsertLearnedItem } from "@/lib/db/learnedItems";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";
import { sanitizeLearned } from "@/lib/learned";

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const payload = body as { dateKey?: unknown; item?: unknown } | null;
  const dateKey = typeof payload?.dateKey === "string" ? payload.dateKey : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ error: "dateKey must be YYYY-MM-DD." }, { status: 400 });
  }
  const sanitizedMap = sanitizeLearned({ [dateKey]: [payload?.item] });
  const item = sanitizedMap[dateKey]?.[0];
  if (!item) {
    return NextResponse.json({ error: "item is invalid." }, { status: 400 });
  }

  try {
    await upsertLearnedItem(userId, dateKey, item);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/learned", "POST failed", err);
    return NextResponse.json({ error: "Could not save entry." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all") === "true";
  if ((id && all) || (!id && !all)) {
    return NextResponse.json({ error: "Specify exactly one of id or all=true." }, { status: 400 });
  }

  try {
    if (all) {
      await deleteAllLearnedItems(userId);
    } else if (id) {
      await deleteLearnedItem(userId, id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/learned", "DELETE failed", err);
    return NextResponse.json({ error: "Could not delete entry." }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write `app/api/bookmarks/route.ts`**

Note: this is a **new file at the parent path** — distinct from the existing `app/api/bookmarks/preview/route.ts` (OG-preview fetch, unrelated, untouched). Next.js App Router supports both coexisting.

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sanitizeBookmarks } from "@/lib/bookmarks";
import { hasDatabase } from "@/lib/db/client";
import { deleteAllBookmarkItems, deleteBookmarkItem, upsertBookmarkItem } from "@/lib/db/bookmarkItems";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const payload = body as { item?: unknown } | null;
  const item = sanitizeBookmarks([payload?.item])[0];
  if (!item) {
    return NextResponse.json({ error: "item is invalid." }, { status: 400 });
  }

  try {
    await upsertBookmarkItem(userId, item);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/bookmarks", "POST failed", err);
    return NextResponse.json({ error: "Could not save bookmark." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all") === "true";
  if ((id && all) || (!id && !all)) {
    return NextResponse.json({ error: "Specify exactly one of id or all=true." }, { status: 400 });
  }

  try {
    if (all) {
      await deleteAllBookmarkItems(userId);
    } else if (id) {
      await deleteBookmarkItem(userId, id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/bookmarks", "DELETE failed", err);
    return NextResponse.json({ error: "Could not delete bookmark." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Manual verification via dev server**

No route-handler test file exists anywhere in this repo today — verify by hand, matching the precedent from the error-monitoring-telemetry endpoint (sign in, use `fetch(...)` in devtools console with same-origin + session cookie, or `curl` with a signed-in session's cookie jar):

1. `POST /api/log` with a valid `{day, topicIndex}` → `{ok:true}`; check `db:studio` → `topic_completions` has the row.
2. `POST /api/log` again with the same `day`/`topicIndex` → still `{ok:true}`, row's `completedAt` updates (upsert, not duplicate).
3. `DELETE /api/log?day=X&topicIndex=Y` → row gone.
4. `DELETE /api/log?planId=X` after inserting two rows under `X:...` days and one under a different plan → only the two matching rows gone.
5. `DELETE /api/log?all=true` → all rows for that user gone.
6. `DELETE /api/log` with zero or multiple mode params → 400.
7. Repeat the equivalent add/upsert/delete/delete-all/bad-params checks for `/api/learned` (using a valid `dateKey`+`item`) and `/api/bookmarks` (using a valid `item` with a real `url`).
8. Signed-out request to any of the three → 401.

Write what you observed for each check into your report.

- [ ] **Step 6: Commit**

```bash
git add app/api/log/route.ts app/api/learned/route.ts app/api/bookmarks/route.ts
git commit -m "$(cat <<'EOF'
Add per-record API routes for log, learned, bookmarks

POST upserts (add and update are the same operation, keyed by the
existing client-minted id or composite day+topicIndex). DELETE
supports single-record, plan-scoped bulk (log only), and full
per-user bulk modes — the latter two needed by handleDeletePlan and
handleReset once these collections leave the snapshot blob.
EOF
)"
```

---

### Task 4: Server-side hydration — GET and PUT-conflict merge, with backfill

**Files:**
- Modify: `app/api/state/route.ts`

**Interfaces:**
- Consumes: `listTopicCompletions`/`backfillTopicCompletions`, `listLearnedItems`/`backfillLearnedItems`, `listBookmarkItems`/`backfillBookmarkItems` (Task 2).
- Produces: `hydrateUserdata(userId, snapshot)` — internal to this file, used by both `GET` and `PUT`'s conflict response. No external consumers.

- [ ] **Step 1: Add imports and the shared hydration helper**

In `app/api/state/route.ts`, add imports:
```ts
import {
  backfillTopicCompletions,
  listTopicCompletions,
} from "@/lib/db/topicCompletions";
import { backfillLearnedItems, listLearnedItems } from "@/lib/db/learnedItems";
import { backfillBookmarkItems, listBookmarkItems } from "@/lib/db/bookmarkItems";
```
and change the file's existing `@/lib/types` import line from:
```ts
import { SCHEMA_VERSION } from "@/lib/types";
```
to:
```ts
import { SCHEMA_VERSION, type AppSnapshot } from "@/lib/types";
```

Add the helper function (after `toIso`, before `GET`):

```ts
/**
 * Merges log/learned/bookmarks from their dedicated tables into a snapshot
 * about to be returned to the client. If the stored blob still has legacy
 * data in those fields (pre-cutover), backfills it into the new tables
 * first — idempotent, so this is safe to run on every GET/conflict
 * response while any legacy data remains. Does NOT gate backfill on
 * "are the new tables empty" — a user who's made one post-cutover write
 * but still has other legacy data must still get the rest backfilled.
 */
async function hydrateUserdata(userId: string, snapshot: AppSnapshot): Promise<AppSnapshot> {
  const legacyLog = snapshot.userdata.log;
  const legacyLearned = snapshot.userdata.learned;
  const legacyBookmarks = snapshot.userdata.bookmarks;
  const hasLegacyData =
    legacyLog.length > 0 || Object.keys(legacyLearned).length > 0 || legacyBookmarks.length > 0;

  if (hasLegacyData) {
    await Promise.all([
      backfillTopicCompletions(userId, legacyLog),
      backfillLearnedItems(userId, legacyLearned),
      backfillBookmarkItems(userId, legacyBookmarks),
    ]);
  }

  const [log, learned, bookmarks] = await Promise.all([
    listTopicCompletions(userId),
    listLearnedItems(userId),
    listBookmarkItems(userId),
  ]);

  return { ...snapshot, userdata: { ...snapshot.userdata, log, learned, bookmarks } };
}
```

- [ ] **Step 2: Use it in `GET`**

`GET` currently returns `row.snapshot` raw (not run through `sanitizeAppSnapshot`). Change it to sanitize first (so `hydrateUserdata` gets a well-typed `AppSnapshot`) and hydrate:

Replace:
```ts
    if (!row) {
      return NextResponse.json({ snapshot: null, updatedAt: null });
    }
    return NextResponse.json({
      snapshot: row.snapshot,
      updatedAt: toIso(row.updatedAt),
    });
```
with:
```ts
    if (!row) {
      return NextResponse.json({ snapshot: null, updatedAt: null });
    }
    const sanitized = sanitizeAppSnapshot(row.snapshot);
    const snapshot = sanitized ? await hydrateUserdata(userId, sanitized) : row.snapshot;
    return NextResponse.json({
      snapshot,
      updatedAt: toIso(row.updatedAt),
    });
```

- [ ] **Step 3: Use it in `PUT`'s conflict response**

`conflictResponse` is currently a synchronous closure returning
`sanitizeAppSnapshot(existing.snapshot) || existing.snapshot` as the
`snapshot` field. Make it async and hydrate:

Replace:
```ts
      const conflictResponse = (reason: string, message: string) =>
        NextResponse.json(
          {
            error: "conflict",
            reason,
            message,
            snapshot: sanitizeAppSnapshot(existing.snapshot) || existing.snapshot,
            updatedAt: serverAt,
          },
          { status: 409 },
        );
```
with:
```ts
      const conflictResponse = async (reason: string, message: string) => {
        const sanitized = sanitizeAppSnapshot(existing.snapshot);
        const snapshot = sanitized ? await hydrateUserdata(userId, sanitized) : existing.snapshot;
        return NextResponse.json(
          { error: "conflict", reason, message, snapshot, updatedAt: serverAt },
          { status: 409 },
        );
      };
```

And update both call sites to await it:
```ts
      if (snapshot.meta.schemaVersion < SCHEMA_VERSION) {
        return await conflictResponse(
          "schema-version",
          "Your app version is out of date. Reloaded the latest copy — please refresh.",
        );
      }

      if (baseUpdatedAt != null && serverAt && serverAt !== baseUpdatedAt) {
        return await conflictResponse("stale-base", "Cloud data changed on another device. Reloaded the latest copy.");
      }
```

- [ ] **Step 4: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Manual verification via dev server**

1. Seed a `user_state` row (via `db:studio` or a raw PUT) whose `snapshot.userdata.log`/`learned`/`bookmarks` have real entries, with `topic_completions`/`learned_items`/`bookmark_items` empty for that user.
2. `GET /api/state` while signed in as that user → response's `snapshot.userdata.log`/`learned`/`bookmarks` match what was in the blob; check `db:studio` → the three new tables now have matching rows.
3. `GET /api/state` again → same response, no duplicate rows in the new tables (idempotent backfill).
4. Manually add one more row directly to `topic_completions` for that user (simulating "one post-cutover write already happened"), and add a *different* still-unmigrated entry to the blob's `snapshot.userdata.log` directly via SQL/db:studio. `GET /api/state` again → confirm the response includes **both** the pre-existing new-table row and the newly-backfilled one (verifies the "don't gate on tables being empty" fix).
5. Force a 409 (two tabs / monkey-patched fetch, same technique as the conflict-recovery-stash verification) and confirm the conflict response's `snapshot.userdata.log/learned/bookmarks` are populated from the tables (not empty) — this is the check that catches the "wipes local state on conflict" regression if the wiring is wrong.

Write what you observed into your report.

- [ ] **Step 6: Commit**

```bash
git add app/api/state/route.ts
git commit -m "$(cat <<'EOF'
Hydrate log/learned/bookmarks from their tables in GET and PUT-409

Both response paths that return an AppSnapshot to the client now
merge log/learned/bookmarks from the new tables rather than the
stale blob, backfilling any remaining legacy blob data first
(idempotent, not gated on the tables being completely empty). Without
this, a 409 conflict would wipe local state for these three fields
via applyCloudSnapshot once the client stops sending them.
EOF
)"
```

---

### Task 5: Client wiring

**Files:**
- Modify: `components/dualtrack/DualTrackConsole.tsx`

**Interfaces:**
- Consumes: `POST`/`DELETE /api/log`, `/api/learned`, `/api/bookmarks` (Task 3).
- Produces: nothing consumed by later tasks — this is the last task in the plan.

This file runs under `// @ts-nocheck` — lint is the only static check; no typecheck coverage.

- [ ] **Step 1: Trim the debounced snapshot's outgoing payload**

In `flushCloudSnapshot` (the function modified most recently for the
conflict-recovery-stash feature — search for `const localSnapshot =
buildSnapshot();`), the full `localSnapshot` is still used for the
recovery-file export on conflict (unchanged, don't touch that). Add a
trimmed copy used only for the actual network push:

Find:
```ts
        const localSnapshot = buildSnapshot();
        const result = await pushCloudSnapshot(
          localSnapshot,
          cloudBaseUpdatedAt.current,
          opts,
        );
```
Replace with:
```ts
        const localSnapshot = buildSnapshot();
        // log/learned/bookmarks are synced via their own per-record
        // endpoints now (see handleToggleTopic/addLearned/addBookmark
        // etc. below) — emptied here (not omitted) so AppSnapshot's type
        // stays unchanged everywhere, including localSnapshot itself,
        // which the conflict-recovery-stash export below still uses in
        // full.
        const syncPayload = {
          ...localSnapshot,
          userdata: { ...localSnapshot.userdata, log: [], learned: {}, bookmarks: [] },
        };
        const result = await pushCloudSnapshot(
          syncPayload,
          cloudBaseUpdatedAt.current,
          opts,
        );
```

Leave every other use of `localSnapshot` in this function (the
conflict-recovery-stash `exportAll({...})` call) untouched — it still
reads the full, real `log`/`learned`/`bookmarks` from `localSnapshot.userdata`.

- [ ] **Step 2: Wire `handleToggleTopic`**

Find (around line 1161, per the design's grounding):
```ts
  const handleToggleTopic = useCallback((day, idx, campaignObj) => {
    const currentlyDone = !!(progress[day.id] && progress[day.id][idx]);
    const willBeDone = !currentlyDone;
    const now = Date.now();
    setTopicDone(day.id, idx, willBeDone);

    setLog((prev) =>
      willBeDone
        ? [...prev, { d: day.id, i: idx, at: now }]
        : prev.filter((e) => !(e.d === day.id && e.i === idx)),
    );
```
Replace with:
```ts
  const handleToggleTopic = useCallback((day, idx, campaignObj) => {
    const currentlyDone = !!(progress[day.id] && progress[day.id][idx]);
    const willBeDone = !currentlyDone;
    const now = Date.now();
    setTopicDone(day.id, idx, willBeDone);

    setLog((prev) =>
      willBeDone
        ? [...prev, { d: day.id, i: idx, at: now }]
        : prev.filter((e) => !(e.d === day.id && e.i === idx)),
    );
    if (cloudUserId) {
      if (willBeDone) {
        fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day: day.id, topicIndex: idx }),
        }).catch(() => {});
      } else {
        fetch(`/api/log?day=${encodeURIComponent(day.id)}&topicIndex=${idx}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    }
```

Add `cloudUserId` to this callback's dependency array (find the existing
`[progress, setTopicDone, fireToast]` at the end of `handleToggleTopic` and
change to `[progress, setTopicDone, fireToast, cloudUserId]`).

- [ ] **Step 3: Wire `addLearned`/`updateLearned`/`removeLearned`**

Find (around line 787):
```ts
  const addLearned = useCallback((date, item) => {
    setLearned((prev) => {
      const list = prev[date] || [];
      return { ...prev, [date]: [item, ...list] };
    });
  }, []);
```
Replace with:
```ts
  const addLearned = useCallback((date, item) => {
    setLearned((prev) => {
      const list = prev[date] || [];
      return { ...prev, [date]: [item, ...list] };
    });
    if (cloudUserId) {
      fetch("/api/learned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey: date, item }),
      }).catch(() => {});
    }
  }, [cloudUserId]);
```

Find the complete `updateLearned` function:
```ts
  const updateLearned = useCallback((fromDate, item, toDate) => {
    const dest = toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : fromDate;
    setLearned((prev) => {
      if (dest === fromDate) {
        const list = prev[fromDate] || [];
        return {
          ...prev,
          [fromDate]: list.map((x) => (x.id === item.id ? item : x)),
        };
      }
      const next = { ...prev };
      const remaining = (prev[fromDate] || []).filter((x) => x.id !== item.id);
      if (remaining.length) next[fromDate] = remaining;
      else delete next[fromDate];
      const destList = (prev[dest] || []).filter((x) => x.id !== item.id);
      next[dest] = [item, ...destList];
      return next;
    });
  }, []);
```
Replace it with (the server only needs `dest`, the final `dateKey`, and the
item — the upsert is keyed by `item.id`):
```ts
  const updateLearned = useCallback((fromDate, item, toDate) => {
    const dest = toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : fromDate;
    setLearned((prev) => {
      if (dest === fromDate) {
        const list = prev[fromDate] || [];
        return {
          ...prev,
          [fromDate]: list.map((x) => (x.id === item.id ? item : x)),
        };
      }
      const next = { ...prev };
      const remaining = (prev[fromDate] || []).filter((x) => x.id !== item.id);
      if (remaining.length) next[fromDate] = remaining;
      else delete next[fromDate];
      const destList = (prev[dest] || []).filter((x) => x.id !== item.id);
      next[dest] = [item, ...destList];
      return next;
    });
    if (cloudUserId) {
      fetch("/api/learned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey: dest, item }),
      }).catch(() => {});
    }
  }, [cloudUserId]);
```

Find `removeLearned`:
```ts
  const removeLearned = useCallback((date, id) => {
    setLearned((prev) => {
      const list = (prev[date] || []).filter((x) => x.id !== id);
      const next = { ...prev };
      if (list.length) next[date] = list;
      else delete next[date];
      return next;
    });
  }, []);
```
Replace with:
```ts
  const removeLearned = useCallback((date, id) => {
    setLearned((prev) => {
      const list = (prev[date] || []).filter((x) => x.id !== id);
      const next = { ...prev };
      if (list.length) next[date] = list;
      else delete next[date];
      return next;
    });
    if (cloudUserId) {
      fetch(`/api/learned?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    }
  }, [cloudUserId]);
```

- [ ] **Step 4: Wire `addBookmark`/`updateBookmark`/`removeBookmark`**

Find (around line 824):
```ts
  const addBookmark = useCallback((item) => {
    setBookmarks((prev) => [item, ...(prev || [])]);
  }, []);

  const updateBookmark = useCallback((item) => {
    setBookmarks((prev) => (prev || []).map((x) => (x.id === item.id ? item : x)));
  }, []);

  const removeBookmark = useCallback((id) => {
    setBookmarks((prev) => (prev || []).filter((x) => x.id !== id));
  }, []);
```
Replace with:
```ts
  const addBookmark = useCallback((item) => {
    setBookmarks((prev) => [item, ...(prev || [])]);
    if (cloudUserId) {
      fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      }).catch(() => {});
    }
  }, [cloudUserId]);

  const updateBookmark = useCallback((item) => {
    setBookmarks((prev) => (prev || []).map((x) => (x.id === item.id ? item : x)));
    if (cloudUserId) {
      fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      }).catch(() => {});
    }
  }, [cloudUserId]);

  const removeBookmark = useCallback((id) => {
    setBookmarks((prev) => (prev || []).filter((x) => x.id !== id));
    if (cloudUserId) {
      fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    }
  }, [cloudUserId]);
```

`pinBookmarkFromUrl` (~line 824-877) already calls `addBookmark` then
`updateBookmark` once preview metadata resolves — both legs now get their
own write automatically, no changes needed to `pinBookmarkFromUrl` itself.

- [ ] **Step 5: Wire `handleReset` — bulk-delete-all across the three tables**

Find (~line 907):
```ts
  const handleReset = useCallback(async () => {
    setProgress({});
    setNotes({});
    setRefs({});
    setSrs({});
    setLog([]);
    setLearned({});
    setBookmarks([]);
    if (cloudUserId) {
      void pushCloudSnapshot(
```
Add the three bulk-delete calls right after the `if (cloudUserId) {` line,
before the existing `void pushCloudSnapshot(...)` call:
```ts
    if (cloudUserId) {
      void fetch("/api/log?all=true", { method: "DELETE" }).catch(() => {});
      void fetch("/api/learned?all=true", { method: "DELETE" }).catch(() => {});
      void fetch("/api/bookmarks?all=true", { method: "DELETE" }).catch(() => {});
      void pushCloudSnapshot(
```
(The rest of `handleReset` — the `pushCloudSnapshot({...userdata: emptyUserSnapshot()}, ...)` call and everything after — stays exactly as-is. That push still clears the blob's now-vestigial `log`/`learned`/`bookmarks` fields to empty, which is harmless and consistent with every other snapshot push after this change.)

- [ ] **Step 6: Wire `handleDeletePlan` — bulk-delete `topic_completions` by plan prefix**

Find (~line 938, the non-builtin-plan branch):
```ts
    setPlans((prev) => {
      const next = { ...prev };
      delete next[planId];
      return next;
    });
    const purged = purgePlanUserData(
      { progress, notes, refs, srs, log, learned, bookmarks },
      planId,
    );
    setProgress(purged.progress);
    setNotes(purged.notes);
    setRefs(purged.refs);
    setSrs(purged.srs);
    setLog(purged.log);
    setLearned(purged.learned || {});
    setBookmarks(purged.bookmarks || []);
```
Add the bulk-delete call right after the local state updates (after
`setBookmarks(purged.bookmarks || []);`):
```ts
    if (cloudUserId) {
      fetch(`/api/log?planId=${encodeURIComponent(planId)}`, { method: "DELETE" }).catch(() => {});
    }
```
`learned`/`bookmarks` are explicitly kept across plan deletes (existing
comment in `purgePlanUserData`, `lib/migration.ts:85-87`) — no bulk-delete
needed for those two here, only `topic_completions`.

Check `handleDeletePlan`'s `useCallback` dependency array and add
`cloudUserId` if it isn't already present.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no new errors. (This file is `// @ts-nocheck` — `npm run
typecheck` doesn't cover it.)

- [ ] **Step 8: Manual verification via dev server**

1. Run `npm run dev`, sign in with a test account with cloud sync
   configured.
2. Check a topic done → confirm (via `db:studio`) a `topic_completions` row
   appears immediately (no ~700ms debounce wait). Uncheck it → row
   disappears immediately.
3. Add a "learned" journal entry → `learned_items` row appears with the
   right `dateKey`. Edit it, including moving it to a different date via
   the UI's date-move affordance → row's `dateKey` updates, same `id`, no
   duplicate row. Delete it → row disappears.
4. Add a bookmark (including via "pin from URL", which does an add then an
   update once preview resolves) → `bookmark_items` row appears, then
   updates in place once the preview arrives. Delete it → row disappears.
5. Trigger "Delete all my data" → all three new tables have zero rows for
   that user afterward, and the blob's `userdata.log/learned/bookmarks` are
   also empty (existing behavior, unchanged).
6. Create a second, non-builtin plan; check some of its topics (creating
   `topic_completions` rows under that plan's day-id prefix); delete that
   plan → only that plan's `topic_completions` rows are gone; any other
   plan's rows, plus all `learned_items`/`bookmark_items`, are untouched.
7. Reload the page (fresh `GET /api/state`) after doing a mix of the above
   → the UI shows the exact same state it had before reload (log entries,
   journal, bookmarks all still there, hydrated from the tables).

Write what you observed for each check into your report.

- [ ] **Step 9: Commit**

```bash
git add components/dualtrack/DualTrackConsole.tsx
git commit -m "$(cat <<'EOF'
Wire log/learned/bookmarks mutations to their per-record endpoints

Each mutation (topic toggle, learned add/update/remove, bookmark
add/update/remove) now fires an immediate, undebounced write to its
own endpoint alongside the existing local state update. The debounced
snapshot push no longer carries real data for these three fields.
handleReset and handleDeletePlan now also bulk-delete the
corresponding rows in the new tables, closing the orphaned-row gap
that would otherwise follow from moving off the blob-rewrite model.
EOF
)"
```
