# Conflict-Recovery Stash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before `flushCloudSnapshot` adopts the server's snapshot on a 409 conflict (overwriting local state), preserve what's about to be overwritten as a downloadable, re-importable recovery file, and tell the user plainly what happened.

**Architecture:** A self-contained change to `flushCloudSnapshot`'s existing conflict branch in `components/dualtrack/DualTrackConsole.tsx`, reusing the app's existing backup-export functions (`exportAll`/`serializeExport` from `lib/exportImport.ts`) and file-download helper (`downloadText` from `lib/fileIo.ts`) — no new file format, no new import code, no server-side changes.

**Tech Stack:** React (function component, hooks) — same file/patterns as the rest of `DualTrackConsole.tsx` (which runs under `// @ts-nocheck`, so no typecheck coverage for this file, consistent with the rest of the codebase's UI layer).

## Global Constraints

- Reuse `exportAll()` + `serializeExport()` (already used by the existing "Data & export" JSON backup feature) — do not invent a new serialization format.
- Reuse `downloadText()` (already used by the same existing export feature) for the primary recovery path.
- Fallback to `localStorage` under a single fixed key (`refrainly:conflict-recovery`, overwritten each time) only if `downloadText` returns `false`.
- Toast text must accurately reflect what happened: `"Your recent changes were saved to a recovery file."` when the download succeeded, `"Your recent changes were saved locally for recovery."` when the localStorage fallback was used — never claim a file was saved when it wasn't.
- `applyCloudSnapshot(result.snapshot)` still runs afterward, unchanged — this is a safety net, not a merge.
- No changes to `PUT /api/state`, `lib/cloudSync.ts`, or the `if (!result.snapshot)` branch (no conflict snapshot to adopt — nothing local is overwritten, so nothing to stash).
- No changes to `handleReset`'s separate push path — out of scope (different flow, different risk shape).
- **Implementation note vs. the spec:** the spec describes calling `buildSnapshot()` again "fresh" at conflict-detection time to capture edits made during the in-flight request. That's not actually achievable this way — `buildSnapshot` inside a given `flushCloudSnapshot` invocation is a closure captured once when that invocation's containing `useCallback` was created; calling it twice within the same invocation returns identical data both times, regardless of state changes during the `await`. This plan instead captures `buildSnapshot()`'s result **once**, before the push, and reuses that same value for both the push payload and (if needed) the recovery export — technically simpler and equivalent in what it actually captures. This doesn't change any user-facing behavior described in the spec.

---

### Task 1: Stash a recovery file before adopting the server's snapshot on conflict

**Files:**
- Modify: `components/dualtrack/DualTrackConsole.tsx` (add two imports, replace the body of `flushCloudSnapshot`)

**Interfaces:**
- Consumes: `exportAll(slice: { plans, userdata, themeKey, activePlanId }): FullBackupFile` and `serializeExport(payload): string` (both already exported from `lib/exportImport.ts`, unchanged); `downloadText(filename: string, text: string, mime?: string): boolean` (already exported from `lib/fileIo.ts`, unchanged).
- Produces: no new exports — this is a self-contained change to `flushCloudSnapshot`'s internals. Its existing signature (`async (opts) => boolean`) and existing callers (the debounced save effect, the `pagehide`/`beforeunload` effect) are unchanged.

- [ ] **Step 1: Add the two new imports**

In `components/dualtrack/DualTrackConsole.tsx`, find this line (around line 44):

```ts
import { purgePlanUserData } from "@/lib/migration";
```

Add immediately after it:

```ts
import { exportAll, serializeExport } from "@/lib/exportImport";
import { downloadText } from "@/lib/fileIo";
```

- [ ] **Step 2: Replace `flushCloudSnapshot`**

Find this block (around line 652-676):

```ts
  const flushCloudSnapshot = useCallback(
    async (opts) => {
      if (!cloudReady || !cloudUserId) return false;
      const result = await pushCloudSnapshot(
        buildSnapshot(),
        cloudBaseUpdatedAt.current,
        opts,
      );
      if (result.ok) {
        cloudBaseUpdatedAt.current = result.updatedAt;
        return true;
      }
      if (result.conflict) {
        if (result.snapshot) {
          applyCloudSnapshot(result.snapshot);
          // Do not re-kick enrichment here — that races with in-flight saves.
        }
        cloudBaseUpdatedAt.current = result.updatedAt ?? cloudBaseUpdatedAt.current;
        fireToast(result.error || "Cloud data changed elsewhere — reloaded.", "warn");
        return true;
      }
      return false;
    },
    [cloudReady, cloudUserId, buildSnapshot, applyCloudSnapshot, fireToast],
  );
```

Replace it with:

```ts
  const flushCloudSnapshot = useCallback(
    async (opts) => {
      if (!cloudReady || !cloudUserId) return false;
      const localSnapshot = buildSnapshot();
      const result = await pushCloudSnapshot(
        localSnapshot,
        cloudBaseUpdatedAt.current,
        opts,
      );
      if (result.ok) {
        cloudBaseUpdatedAt.current = result.updatedAt;
        return true;
      }
      if (result.conflict) {
        if (result.snapshot) {
          const recoveryPayload = exportAll({
            plans: localSnapshot.plans,
            userdata: localSnapshot.userdata,
            themeKey: localSnapshot.meta.themeKey,
            activePlanId: localSnapshot.meta.activePlanId,
          });
          const recoveryJson = serializeExport(recoveryPayload);
          const recoveryFilename = `refrainly-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
          const downloaded = downloadText(recoveryFilename, recoveryJson, "application/json");
          if (!downloaded) {
            try {
              window.localStorage.setItem("refrainly:conflict-recovery", recoveryJson);
            } catch {
              /* best-effort; nothing more we can do if storage is unavailable */
            }
          }
          applyCloudSnapshot(result.snapshot);
          // Do not re-kick enrichment here — that races with in-flight saves.
          fireToast(
            downloaded
              ? "Your recent changes were saved to a recovery file."
              : "Your recent changes were saved locally for recovery.",
            "warn",
          );
        } else {
          fireToast(result.error || "Cloud data changed elsewhere — reloaded.", "warn");
        }
        cloudBaseUpdatedAt.current = result.updatedAt ?? cloudBaseUpdatedAt.current;
        return true;
      }
      return false;
    },
    [cloudReady, cloudUserId, buildSnapshot, applyCloudSnapshot, fireToast],
  );
```

Note: `localSnapshot.plans` and `localSnapshot.userdata` are exactly the shapes `exportAll` expects (`buildSnapshot()` returns `{ meta: { schemaVersion, activePlanId, themeKey, fontKey, hiddenPlanIds, updatedAt }, plans, userdata: { progress, notes, refs, srs, log, learned, bookmarks } }` — see `buildSnapshot`'s definition earlier in this same file, around line 272), so no reshaping is needed.

- [ ] **Step 3: Lint**

Run:
```bash
npm run lint
```
Expected: no new errors (this file is `// @ts-nocheck`, so `npm run typecheck` doesn't cover it — lint is the only static check available for this change).

- [ ] **Step 4: Manual verification via dev server**

This repo has no test harness for `DualTrackConsole.tsx` (a large stateful component, consistent with the rest of the UI layer having no test coverage). Verify by hand:

1. Run `npm run dev` and sign in with a test account that has cloud sync configured (`DATABASE_URL` set).
2. Open the browser devtools console. Temporarily force a conflict by monkey-patching `fetch` for `/api/state` PUT requests to return a 409 with a `snapshot` body — or, if you have two browser profiles/tabs signed into the same account, make an edit in tab A, then a *different* edit in tab B (tab B's next autosave, ~700ms after the edit, should hit the conflict since tab A's save changed `updatedAt` first).
3. Confirm: a file named `refrainly-recovery-<timestamp>.json` downloads, its contents are valid JSON matching the `FullBackupFile` shape (open it and check for `progress`/`notes`/`plans`/etc. reflecting the pre-conflict local edits), the toast reads "Your recent changes were saved to a recovery file.", and local state afterward matches the *other* tab's data (i.e. the server's snapshot was still adopted).
4. To exercise the fallback path, temporarily make `downloadText` return `false` (e.g. comment out its body to `return false;` locally, not committed) and repeat step 2-3: confirm `localStorage.getItem("refrainly:conflict-recovery")` contains the JSON and the toast reads "Your recent changes were saved locally for recovery." Revert the temporary change before committing.
5. Confirm the recovery file, when re-imported via the app's existing "Data & export" → Import → Merge flow, restores the data that would otherwise have been lost.

Stop the dev server when done. Write what you observed for each of the 5 checks into your report.

- [ ] **Step 5: Commit**

```bash
git add components/dualtrack/DualTrackConsole.tsx
git commit -m "$(cat <<'EOF'
Stash a recovery file before adopting server snapshot on conflict

flushCloudSnapshot's 409-conflict branch unconditionally overwrote
all local state with the server's snapshot, with no way to recover
whatever local edits triggered the save. This reuses the app's
existing backup-export machinery (exportAll/serializeExport/
downloadText) to save a real, re-importable recovery file before
adopting the server's copy, falling back to localStorage if the
download is blocked. Minimum-viable fix — not a merge; see the
design spec for the deferred field-level-merge follow-up.
EOF
)"
```
