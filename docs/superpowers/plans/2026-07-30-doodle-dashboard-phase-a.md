# Doodle Dashboard Phase A (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register a new dark "Doodle" theme as the dashboard's default (per-user-overridable), add a scoped hand-drawn heading-font treatment to the two always-visible top-level dashboard titles, and build a shared doodle SVG/CSS toolkit for the reshaping work in Phases B–E.

**Architecture:** The dashboard already has a working per-user theme system (`ThemeDef` → `themeVars()` → CSS custom properties, 1,112 existing consumers). This phase adds one new `ThemeDef` entry and flips the default — no reshaping of existing selectors (that's Phases B–E). A parallel (not shared-via-import) SVG component file and two new CSS utility classes are added for later phases to consume.

**Tech Stack:** Next.js 16, React 19, TypeScript, plain CSS custom properties (existing theme mechanism) — no new dependencies.

## Global Constraints

- New `ThemeDef` values (from the spec, copy verbatim): `swatch: ["#14100D", "#E3C4AE", "#D97757"]`, `accents: { main: "#E3C4AE", sprint: "#D97757" }`, `radius: { card: "16px", ctl: "10px", pill: "999px", bar: "999px" }`, `grid: { color: "rgba(245,237,228,0.06)", size: "24px", scan: "0.08" }`, `mode: "dark"`, `palette: "dark"`, `effects: true`, `name: "Doodle"`.
- `c` block (copy verbatim): `bg: "#14100D"`, `panel: "#1B1613"`, `panel2: "#2B2118"`, `blur: "rgba(20,16,13,0.9)"`, `text: "#F5EDE4"`, `dim: "#A89A8C"`, `faint: "#7D7166"`, `border: "rgba(245,237,228,0.85)"`, `borderSoft: "rgba(245,237,228,0.18)"`, `borderHover: "rgba(245,237,228,0.4)"`, `track: "rgba(245,237,228,0.12)"`, `onAccent: "#2B2118"`, `onAccentSoft: "rgba(43,33,24,0.85)"`, `ok: "#7FB88A"`, `warn: "#D9A44F"`, `err: "#C97B6B"`, `info: "#7B9BB0"`.
- `display: FONT_STACKS.grotesk` (unchanged mechanism — every other theme uses this same field for a fallback stack; Phase A does not touch `FONT_PACKS`/`DEFAULT_FONT_KEY`).
- Do not add a new `FONT_PACKS` entry. Do not set Delius Swash Caps as a uniform sans/display/mono voice.
- Do not modify any other existing `THEMES` entry.
- Do not modify `features/landing/*` (homepage — already shipped).
- Do not reshape (border-radius/box-shadow) any existing dashboard selector — that is out of scope for Phase A.
- `themeKey` is per-user-persisted (`snap.meta?.themeKey`); changing `DEFAULT_THEME_KEY` must only affect users with no saved key.
- Every task must leave `tsc --noEmit` and `next build` passing, must not introduce new eslint errors in files it touches, and must leave `npm test` (162 tests) passing. Do not run whole-repo `npx eslint .` (repo baseline has 22 pre-existing unrelated errors/warnings — see prior plan's ledger for the same finding, still true).

---

## Task 1: Register the "doodle" theme

**Files:**
- Modify: `lib/types.ts` (the `ThemeKey` union type, ~line 87)
- Modify: `theme/themes.ts` (`THEMES` record, `THEME_ORDER` array, `DEFAULT_THEME_KEY`)

**Interfaces:**
- Produces: `THEMES.doodle` (a `ThemeDef`), `"doodle"` as a valid `ThemeKey`, `DEFAULT_THEME_KEY === "doodle"`.
- Consumes: existing `ThemeDef` type shape (`theme/themes.ts:6-23`), existing `FONT_STACKS.grotesk` constant.

- [ ] **Step 1: Add `"doodle"` to the `ThemeKey` union**

Read `lib/types.ts` around line 87 to see the current union's exact formatting, then add `"doodle"` as one more member (alphabetical position doesn't matter — match the existing list's style, comma-separated union of string literals).

- [ ] **Step 2: Add the `doodle` entry to `THEMES`**

In `theme/themes.ts`, inside the `THEMES: Record<ThemeKey, ThemeDef> = { ... }` object (starts ~line 116), add a new entry (position: anywhere in the object, but list it first for visibility during review):

```ts
doodle: {
  name: "Doodle",
  mode: "dark",
  palette: "dark",
  effects: true,
  swatch: ["#14100D", "#E3C4AE", "#D97757"],
  accents: { main: "#E3C4AE", sprint: "#D97757" },
  display: FONT_STACKS.grotesk,
  radius: { card: "16px", ctl: "10px", pill: "999px", bar: "999px" },
  grid: { color: "rgba(245,237,228,0.06)", size: "24px", scan: "0.08" },
  c: {
    bg: "#14100D",
    panel: "#1B1613",
    panel2: "#2B2118",
    blur: "rgba(20,16,13,0.9)",
    text: "#F5EDE4",
    dim: "#A89A8C",
    faint: "#7D7166",
    border: "rgba(245,237,228,0.85)",
    borderSoft: "rgba(245,237,228,0.18)",
    borderHover: "rgba(245,237,228,0.4)",
    track: "rgba(245,237,228,0.12)",
    onAccent: "#2B2118",
    onAccentSoft: "rgba(43,33,24,0.85)",
    ok: "#7FB88A",
    warn: "#D9A44F",
    err: "#C97B6B",
    info: "#7B9BB0",
  },
},
```

- [ ] **Step 3: Add `"doodle"` to `THEME_ORDER`**

In `theme/themes.ts`, add `"doodle"` to the `THEME_ORDER: ThemeKey[]` array (~line 269) — put it first, so it's the leftmost/first option in the theme picker.

- [ ] **Step 4: Flip the default**

In `theme/themes.ts`, change `export const DEFAULT_THEME_KEY: ThemeKey = "signal";` to `export const DEFAULT_THEME_KEY: ThemeKey = "doodle";` (~line 75). Update the adjacent comment (`/** Default dashboard theme (user-selectable). Homepage uses LANDING_THEME instead. */`) only if it becomes inaccurate — it does not need to change, since it's still accurate (the default is still user-overridable).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx eslint theme/themes.ts lib/types.ts`
Expected: no errors.

Run: `npm test`
Expected: 162/162 passing (confirms the `ThemeKey` union widening and `resolveThemeKey`/export-import logic in `lib/exportImport.ts` and `theme/themes.test.ts` don't break — `resolveThemeKey` already falls back safely for unrecognized keys, and `"doodle"` is now recognized, not unrecognized, so no snapshot compatibility issue is expected).

Run: `npm run dev`, sign in (or use whatever local flow reaches the dashboard), open the theme picker (find the UI that renders `THEME_ORDER`/`THEMES` — `features/ui/Views.tsx` around line 152-170), confirm "Doodle" appears as the first option with a 3-swatch preview showing `#14100D`/`#E3C4AE`/`#D97757`, and confirm a fresh account (or clearing the saved theme, if there's an accessible way to do so without a real new account) shows the Doodle theme by default.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts theme/themes.ts
git commit -m "Register dark Doodle theme as the new dashboard default"
```

---

## Task 2: Shared doodle SVG toolkit

**Files:**
- Create: `components/doodle/doodle-assets.tsx`

**Interfaces:**
- Produces: `DoodleUnderline({ className? })`, `DoodleArrow({ className?, direction? })`, `DoodleStar({ className? })`, `DoodleBullet({ className? })`, `DoodleCircledNumber({ n, className? })` — same component shapes as `features/landing/doodle-assets.tsx`, but this is a new, independent file (not a re-export) so Phases B–E can consume it without coupling to landing-specific code.
- Consumes: `classNames` from `@/lib/classNames`, `motion`/`useReducedMotion` from `motion/react` (already project dependencies, already used identically in `features/landing/doodle-assets.tsx`).

- [ ] **Step 1: Write the file**

Content is the same component set as `features/landing/doodle-assets.tsx` (created earlier in this project — read that file for the exact current implementation), copied into a new file at `components/doodle/doodle-assets.tsx`. Do not modify `features/landing/doodle-assets.tsx` — leave it exactly as-is; this is an intentional parallel copy, not a shared import, to avoid touching already-shipped homepage code.

```tsx
"use client";

import { motion, useReducedMotion } from "motion/react";
import { classNames } from "@/lib/classNames";

type DoodleProps = { className?: string };

/** Hand-drawn squiggle underline. Draws itself in once scrolled into view. */
export function DoodleUnderline({ className }: DoodleProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.svg
      className={classNames("doodle-underline", className)}
      width="140"
      height="14"
      viewBox="0 0 140 14"
      fill="none"
      aria-hidden="true"
      initial={reduceMotion ? undefined : { pathLength: 0, opacity: 0 }}
      whileInView={reduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <path
        d="M2 9.5C22 3 44 2 64 6.5C84 11 104 4 138 7"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

/** Small hand-drawn arrow. Points right by default, or down. */
export function DoodleArrow({
  className,
  direction = "right",
}: DoodleProps & { direction?: "right" | "down" }) {
  const rotate = direction === "down" ? 90 : 0;
  return (
    <svg
      className={classNames("doodle-arrow", className)}
      width="34"
      height="20"
      viewBox="0 0 34 20"
      fill="none"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M2 11C10 8 19 8 27 10.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M20 4.5C23 7 26 9 28.5 11C26 12.5 23.5 15 21.5 17.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Four-point hand-drawn star, used as a decorative accent. */
export function DoodleStar({ className }: DoodleProps) {
  return (
    <svg className={classNames("doodle-star", className)} width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 1.5C11.5 6 12.5 9 20.5 11C12.5 13 11.5 16 11 20.5C10.5 16 9.5 13 1.5 11C9.5 9 10.5 6 11 1.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Small hand-drawn bullet mark, replaces a plain list dot. */
export function DoodleBullet({ className }: DoodleProps) {
  return (
    <svg className={classNames("doodle-bullet", className)} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 7C3 4.5 5 2.5 7.2 3C9.5 3.5 11 5.5 10.5 7.8C10 10 7.8 11.3 5.5 10.8C3.3 10.3 2 8.5 3 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** Hand-drawn circled number, used for step/rank counters. */
export function DoodleCircledNumber({ n, className }: DoodleProps & { n: string | number }) {
  return (
    <span className={classNames("doodle-circled-number", className)} aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 2.5C29.5 2 37.5 8.5 37.5 19.5C37.5 30 29.5 37 20 37.2C10.5 37.4 2.5 30.5 2.5 20C2.5 9.5 10 3 20 2.5Z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <span className="doodle-circled-number-val">{n}</span>
    </span>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint components/doodle/doodle-assets.tsx`
Expected: no errors. (Same as the landing version's own task, this file has no consumer yet — no visual smoke test in this phase, per the spec's QA checklist.)

- [ ] **Step 3: Commit**

```bash
git add components/doodle/doodle-assets.tsx
git commit -m "Add shared doodle SVG asset library for dashboard phases"
```

---

## Task 3: Shared CSS utilities + scoped heading-font treatment

**Files:**
- Modify: `app/dualtrack.css` (new rules only — append near existing shared button/card primitives, e.g. after the `.primary-btn`/`.secondary-btn` block; do not touch any existing rule)

**Interfaces:**
- Produces: `.doodle-card` (rounded corners via `var(--r-card)`, soft shadow, hover-lift, `prefers-reduced-motion` guard), `.doodle-pill` (fully rounded via `var(--r-pill)`) — for Phases B–E to apply as additional classNames on existing selectors. `.hero-title` and `.field-kit-title` gain `font-family: var(--font-delius), cursive;`.
- Consumes: `--r-card`, `--r-pill` (from the active `ThemeDef` via `themeVars()`), `--text` (for shadow color mix), `--font-delius` (already loaded globally in `app/layout.tsx` from the homepage redesign).

- [ ] **Step 1: Add the shared doodle CSS utilities**

Append to `app/dualtrack.css`, near the existing `.primary-btn`/`.secondary-btn` rules (not inside the `.landing-*` block — this is a dashboard-wide utility, independent from `.landing-doodle-card`):

```css
/* Shared doodle utilities — dashboard phases B-E apply these as additional classNames. */
.doodle-card {
  border-radius: var(--r-card);
  box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--text) 30%, transparent);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.doodle-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 28px -12px color-mix(in srgb, var(--text) 38%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .doodle-card,
  .doodle-card:hover {
    transition: none;
    transform: none;
  }
}
.doodle-pill {
  border-radius: var(--r-pill);
}
```

- [ ] **Step 2: Add the scoped heading-font treatment**

Append immediately after (same location):

```css
.hero-title,
.field-kit-title {
  font-family: var(--font-delius), cursive;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (CSS-only change, this confirms nothing else broke).

Run: `npm run dev`, sign in and reach the dashboard with the Doodle theme active (from Task 1's verification), confirm:
- The campaign name heading (`.hero-title`) and the Field Kit page title (`.field-kit-title`) render in the Delius Swash Caps handwritten font.
- No other text on the page changed font.
- No visual regression elsewhere (the `.doodle-card`/`.doodle-pill` classes have no consumers yet in this phase, so they should have zero visible effect — confirm nothing on the page unexpectedly changed shape).

- [ ] **Step 4: Commit**

```bash
git add app/dualtrack.css
git commit -m "Add shared doodle CSS utilities and scoped dashboard heading font"
```

---

## Task 4: Final verification and QA pass

**Files:** none (verification only)

**Interfaces:** N/A

- [ ] **Step 1: Full verification suite**

Run, in order:
```bash
npx tsc --noEmit
npx eslint lib/types.ts theme/themes.ts app/dualtrack.css components/doodle
npm test
npm run build
```
Expected: all four clean. (Do not run whole-repo `npx eslint .` — see Global Constraints.)

- [ ] **Step 2: Manual QA against the spec's checklist**

Using the dev server, walk through `docs/superpowers/specs/2026-07-30-doodle-dashboard-phase-a-design.md`'s QA checklist:
- "doodle" theme selectable, correct swatch/name — confirm in the theme picker.
- No-saved-theme user sees Doodle by default; a user with an existing saved theme (switch to e.g. "Signal" and reload, or inspect a snapshot with a pre-existing `themeKey`) is unaffected.
- Dashboard background/panel/text/accent colors visibly match the new dark doodle palette when Doodle is active — colors only, shapes are expected to stay hard-edged until Phase B+.
- Contrast: use devtools computed-style + a WCAG contrast check (same method used in the homepage plan) for `text` (#F5EDE4) on `bg` (#14100D), `onAccent` (#2B2118) on `accents.main` (#E3C4AE), and `ok`/`warn`/`err` against whatever they're actually rendered on (status dots/badges in the dashboard) — report the ratios; if anything fails AA for its text size, that's a finding for the fix loop, not something to silently accept.
- Heading-font selectors render Delius Swash Caps; body/table/input text unaffected.
- `components/doodle/doodle-assets.tsx` and the new CSS utilities exist and compile/lint clean (no visual consumer yet, by design).

- [ ] **Step 3: Report**

No commit for this task (verification only) — if all checks pass, Phase A is complete. If anything fails, note it precisely (which check, what was observed) for the fix loop.
