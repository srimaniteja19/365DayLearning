# Delete-All-My-Data Confirm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TopBar Ops menu's "Reset device data" two-button confirm with a "Delete all my data" action that explicitly warns about cross-device, irreversible deletion and requires typing `DELETE` before it can fire.

**Architecture:** Pure frontend change inside the existing `TopBar` component (`features/ui/Views.tsx`) and its stylesheet (`app/dualtrack.css`). No new components, no new modal system, no backend or state-management changes — `handleReset` in `components/dualtrack/DualTrackConsole.tsx` already does the right thing and is untouched.

**Tech Stack:** React (function components + hooks), plain CSS (no component library — this codebase hand-rolls all UI, see `docs/superpowers/specs/2026-07-31-delete-all-my-data-confirm-design.md`).

## Global Constraints

- Button label must read exactly "Delete all my data".
- Confirm warning text must explicitly state the action is account-wide (synced across every device) and irreversible.
- The confirm action button must stay disabled until the typed input's trimmed, case-insensitive value equals `DELETE`.
- No new modal/dialog — stay within the existing inline dropdown-confirm pattern (`.topbar-ops-confirm`).
- No changes to `handleReset`, `pushCloudSnapshot`, or `app/api/state/route.ts`.
- No relocation of the control out of the TopBar Ops "Danger" section.
- This codebase has no component-level test harness (vitest is configured `environment: "node"`, only `*.test.ts` files, no jsdom/React Testing Library anywhere in the repo) — verification for this task is manual, via the dev server, not new automated tests. Do not add test infrastructure as part of this task.

---

### Task 1: Rename button, add typed confirmation, fix stuck-confirm-on-close bug

**Files:**
- Modify: `features/ui/Views.tsx:253-306` (TopBar component setup: state, effects, `go` helper)
- Modify: `features/ui/Views.tsx:514-537` (Danger section markup)
- Modify: `app/dualtrack.css:268-297` (`.topbar-ops-confirm` and related rules)

**Interfaces:**
- Consumes: existing `confirmReset` / `setConfirmReset` / `onReset` props already passed into `TopBar` from `components/dualtrack/DualTrackConsole.tsx:1314-1316` — unchanged, no prop signature changes.
- Produces: no new exports; all new state (`deleteConfirmText`) and the `closeOps` helper are local to `TopBar`.

- [ ] **Step 1: Update `TopBar`'s local state and close handling**

In `features/ui/Views.tsx`, replace lines 281-305 (from `const pct = ...` through the end of the `go` function) with:

```jsx
  const pct = stats.need ? Math.min(100, Math.round((stats.into / stats.need) * 100)) : 0;
  const [opsOpen, setOpsOpen] = useState(false);
  const opsRef = useRef(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const closeOps = useCallback(() => {
    setOpsOpen(false);
    setConfirmReset(false);
    setDeleteConfirmText("");
  }, [setConfirmReset]);

  useEffect(() => {
    if (!opsOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeOps();
    };
    const onPointer = (e) => {
      if (opsRef.current && !opsRef.current.contains(e.target)) closeOps();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [opsOpen, closeOps]);

  const go = (fn) => () => {
    setOpsOpen(false);
    setConfirmReset(false);
    setDeleteConfirmText("");
    fn?.();
  };
```

This makes Escape and outside-click fully reset the confirm panel (today they only close the dropdown via `setOpsOpen(false)`, leaving `confirmReset` `true` so reopening the menu jumps straight back into the confirm state — this fixes that in the same code path being touched).

- [ ] **Step 2: Replace the Danger section markup**

In the same file, replace lines 514-537 (the `<div className="topbar-ops-section topbar-ops-danger">...</div>` block) with:

```jsx
                <div className="topbar-ops-section topbar-ops-danger">
                  <div className="topbar-ops-label">Danger</div>
                  {confirmReset ? (
                    <div className="topbar-ops-confirm">
                      <p className="topbar-ops-confirm-warning">
                        This permanently deletes your progress, notes, references, and study
                        history — synced across every device on this account. This can&apos;t be
                        undone.
                      </p>
                      <span id="topbar-ops-delete-hint" className="topbar-ops-confirm-hint">
                        Type DELETE to confirm
                      </span>
                      <input
                        type="text"
                        className="topbar-ops-confirm-input"
                        aria-labelledby="topbar-ops-delete-hint"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        autoFocus
                        autoComplete="off"
                      />
                      <div className="topbar-ops-confirm-actions">
                        <button
                          type="button"
                          className="topbar-ops-confirm-yes"
                          disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                          onClick={go(onReset)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="topbar-ops-confirm-no"
                          onClick={() => {
                            setConfirmReset(false);
                            setDeleteConfirmText("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className="topbar-ops-item topbar-ops-item-danger"
                      onClick={() => setConfirmReset(true)}
                    >
                      <Icon.Rotate size={14} />
                      <span>Delete all my data</span>
                    </button>
                  )}
                </div>
```

Note: `Cancel` deliberately does **not** use the `go()` helper — `go()` also closes the whole Ops dropdown, but `Cancel` should only collapse the confirm panel back to the trigger button (matching today's "Keep" behavior). `Delete` uses `go(onReset)` so the dropdown closes after the action fires, matching today's "Erase" behavior.

- [ ] **Step 3: Update the CSS**

In `app/dualtrack.css`, replace lines 268-297 (from `.topbar-ops-confirm {` through the closing `}` of `.topbar-ops-confirm-no`) with:

```css
.topbar-ops-confirm {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 8px 10px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 750;
}
.topbar-ops-confirm-warning {
  margin: 0;
  color: var(--text-dim);
  font-weight: 600;
  line-height: 1.4;
  text-transform: none;
  letter-spacing: normal;
}
.topbar-ops-confirm-hint {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.topbar-ops-confirm-input {
  appearance: none;
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  border: 2px solid var(--text);
  background: var(--bg);
  color: var(--text);
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.topbar-ops-confirm-actions {
  display: flex;
  gap: 8px;
}
.topbar-ops-confirm-yes,
.topbar-ops-confirm-no {
  appearance: none;
  flex: 1;
  min-height: 36px;
  padding: 0 12px;
  border: 2px solid var(--text);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
}
.topbar-ops-confirm-yes {
  background: var(--err);
  color: var(--on-accent);
}
.topbar-ops-confirm-yes:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.topbar-ops-confirm-no {
  background: var(--bg);
  color: var(--text);
}
```

- [ ] **Step 4: Typecheck and lint**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: both pass with no new errors.

- [ ] **Step 5: Manual verification via dev server**

Run:
```bash
npm run dev
```
In a browser, open the app, open the TopBar Ops menu, and verify:
- The Danger section shows "Delete all my data" (not "Reset device data").
- Clicking it expands the panel showing the warning paragraph (mentions "every device" and "can't be undone"), the "Type DELETE to confirm" hint, a text input (auto-focused), and Delete/Cancel buttons.
- Delete is disabled while the input is empty or doesn't equal `DELETE` (try `delete`, `Delete`, `delet` — lowercase/mixed-case should enable it via the case-insensitive check except `delet` which should stay disabled).
- Cancel collapses the panel back to the "Delete all my data" button and clears the typed text (reopen the confirm panel to confirm the input is empty again).
- Pressing Escape while the confirm panel is open closes the whole dropdown; reopening the Ops menu shows the "Delete all my data" trigger button, not a stuck confirm panel.
- Clicking outside the dropdown while the confirm panel is open does the same as Escape.
- Typing `DELETE` and clicking Delete closes the dropdown and actually clears local progress/notes/etc. (existing `handleReset` behavior — confirm the app's data is empty afterward, e.g. via the Console/Grid view).

Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add features/ui/Views.tsx app/dualtrack.css
git commit -m "$(cat <<'EOF'
Require typed confirmation before deleting all account data

Renames "Reset device data" to "Delete all my data" and replaces the
two-button Erase/Keep confirm with an explicit warning plus a typed
DELETE confirmation, since the action wipes the account across every
signed-in device and is irreversible.
EOF
)"
```
