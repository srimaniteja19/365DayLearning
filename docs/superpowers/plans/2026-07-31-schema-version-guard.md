# Stale-Schema Write Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject a `PUT /api/state` write from a client whose declared `schemaVersion` is behind the server's current `SCHEMA_VERSION`, when there's existing data it could otherwise silently clobber.

**Architecture:** A single additional check in `app/api/state/route.ts`'s `PUT` handler, alongside the existing `baseUpdatedAt` optimistic-concurrency check (which already fetches `existing` from the DB). Reuses the existing 409 response shape — the client already adopts the server's returned snapshot on any 409, so no client-side change is needed.

**Tech Stack:** Next.js Route Handler (Node runtime), Drizzle ORM, existing `sanitizeAppSnapshot`/`SCHEMA_VERSION` from `lib/exportImport.ts`/`lib/types.ts`.

## Global Constraints

- The guard only applies when `existing` (a prior saved row for this user) is present. A brand-new user's first-ever save is accepted as-is, regardless of declared `schemaVersion`.
- Reuse the existing 409 response shape exactly: `{ error: "conflict", message, snapshot: serverSnap, updatedAt: serverAt }`, so the client's existing 409 handling (adopt the returned snapshot) works unmodified.
- No client-side changes.
- No new test file — this repo has no precedent for testing `app/api/*/route.ts` handlers directly (would require mocking the Drizzle query builder chain and `next-auth`'s `auth()`, which nothing in this codebase currently does). Verification is typecheck/lint plus a manual code-trace against the four scenarios in Task 1.

---

### Task 1: Add the schema-version guard to `PUT /api/state`

**Files:**
- Modify: `app/api/state/route.ts` (add one import, add one check inside the existing `try` block)

**Interfaces:**
- Consumes: `SCHEMA_VERSION` (number constant, exported from `lib/types.ts`), `sanitizeAppSnapshot` (already imported), `toIso` (already defined in this file).
- Produces: no new exports — this is a self-contained change to the `PUT` handler's control flow.

- [ ] **Step 1: Add the `SCHEMA_VERSION` import**

In `app/api/state/route.ts`, change line 1-7 from:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, hasDatabase } from "@/lib/db/client";
import { userState } from "@/lib/db/schema";
import { sanitizeAppSnapshot } from "@/lib/exportImport";
import { isSameOrigin } from "@/lib/httpGuard";
```

to:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, hasDatabase } from "@/lib/db/client";
import { userState } from "@/lib/db/schema";
import { sanitizeAppSnapshot } from "@/lib/exportImport";
import { isSameOrigin } from "@/lib/httpGuard";
import { SCHEMA_VERSION } from "@/lib/types";
```

- [ ] **Step 2: Add the schema-version check**

In the same file, find this block (currently around line 87-109):

```ts
  try {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(userState)
      .where(eq(userState.userId, userId))
      .limit(1);

    if (existing && baseUpdatedAt != null) {
      const serverAt = toIso(existing.updatedAt);
      if (serverAt && serverAt !== baseUpdatedAt) {
        const serverSnap = sanitizeAppSnapshot(existing.snapshot) || existing.snapshot;
        return NextResponse.json(
          {
            error: "conflict",
            message: "Cloud data changed on another device. Reloaded the latest copy.",
            snapshot: serverSnap,
            updatedAt: serverAt,
          },
          { status: 409 },
        );
      }
    }
```

Replace it with:

```ts
  try {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(userState)
      .where(eq(userState.userId, userId))
      .limit(1);

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
        const serverSnap = sanitizeAppSnapshot(existing.snapshot) || existing.snapshot;
        return NextResponse.json(
          {
            error: "conflict",
            message: "Cloud data changed on another device. Reloaded the latest copy.",
            snapshot: serverSnap,
            updatedAt: serverAt,
          },
          { status: 409 },
        );
      }
    }
```

Everything after this block (the `insert`/`onConflictDoUpdate` and the `catch`) is unchanged.

- [ ] **Step 3: Typecheck and lint**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: both pass with no new errors.

- [ ] **Step 4: Manual code-trace verification**

This repo has no test harness for `app/api/*/route.ts` handlers (they'd need a mocked Drizzle query builder and a mocked `next-auth` `auth()`, neither of which exists as a pattern here), and a live end-to-end check isn't possible in this environment without real `DATABASE_URL`/session credentials. Instead, trace the new code by hand against these four scenarios and write the trace into your report:

1. **No existing row (new user) + stale `schemaVersion`**: `existing` is `undefined` → the whole `if (existing)` block is skipped → falls through to the `insert`/`onConflictDoUpdate` → write succeeds. Confirm by reading the code that `snapshot.meta.schemaVersion` is never referenced when `existing` is falsy.
2. **Existing row + stale `schemaVersion`** (e.g. `snapshot.meta.schemaVersion` is `2`, `SCHEMA_VERSION` is `3`): `existing` is truthy → `snapshot.meta.schemaVersion < SCHEMA_VERSION` is `true` → returns 409 with the new schema-specific message, `serverSnap`, `serverAt` — before ever reaching the `baseUpdatedAt` check or the write.
3. **Existing row + current `schemaVersion` + matching `baseUpdatedAt`**: `existing` truthy → schema check is `false` (not stale) → falls into the `baseUpdatedAt` check → `serverAt === baseUpdatedAt` → that check's condition is `false` → falls through to the write → write succeeds. Unchanged from today's behavior.
4. **Existing row + current `schemaVersion` + stale `baseUpdatedAt`**: schema check `false` → `baseUpdatedAt` check `true` → returns 409 with the original conflict message. Unchanged from today's behavior.

Confirm in your trace that `snapshot` (the sanitized snapshot, assigned earlier in the handler via `const snapshot = sanitizeAppSnapshot(payload?.snapshot);`) always has a numeric `meta.schemaVersion` — verify this by reading `sanitizeAppSnapshot` in `lib/exportImport.ts` (it defaults to `SCHEMA_VERSION` when the incoming value isn't a number), so `snapshot.meta.schemaVersion < SCHEMA_VERSION` never throws or compares against `undefined`.

- [ ] **Step 5: Commit**

```bash
git add app/api/state/route.ts
git commit -m "$(cat <<'EOF'
Reject stale-schema writes to PUT /api/state

sanitizeAppSnapshot silently ran its one existing migration
(legacy day-id remap) unconditionally regardless of the client's
declared schemaVersion, with no guard for a future schema change
that isn't just an idempotent rename. A stale tab's write could
silently clobber already-migrated data via the generic field
sanitizers, which drop rather than transform unrecognized shapes.
This rejects with 409 (reusing the existing conflict response
shape, so the client's existing "adopt server snapshot" handling
applies unmodified) whenever a write's declared schemaVersion is
behind the server's, and there's existing data to protect.
EOF
)"
```
