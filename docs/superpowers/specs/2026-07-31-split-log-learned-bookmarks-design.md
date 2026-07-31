# Split log/learned/bookmarks out of the snapshot

## Problem

All user state — `plans`, and `userdata: {progress, notes, refs, srs, log, learned, bookmarks}`
— syncs to the cloud as one JSON blob in a single Postgres row
(`userState` table, `lib/db/schema.ts:34-40`), read/written wholesale via
`GET`/`PUT /api/state` (`app/api/state/route.ts`). The client's debounced
autosave (`flushCloudSnapshot`, `components/dualtrack/DualTrackConsole.tsx`,
~700ms after any change) rewrites the *entire* blob on every save — editing
one note re-serializes the user's whole completion history, journal, and
bookmark collection along with it. `PUT /api/state` guards against
pathological payloads with `MAX_SNAPSHOT_CHARS = 5_000_000`
(`app/api/state/route.ts:13`).

Splitting `log`, `learned`, and `bookmarks` into their own per-user tables
with per-record writes removes this coupling: a note edit only touches the
snapshot; a topic toggle only touches one row in a completions table. It
also removes the hard blob-size ceiling these three collections currently
share with everything else — table storage has no comparable practical cap.

**Framing note:** initial scoping named `log` as "the growth vector" toward
the size cap. Code inspection didn't find that framing anywhere in the
repo, and `log` is actually self-bounding today — entries are added on
topic-check and removed on uncheck (`DualTrackConsole.tsx:1161-1200`),
capped by total topic count. The more plausible unbounded-growth fields are
`learned[].body` (no character cap, `lib/learned.ts:108-133`) and
un-deduped `log` growth via merge-import (`lib/exportImport.ts:437`). This
doesn't change the value of the refactor — it's still the right
architectural fix, and it directly reduces the size and write frequency of
every snapshot save regardless of which field is the actual pressure point.

## Goal

Move `log`, `learned`, `bookmarks` to dedicated per-user tables with
per-record CRUD, while the client's in-memory shape (`UserDataState.log:
LogEntry[]`, `.learned: LearnedMap`, `.bookmarks: BookmarksList`,
`lib/types.ts:123-163`) and every UI-facing behavior stay identical. Only
the persistence layer changes.

## Data model

Three new per-user tables (`lib/db/schema.ts`), the first per-user,
per-record tables in this schema — the existing `topic_resource_cache`
(`lib/db/schema.ts:47-55`) is per-record but shared/non-per-user, so it
doesn't need `userId` scoping the way these do.

```ts
export const topicCompletions = pgTable(
  "topic_completions",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    topicIndex: integer("topic_index").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.topicIndex] })],
);

export const learnedItems = pgTable("learned_items", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dateKey: text("date_key").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  insight: text("insight"),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const bookmarkItems = pgTable("bookmark_items", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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

- `topicCompletions`'s composite PK `(userId, day, topicIndex)` matches the
  existing `LogEntry = {d, i, at}` key exactly (`lib/types.ts:123`) — a
  toggle-on is an upsert (`onConflictDoUpdate` on the PK, updating
  `completedAt`), a toggle-off is a `DELETE`.
- `learnedItems`/`bookmarkItems` reuse the existing client-minted `id`
  (`createLearnedId()`/`createBookmarkId()`, `lib/learned.ts:17-19`,
  `lib/bookmarks.ts:8-10`) as the primary key — add/update/remove map
  directly to insert/update/delete by `id`.
- `learnedItems.dateKey` is a real column, not derived from `createdAt`:
  `updateLearned(fromDate, item, toDate)` (`DualTrackConsole.tsx:794-810`)
  can move an item to a different date than it was created on, so the
  grouping key must be stored explicitly.

## Write path

`buildSnapshot()`'s outgoing payload to `PUT /api/state` stops carrying
`log`/`learned`/`bookmarks` — omitted, not emptied. Each mutation instead
fires its own direct, immediate (no debounce) request the moment it
happens, alongside the existing local `setLog`/`setLearned`/`setBookmarks`
state update:

- `handleToggleTopic` (`DualTrackConsole.tsx:1161-1200`) — `POST` upsert on
  check, `DELETE` on uncheck, keyed by `(day, topicIndex)`.
- `addLearned`/`updateLearned`/`removeLearned`
  (`DualTrackConsole.tsx:787-819`) — `POST`/`PATCH`/`DELETE` by `id`.
- `addBookmark`/`updateBookmark`/`removeBookmark`
  (`DualTrackConsole.tsx:824-834`) — same pattern. `pinBookmarkFromUrl`
  (`:824-877`) already calls `addBookmark` then `updateBookmark` once
  preview metadata resolves — both legs get their own write, unchanged
  control flow.

No debounce, no batching: per-record payloads are tiny, and this is the
actual mechanism that removes the coupling to unrelated snapshot saves. No
optimistic-concurrency check on these writes (per design discussion) —
each record is now independently atomic, so cross-device conflicts on
*different* records are structurally impossible, and last-write-wins on the
*same* record (e.g. two devices toggling the same topic) is harmless.

New route files, following `app/api/state/route.ts`'s conventions
(`hasDatabase()`, `isSameOrigin(req)`, `auth()` session check,
`logError()` on failure):
- `app/api/log/route.ts` — `POST` (upsert), `DELETE` (by day+topicIndex,
  via query params or body)
- `app/api/learned/route.ts` — `POST`, `PATCH`, `DELETE` (by id)
- `app/api/bookmarks/route.ts` — `POST`, `PATCH`, `DELETE` (by id) — note
  this is a **different** route from the existing
  `app/api/bookmarks/preview/route.ts` (OG-preview fetch, unrelated,
  untouched).

## Read path

`GET /api/state` keeps returning the exact same `AppSnapshot` shape the
client already expects — `applyCloudSnapshot`
(`DualTrackConsole.tsx:433-449`) doesn't change. Server-side, the handler
additionally queries the three new tables for the signed-in user and merges
their rows into `userdata.log`/`learned`/`bookmarks` before responding,
reconstructing `LearnedMap`'s date-keyed grouping from `learnedItems` rows.

**Backfill-on-read:** if the three new tables are empty for a user but
their stored `userState.snapshot.userdata` still has non-empty
`log`/`learned`/`bookmarks` (pre-cutover data), the GET handler does a
one-time migration insert from the blob into the new tables before
responding, using `onConflictDoNothing` so a repeated GET before the user's
next save (which is when the old blob's copies actually get overwritten
away, since `PUT` replaces `snapshot` wholesale) is harmless and idempotent.

Analytics/streak reads (`features/ui/Views.tsx:2430,2445-2468`, `WeeklyView`)
and the "on this day" memory widget (`lib/onThisDay.ts:17-56`) already
consume the full in-memory `log`/`learned` — unchanged, since hydration
still delivers the full history in the same shape.

## Export/import

`lib/exportImport.ts`'s `exportAll()`/`applyFullImport()`
(`:113-137`, `:401-446`) operate entirely on the in-memory
`AppDataSlice`/`UserDataState` shape, which is unchanged — the client's
React state for `log`/`learned`/`bookmarks` still holds the full data, same
as today. The existing backup-download and conflict-recovery-stash feature
(`docs/superpowers/specs/2026-07-31-conflict-recovery-stash-design.md`)
both keep working with zero code changes there.

## Non-goals

- No offline write queue — there isn't one today (`lib/storage.ts:81-88`
  only purges legacy pre-Neon local storage on sign-in; all persistence for
  signed-in users is cloud-only). This refactor makes offline support more
  tractable later (per-record boundaries instead of one blob), but doesn't
  add it.
- No pagination on reads — analytics and export need full history; table
  storage removes the hard size ceiling without needing to limit what's
  fetched.
- No per-record conflict/versioning — per design discussion above.
- No `SCHEMA_VERSION` bump — this is backward-compatible: old snapshots
  with `log`/`learned`/`bookmarks` still present are read fine (extra
  fields simply get backfilled and ignored going forward); no client needs
  to reject another client's data shape. **Still subject to the existing
  livelock-risk guard** (project memory
  `schema_version_bump_livelock_risk.md`) if a future change *does* require
  a version bump — not relevant to this change itself.
- No change to `plans`/`meta`/`progress`/`notes`/`refs`/`srs` persistence —
  they stay in the snapshot blob exactly as today.
- No retry queue for a failed per-record write — matches the "no offline
  path today" reality; a failed write surfaces via the existing toast
  pattern (`fireToast`) and local state stays authoritative (already true
  today for the debounced snapshot path, which also just retries on the
  next natural save trigger).

## Testing

- New DB access modules (one per table, modeled loosely on
  `lib/db/topicResourceCache.ts`'s structure) are testable directly if this
  repo gains DB-mocked unit tests for them; otherwise manual verification
  via dev server + `db:studio`, consistent with `app/api/state/route.ts`
  having no existing test file.
- New route handlers — no route-handler test file exists anywhere in this
  repo today; manual verification via dev server, matching the precedent
  from the error-monitoring-telemetry endpoint.
- Backfill-on-read — manually verify with a seeded row containing legacy
  `userdata.log`/`learned`/`bookmarks` data, confirm one GET migrates it
  into the new tables and a subsequent PUT's stored blob no longer carries
  those fields.
- `handleToggleTopic`/`addLearned`/etc. — `DualTrackConsole.tsx` has no
  test coverage today (`// @ts-nocheck`, no test harness for this
  component); manual verification via dev server, exercising each mutation
  and confirming the corresponding table row appears/updates/disappears.
