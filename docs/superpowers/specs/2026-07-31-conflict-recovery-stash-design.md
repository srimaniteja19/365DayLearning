# Recovery stash before adopting server snapshot on 409 conflict

## Problem

`flushCloudSnapshot` (`components/dualtrack/DualTrackConsole.tsx`) is the debounced
autosave path that pushes local edits to `PUT /api/state` roughly 700ms after any
change. When the server responds 409 (conflict — either a stale `baseUpdatedAt` or,
as of a recent change, a stale `schemaVersion`), the client currently does this
unconditionally:

```ts
if (result.conflict) {
  if (result.snapshot) {
    applyCloudSnapshot(result.snapshot);
  }
  cloudBaseUpdatedAt.current = result.updatedAt ?? cloudBaseUpdatedAt.current;
  fireToast(result.error || "Cloud data changed elsewhere — reloaded.", "warn");
  return true;
}
```

`applyCloudSnapshot` overwrites every piece of local state — `progress`, `notes`,
`refs`, `srs`, `log`, `learned`, `bookmarks`, `plans`, `activePlanId`, `themeKey`,
`fontKey` — with the server's copy. Whatever local edits triggered this save (and
anything typed since) are gone, with no way to get them back. This is a real,
user-visible data-loss path: two tabs open, a device that reconnects after being
offline, or simply two edits landing close together across devices.

## Goal

Minimum viable fix: before adopting the server's snapshot, preserve what's about to
be overwritten somewhere the user can actually get it back, and tell them plainly
that happened. Not a merge — a safety net.

## Design

### Capture point

Inside `flushCloudSnapshot`'s `if (result.conflict)` branch, before
`applyCloudSnapshot(result.snapshot)` runs, call `buildSnapshot()` again (fresh —
not the snapshot object already sent in the request) to capture current local state,
including anything typed during the in-flight network request.

### Recovery mechanism: a real downloadable file, reusing existing backup infra

The app already has a full-backup export feature (`exportAll()` +
`serializeExport()` in `lib/exportImport.ts`, used today by the "Data & export"
modal's JSON export) and a generic file-download helper (`downloadText()` in
`lib/fileIo.ts`). Reuse both:

```ts
const payload = exportAll({
  plans,
  userdata: { progress, notes, refs, srs, log, learned, bookmarks },
  themeKey,
  activePlanId,
});
const js = serializeExport(payload);
const filename = `refrainly-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const downloaded = downloadText(filename, js, "application/json");
```

This is the *same* backup format the app already knows how to re-import via its
existing Merge-import flow — no new file format, no new import code.

**Fallback**: if `downloadText` returns `false` (download blocked — rare), stash the
same JSON string in `localStorage` under a single fixed key (e.g.
`refrainly:conflict-recovery`), overwritten on each occurrence — this is the
localStorage approach originally proposed, kept as a last-resort path rather than
the primary one, since the primary path can't fail silently (an actual file is
either downloaded or `downloadText` explicitly reports it wasn't).

### Toast

Replace the current `fireToast(result.error || "Cloud data changed elsewhere — reloaded.", "warn")`
with wording that reflects what actually happened:
- Download succeeded: `"Your recent changes were saved to a recovery file."`
- Download blocked, localStorage fallback used: a distinct message that doesn't
  claim a file was saved (e.g. `"Your recent changes were saved locally for recovery."`)
  — the toast must never say "file" when nothing was downloaded.

### What stays unchanged

- `applyCloudSnapshot(result.snapshot)` still runs immediately after the stash —
  local state is still fully replaced by the server's copy. This is a recovery net,
  not a merge; the user manually re-imports the recovery file via the existing
  Merge-import flow if they need specific data back.
- `cloudBaseUpdatedAt.current` update, and the function's `return true` — unchanged.
- No special-casing on the 409 `reason` field (`"schema-version"` vs `"stale-base"`)
  — this fix applies uniformly to any conflict. The schema-version-specific livelock
  risk (tracked separately — see project memory
  `schema_version_bump_livelock_risk.md`) is a different, already-tracked problem;
  this stash doesn't make it better or worse, since `SCHEMA_VERSION` bumps are
  gated on that separate fix landing first regardless.

## Non-goals

- No field-level merge (union log, union checked topics, last-write-wins notes) —
  that's the separately-deferred "better fix."
- No retrieval UI for the rare localStorage-fallback path. If a user ever hits it,
  the data is recoverable via browser devtools; building a proper in-app affordance
  for this edge case is unnecessary for an MVP.
- `handleReset`'s own conflict handling (`components/dualtrack/DualTrackConsole.tsx`,
  the "Delete all my data" flow) is untouched — it's a different flow with a
  different risk shape (local state is already emptied by that point, so there's
  nothing local to protect; the risk there is a wipe silently not persisting, not
  data loss). Out of scope for this task.
- No change to `PUT /api/state` or `lib/cloudSync.ts` — purely a client-side change
  to `flushCloudSnapshot`'s existing conflict branch.

## Testing

No existing test file covers `DualTrackConsole.tsx` (a large stateful React
component with no test harness in this repo — consistent with the rest of this
codebase's UI layer). Verification is manual: exercise the conflict path (achievable
by simulating a 409 response) and confirm a file downloads with the recovery data
intact and re-importable, and that the fallback path stashes correctly when download
is blocked.
