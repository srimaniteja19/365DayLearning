# Guard against stale-schema snapshot writes on PUT /api/state

## Problem

`sanitizeAppSnapshot` (`lib/exportImport.ts`) never checks the incoming snapshot's
`meta.schemaVersion` against the current `SCHEMA_VERSION` (`lib/types.ts`, currently
`3`). It unconditionally runs `migrateUserData` (`lib/migration.ts`) on every write —
which today only does one thing, a legacy day-id remap (`365-12` → `builtin-365:12`)
— regardless of what version the client declared. That one migration happens to be
idempotent, so with only `SCHEMA_VERSION = 3` ever having existed (confirmed via
`git log -S`: the constant was introduced already at 3, no earlier version ever
shipped), there is no exploitable bug today.

But the safety is accidental: `migrateUserData` isn't parameterized by "from
version" — it has no way to know it needs to do more for an older client. The moment
a future schema bump introduces a shape change that isn't just an ID rename, a stale
browser tab (holding an old JS bundle with an old `SCHEMA_VERSION` baked in) pushing
its old-shaped `userdata` would hit the field-level sanitizers
(`sanitizeRecord`/`progressEntrySchema`/etc.), which silently *drop* anything that
doesn't match the current shape rather than transform it — silent data loss disguised
as normal sanitization. `meta.schemaVersion` itself is also just echoed back as
whatever the client sent, never corrected.

## Goal

Close this gap for every future schema version bump: reject a write from a
demonstrably stale client before it can silently clobber already-migrated data,
forcing that client to re-pull the current snapshot and rebuild its push from there.

## Design

In `PUT /api/state` (`app/api/state/route.ts`), alongside the existing
`baseUpdatedAt` optimistic-concurrency check (which already fetches `existing` from
the DB), add: if `existing` is present and the sanitized incoming snapshot's
`meta.schemaVersion < SCHEMA_VERSION`, return the same 409 response shape the
existing conflict check already uses — `{ error: "conflict", message, snapshot:
serverSnap, updatedAt: serverAt }` — with a schema-specific `message`, instead of
writing.

```ts
if (existing) {
  const serverAt = toIso(existing.updatedAt);
  if (snapshot.meta.schemaVersion < SCHEMA_VERSION) {
    const serverSnap = sanitizeAppSnapshot(existing.snapshot) || existing.snapshot;
    return NextResponse.json(
      {
        error: "conflict",
        message: "Your app version is out of date. Reloaded the latest copy — please refresh.",
        snapshot: serverSnap,
        updatedAt: serverAt,
      },
      { status: 409 },
    );
  }
  if (baseUpdatedAt != null && serverAt && serverAt !== baseUpdatedAt) {
    // existing conflict check, unchanged
  }
}
```

Scope: only applies when `existing` is present. A brand-new user's first-ever save
has no prior migrated data to protect against clobbering, so it's accepted as-is —
matching current behavior and keeping this change minimal.

### Why this needs zero client-side changes

The client already treats any 409 as "adopt the server's snapshot, toast a message"
(`flushCloudSnapshot` in `components/dualtrack/DualTrackConsole.tsx`) — which is
exactly "re-pull and re-migrate": the server's snapshot in the 409 body is always
current/already-sanitized, so adopting it puts the client back on the current shape.
Reusing the existing 409 contract means this is a pure server-side addition.

### Non-goals

- Not fixing `meta.schemaVersion` echo-back (the field currently preserves whatever
  number the client declared, rather than being corrected to reflect that migration
  ran server-side). Nothing currently depends on that field being accurate, and
  correcting it is a separate, independent change.
- Not adding a generic per-version migration registry/pipeline. That's real
  infrastructure this fix doesn't need — the guard's whole point is to make a stale
  write fail loudly (409) instead of silently, not to make the current
  single-migration setup handle arbitrary future shape changes automatically.
- No client-side changes.

### Testing

This repo has no test coverage for `app/api/*/route.ts` handlers (no existing
precedent — they'd require mocking the Drizzle query builder chain and
`next-auth`'s `auth()`, which no test in this codebase currently does). The added
logic is a single boolean comparison against already-well-tested helpers
(`sanitizeAppSnapshot`, `toIso`), so this follows the existing convention: no new
test file. Verification is `npm run typecheck` / `npm run lint`, plus a manual
code-trace against the following scenarios (documented in the implementation plan)
since a live end-to-end check isn't possible in this environment without real
`DATABASE_URL`/session credentials:
1. No existing row (new user) + stale `schemaVersion` → accepted (write succeeds).
2. Existing row + stale `schemaVersion` → 409 with the schema-specific message, no
   write.
3. Existing row + current `schemaVersion` + matching `baseUpdatedAt` → write
   succeeds (unchanged).
4. Existing row + current `schemaVersion` + stale `baseUpdatedAt` → 409 with the
   existing conflict message (unchanged).
