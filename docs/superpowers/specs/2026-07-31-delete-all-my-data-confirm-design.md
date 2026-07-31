# Fix "Reset device data" — rename + typed confirmation

## Problem

The TopBar Ops menu's "Reset device data" action (`features/ui/Views.tsx:514-537`) wipes local
state and, when the user is signed in, pushes an empty snapshot to the cloud account
(`handleReset` in `components/dualtrack/DualTrackConsole.tsx:881-912`). This is a genuine
account-wide, cross-device, irreversible data loss — not a local/device-only reset as the name
implies.

Today the confirm step is a two-button inline swap ("Erase all local data?" → Erase/Keep) inside
a small dropdown panel. A user troubleshooting a sync hiccup can plausibly click this expecting a
harmless local reset and lose everything permanently, on every device. This is documented as a
known limitation in `docs/APPLICATION_DOCUMENTATION.md` §21.

## Goals

- Make the destructive, account-wide, irreversible nature of the action unmistakable before it fires.
- Require a typed confirmation, not just a second click, so it can't be triggered by a reflexive tap.
- Fix it in place — no relocation, no new modal subsystem, no backend changes.

## Design

### Copy

| Element | Before | After |
|---|---|---|
| Menu item label | "Reset device data" | "Delete all my data" |
| Confirm warning | "Erase all local data?" | "This permanently deletes your progress, notes, references, and study history — synced across every device on this account. This can't be undone." |
| Confirm buttons | Erase / Keep | Delete / Cancel |

### Interaction

- Clicking "Delete all my data" expands the existing inline confirm panel in place (same pattern
  as today — no new modal, consistent with the app's other inline confirms, e.g. plan delete in
  `PlanSwitcher`).
- The expanded panel shows, top to bottom: the warning text, a text input
  (placeholder `Type DELETE to confirm`, autofocused on expand), then the Delete/Cancel buttons.
- `Delete` is disabled until the input's trimmed, case-insensitive value equals `DELETE`.
- `Cancel`, Escape, or an outside click all collapse the panel back to the trigger button and
  clear the typed input.
- **Bug fix bundled in**: today, Escape/outside-click only close the dropdown (`setOpsOpen(false)`)
  without resetting `confirmReset`, so reopening the menu lands back in the confirm state. Since
  this is the exact code path being touched, the same effect (`features/ui/Views.tsx:285-299`)
  will also reset `confirmReset` (and the new typed-input state) on close.
- `handleReset` (the actual wipe + cloud push) is unchanged — this is purely a friction/copy fix
  on the trigger path.

### Implementation touch points

- `features/ui/Views.tsx:514-537` — button label, confirm panel markup, new local state for the
  typed input value.
- `features/ui/Views.tsx:285-299` — clear confirm/typed state on Escape/outside-click close.
- `app/dualtrack.css:268-297` — extend `.topbar-ops-confirm` styles for the new input row and
  disabled button state.

### Accessibility

- Input gets an associated `<label>` (visually hidden is fine, matching the compact panel style)
  and is focused when the panel expands.
- The warning text is plain content inside the panel (no `aria-live` needed — it appears as part
  of a user-initiated expansion, not an async update).

## Non-goals

- No new modal/dialog component — stays within the existing inline dropdown-confirm pattern.
- No changes to `handleReset`, `pushCloudSnapshot`, or the `/api/state` route.
- No relocation of the control out of the TopBar Ops "Danger" section.
- No icon change — `Icon.Rotate` stays as the (decorative, `aria-hidden`) icon for this item.

## Testing

- Manual: open Ops menu → click "Delete all my data" → verify warning copy, disabled Delete
  button, Delete enables only on exact "DELETE" (case-insensitive) → Cancel clears and collapses
  → Escape and outside-click also clear and collapse → re-opening menu shows the trigger button,
  not a stuck confirm panel.
- Manual: confirm the full flow (typing DELETE, clicking Delete) still calls `handleReset` and
  wipes/pushes the empty snapshot as before.
