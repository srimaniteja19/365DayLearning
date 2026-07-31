# Snapshot-size warning at 60% of cap

## Problem

`PUT /api/state` rejects any snapshot payload over `MAX_SNAPSHOT_CHARS`
(5,000,000, `app/api/state/route.ts:20`) with a hard 413. There is no
warning before that point — a user approaching the cap gets no signal
until a save outright fails, at which point autosave silently stops
working for them with no explanation.

**Scope note:** this item was originally framed around `log` specifically
("the growth vector toward your 5M-char cap"). Item #7 (already shipped)
moved `log`, `learned`, and `bookmarks` out of the snapshot blob entirely
into their own per-record tables, removing them from what counts against
this cap. What remains in the snapshot — `plans`, `meta`, `progress`,
`notes`, `refs`, `srs` — is far less likely to approach 5MB, but the
underlying problem (no warning before a hard failure) is still real and
worth closing.

## Goal

Warn the affected user, once, the first time in a session that their
outgoing snapshot crosses 60% of the cap — before they ever hit the 413.

## Design

### Shared constant

`MAX_SNAPSHOT_CHARS` currently lives only in `app/api/state/route.ts`.
Move it to `lib/types.ts` (alongside `SCHEMA_VERSION`, which both client
and server already import from there) so the client-side warning threshold
and the server-side hard cap can never drift apart:

```ts
// lib/types.ts
export const MAX_SNAPSHOT_CHARS = 5_000_000;
```

`app/api/state/route.ts` imports it from there instead of declaring its
own local constant.

### Client-side size check

In `flushCloudSnapshot` (`components/dualtrack/DualTrackConsole.tsx`),
after `syncPayload` is built (the trimmed payload — log/learned/bookmarks
already emptied per item #7's change) and before `pushCloudSnapshot` is
called, compute the payload's serialized size once:

```ts
const payloadSize = JSON.stringify(syncPayload).length;
```

If `payloadSize >= MAX_SNAPSHOT_CHARS * 0.6` and the warning hasn't
already fired this session, show a toast:

```ts
fireToast(
  "Your account data is getting large — export a backup or trim old notes soon.",
  "warn",
);
```

matching the existing `fireToast(msg, "warn")` pattern already used
elsewhere in this file (e.g. the conflict-recovery-stash toast).

### Once per session, not per save

A `useRef` flag (e.g. `warnedSnapshotSizeRef`, alongside the file's
existing `cloudBaseUpdatedAt` ref pattern) tracks whether the warning has
already fired. Without this, every debounced save (~700ms after each edit)
while over threshold would re-fire the toast, which given the toast's
2.6s auto-dismiss (`fireToast`'s existing behavior) would be a near-constant
visual spam. Confirmed via design discussion: a single warning per session
is the intended behavior, not periodic re-warning — the user explicitly
chose this over a "re-warn every N minutes" alternative.

## Non-goals

- No change to the hard 413 cap itself or its value.
- No server-side warning/logging — client-only, per design discussion (the
  concern is the affected user not knowing, not operator visibility).
- No dismissal-persistence across sessions (e.g. localStorage) — a fresh
  page load re-arms the one-time-per-session warning, which is fine: if
  they're still over threshold next session, warning again is correct
  behavior, not a bug.
- No revisiting item #5's original "compact log entries" bullet — moot
  after item #7 moved `log` out of the snapshot entirely.

## Testing

- `flushCloudSnapshot` and the rest of `DualTrackConsole.tsx` have no test
  harness in this repo (`// @ts-nocheck`, consistent with the rest of the
  UI layer) — manual verification via dev server: temporarily lower the
  effective threshold (or construct a large enough `notes`/`refs` payload)
  to cross 60%, confirm the toast fires once and not on subsequent saves
  in the same session.
- The `MAX_SNAPSHOT_CHARS` relocation is a pure constant move — confirm
  `app/api/state/route.ts`'s existing 413 behavior is unchanged (still
  rejects payloads over the same 5,000,000-char value).
