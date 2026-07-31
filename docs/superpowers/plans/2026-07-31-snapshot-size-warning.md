# Snapshot-Size Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warn the affected user, once per session, the first time their outgoing snapshot crosses 60% of `MAX_SNAPSHOT_CHARS` — before they ever hit the server's hard 413.

**Architecture:** Move `MAX_SNAPSHOT_CHARS` from `app/api/state/route.ts` into `lib/types.ts` so client and server share one value; compute the trimmed sync payload's serialized size in `flushCloudSnapshot` and fire a one-time toast when it crosses 60% of that shared constant.

**Tech Stack:** React (`components/dualtrack/DualTrackConsole.tsx`, `// @ts-nocheck`, no typecheck coverage — lint is the only static check for that file).

## Global Constraints

- The 413 cap value itself does not change — only a new, earlier warning is added.
- Client-only — no server-side logging of this warning (per design discussion).
- Warn once per session (a fresh page load re-arms it), not periodically — explicitly chosen over a re-warn-every-N-minutes alternative.
- `MAX_SNAPSHOT_CHARS` must live in exactly one place (`lib/types.ts`) — both `app/api/state/route.ts` and `DualTrackConsole.tsx` import it from there, so the client-side warning threshold can never drift from the server's actual cap.

---

### Task 1: Shared constant + client-side warning

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/api/state/route.ts`
- Modify: `components/dualtrack/DualTrackConsole.tsx`

**Interfaces:**
- Produces: `MAX_SNAPSHOT_CHARS` exported from `lib/types.ts` — consumed by both files below. No other consumers.

- [ ] **Step 1: Move `MAX_SNAPSHOT_CHARS` into `lib/types.ts`**

In `lib/types.ts`, find the existing `SCHEMA_VERSION` declaration:
```ts
/** Current multi-plan schema. */
export const SCHEMA_VERSION = 3;
```
Add immediately after it:
```ts

/**
 * Hard cap on a serialized AppSnapshot PUT body (app/api/state/route.ts) —
 * shared with the client so the size-warning threshold in
 * DualTrackConsole.tsx's flushCloudSnapshot can never drift from the
 * server's actual limit.
 */
export const MAX_SNAPSHOT_CHARS = 5_000_000;
```

- [ ] **Step 2: Update `app/api/state/route.ts` to import it**

Find:
```ts
import { SCHEMA_VERSION, type AppSnapshot } from "@/lib/types";
```
Replace with:
```ts
import { MAX_SNAPSHOT_CHARS, SCHEMA_VERSION, type AppSnapshot } from "@/lib/types";
```

Find and remove the now-duplicate local declaration:
```ts
// A serialized AppSnapshot (plans + progress + notes + srs + learned journal
// etc.) for a very active user is still well under this — this cap just
// guards against pathological payloads.
const MAX_SNAPSHOT_CHARS = 5_000_000;
```
(Delete this whole block — the comment's content is now covered by the
new doc comment in `lib/types.ts`; the constant itself is imported.)

Everything else in this file that references `MAX_SNAPSHOT_CHARS` (the
413 check in `PUT`) is unchanged — same name, same value, now imported
instead of locally declared.

- [ ] **Step 3: Add the warning ref and import in `DualTrackConsole.tsx`**

Find the existing `cloudBaseUpdatedAt` ref declaration:
```ts
  const cloudBaseUpdatedAt = useRef(null);
```
Add immediately after it:
```ts
  const warnedSnapshotSizeRef = useRef(false);
```

Find this file's existing import from `@/lib/types` (it already imports
`SCHEMA_VERSION` — read the current import line to get its exact current
member list before editing) and add `MAX_SNAPSHOT_CHARS` to it.

- [ ] **Step 4: Compute size and warn in `flushCloudSnapshot`**

Find:
```ts
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
Replace with:
```ts
      const syncPayload = {
        ...localSnapshot,
        userdata: { ...localSnapshot.userdata, log: [], learned: {}, bookmarks: [] },
      };
      const payloadSize = JSON.stringify(syncPayload).length;
      if (payloadSize >= MAX_SNAPSHOT_CHARS * 0.6 && !warnedSnapshotSizeRef.current) {
        warnedSnapshotSizeRef.current = true;
        fireToast(
          "Your account data is getting large — export a backup or trim old notes soon.",
          "warn",
        );
      }
      const result = await pushCloudSnapshot(
        syncPayload,
        cloudBaseUpdatedAt.current,
        opts,
      );
```

`fireToast` is already in this `useCallback`'s dependency array (it's
used later in the same function's conflict branch) — no dependency-array
change needed.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors. (`DualTrackConsole.tsx` is `// @ts-nocheck` —
typecheck doesn't cover it; `lib/types.ts` and `app/api/state/route.ts`
are fully covered.)

- [ ] **Step 6: Manual verification via dev server**

No test harness exists for `DualTrackConsole.tsx` or `app/api/state/route.ts`
in this repo — verify by hand:

1. Temporarily edit `flushCloudSnapshot`'s threshold check locally (not
   committed) to something trivially crossed by real data, e.g.
   `payloadSize >= 500` instead of `payloadSize >= MAX_SNAPSHOT_CHARS * 0.6`.
2. Run `npm run dev`, sign in with a test account with cloud sync
   configured, make any small edit (e.g. type a note) to trigger a
   debounced save.
3. Confirm the toast text and `"warn"` styling match the existing warning
   toasts (e.g. the conflict-recovery-stash toast) — same visual treatment,
   no code change needed there since `fireToast` is reused as-is.
4. Make another edit (triggering another debounced save) while still over
   threshold — confirm the toast does **not** fire again (the ref guard
   working).
5. Reload the page and make an edit while still over threshold — confirm
   the toast fires again (fresh session re-arms it, per the design's
   explicit non-goal of no cross-session persistence).
6. Confirm `PUT /api/state`'s 413 behavior is unchanged: send an
   over-cap payload directly (`curl` with a large JSON body, signed-in
   session cookie) and confirm it still 413s at the same threshold as
   before this change.

Write what you observed for each check into your report.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts app/api/state/route.ts components/dualtrack/DualTrackConsole.tsx
git commit -m "$(cat <<'EOF'
Warn the user once per session at 60% of the snapshot-size cap

MAX_SNAPSHOT_CHARS moves to lib/types.ts so the client's warning
threshold can't drift from the server's actual 413 cap.
flushCloudSnapshot now computes the trimmed sync payload's size and
fires a one-time toast the first time it crosses 60% of the cap,
before the user ever hits a hard save failure.
EOF
)"
```
