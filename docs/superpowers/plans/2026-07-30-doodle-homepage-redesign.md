# Doodle Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the Refrainly homepage (`features/landing/HomeView.tsx` + its CSS in `app/dualtrack.css`) from the current "Field Ops / military briefing" brutalist identity to the doodle hand-drawn design system defined in `.agents/skills/design-system/SKILL.md`, replacing pointer-tracked 3D tilt with flat hover-only motion and rewriting tactical copy to a warm, plain-language voice.

**Architecture:** No IA/behavior changes — same section order, same props/callbacks. Existing `--landing-*` CSS custom property *names* are kept and repointed to new doodle-safe hex values (avoids touching hundreds of `var()` call sites); only declarations that hard-code colors, `border-radius: 0`, or brutalist offset box-shadows are edited individually. Two small new files hold reusable hand-drawn SVG accents. `TiltCard`/`use3d.ts` (pointer-tracked 3D) are deleted outright — once hover motion moves to pure CSS `:hover` + `prefers-reduced-motion`, no wrapper component or JS is needed at all.

**Tech Stack:** Next.js 16 (`next/font/google`), React 19, `motion/react` (already a dependency, used only for the scroll-triggered underline draw-in and the existing hero slip-note idle float), plain CSS (no new dependency for hand-drawn effects).

## Global Constraints

- Doodle tokens (from the skill): primary `#49B6E5`, secondary `#263D5B`, success `#16A34A`, warning `#D97706`, danger `#DC2626`, surface `#FFFFFF`, text `#111827`. Where a token fails WCAG AA on its natural pairing, this plan substitutes a darker/deeper shade in the same hue family and says so explicitly — never use the failing literal token value for text/button contrast.
- Display/heading font: Delius Swash Caps (Google Fonts, weight 400 only — confirmed present in `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`, next/font export name `Delius_Swash_Caps`).
- Body/paragraph font stays Archivo (`--font-archivo`) — do not set Delius Swash Caps on paragraph or list-item text.
- No new runtime dependency for hand-drawn rendering (no roughjs/rough-notation). Doodle effects are static SVG + CSS only.
- No changes to: pricing/tier data, billing copy facts, section order, component props/callbacks, routing.
- Out of scope, explicitly not touched by this plan: `.legal-*` rules (privacy/terms pages, unrelated despite being physically adjacent in the CSS file), `.landing-features*`/`.landing-billing*` (dead CSS — grepped, zero references in `HomeView.tsx`), `.hydrate-*`/`.ops-bone-*` (shared loading-skeleton primitives used by other pages, not landing-specific), `app/layout.tsx` metadata `title`/`description` (still says "Field Ops Learning Campaigns" — a deliberate scope cut, flag to the user as a possible follow-up).
- Every task must leave `tsc --noEmit` and `next build` passing, and must not introduce new `eslint` errors in the files it touches. Baseline note: `npx eslint .` (whole repo) already has 22 pre-existing errors/warnings outside this plan's scope (e.g. `features/ui/Views.tsx`, `lib/planEdit.ts`, `lib/providers/index.ts`) — these are not caused by this work and are not this plan's responsibility to fix. Scope all lint verification in this plan to the specific files each task touches, never whole-repo `eslint .`.

---

## Task 1: Doodle SVG asset library

**Files:**
- Create: `features/landing/doodle-assets.tsx`

**Interfaces:**
- Produces: `DoodleUnderline({ className?: string })`, `DoodleArrow({ className?: string, direction?: "right" | "down" })`, `DoodleStar({ className?: string })`, `DoodleBullet({ className?: string })`, `DoodleCircledNumber({ n: string | number, className?: string })` — all default-exported as named exports from `features/landing/doodle-assets.tsx`. All are presentational, `aria-hidden="true"`, decorative only.
- Consumes: `classNames` from `@/lib/classNames` (already used elsewhere in `features/landing/HomeView.tsx`), `motion`/`useReducedMotion` from `motion/react` (already a project dependency).

- [ ] **Step 1: Write the file**

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

/** Hand-drawn circled number, used for the how-it-works step counters. */
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

Run: `npx tsc --noEmit && npx eslint features/landing/doodle-assets.tsx`
Expected: no errors. (No component test harness exists in this repo — `vitest.config.ts` only includes `**/*.test.ts` under a `node` environment, no DOM/JSX runner — so verification here is static analysis; the components are exercised visually once wired into `HomeView.tsx` in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add features/landing/doodle-assets.tsx
git commit -m "Add doodle hand-drawn SVG accent components"
```

---

## Task 2: Foundation — doodle font + design tokens + paper background

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/dualtrack.css` (lines 4014–4092: `.landing`, `.landing-root`, `.landing-root::before`, `.landing-root::after`)

**Interfaces:**
- Produces: CSS variable `--font-delius` (set on `<html>` via the Next font `variable` option, same mechanism as the ten existing fonts in `app/layout.tsx`); CSS custom properties `--landing-ink`, `--landing-blue`, `--landing-blue-deep`, `--landing-pink`, `--landing-paper`, `--landing-panel`, `--landing-muted`, `--landing-on`, `--landing-mint`, `--landing-flare`, `--landing-steel`, `--landing-radius`, `--landing-radius-sm` on `.landing`, all consumed by Task 3's edits and Task 4's JSX; utility classes `.landing-doodle-card` and `.doodle-*` (asset styling) consumed by Task 3/4.

- [ ] **Step 1: Add the Delius Swash Caps font in `app/layout.tsx`**

Add to the import list (after `Red_Hat_Mono`):

```ts
import {
  Space_Grotesk,
  Literata,
  JetBrains_Mono,
  Archivo,
  Newsreader,
  Space_Mono,
  Sora,
  Kalnia,
  Host_Grotesk,
  Red_Hat_Mono,
  Delius_Swash_Caps,
} from "next/font/google";
```

Add after the `redmono` font declaration:

```ts
const delius = Delius_Swash_Caps({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-delius",
  display: "swap",
});
```

Add `delius.variable` to the `fontVars` array:

```ts
const fontVars = [
  space.variable,
  literata.variable,
  jetbrains.variable,
  archivo.variable,
  newsreader.variable,
  spacemono.variable,
  sora.variable,
  kalnia.variable,
  host.variable,
  redmono.variable,
  delius.variable,
].join(" ");
```

- [ ] **Step 2: Rewrite the token/background block in `app/dualtrack.css`**

Replace the current lines 4014–4092 (`.landing { ... }` through `.landing-root::after { ... }`) with:

```css
.landing {
  --landing-ink: #263d5b;        /* doodle secondary — headings, body text, primary CTA bg (11:1 white text) */
  --landing-blue: #49b6e5;       /* doodle primary — fills/badges (pair with --landing-ink text, not white: 2.3:1 fails AA) */
  --landing-blue-deep: #1b7fa8;  /* AA-safe blue (4.5:1 on white) — links, borders, focus rings, small blue text */
  --landing-pink: #e8578b;       /* doodle highlighter accent — underlines/squiggles/stars (decorative, aria-hidden only) */
  --landing-paper: #fdf6ec;      /* warm paper page background */
  --landing-panel: #ffffff;      /* card surface */
  --landing-muted: #4b5a72;      /* secondary/body text on white (7:1) */
  --landing-on: #ffffff;         /* text-on-dark */
  --landing-mint: #15803d;       /* success — Live badges, white text (5:1) */
  --landing-flare: #b45309;      /* warning — Coming soon / NOW badges, white text (5:1) */
  --landing-steel: #c9d4e0;      /* neutral borders/dividers (decorative, non-text) */
  --landing-radius: 20px;
  --landing-radius-sm: 12px;
  --landing-gap: 52px;
  position: relative;
  z-index: 2;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 28px 80px;
  font-family: var(--font-archivo), sans-serif;
  color: var(--landing-ink);
}

/* Doodle display font — headings, labels, and buttons only; body/paragraph text stays Archivo for AA readability. */
.landing-brand-text,
.landing-hero-kicker,
.landing-brand-hero,
.landing-hero-title,
.landing-section-title,
.landing-loop-title,
.landing-surface-title,
.landing-price-rank,
.landing-picker-title,
.landing-band-title,
.landing-stamp,
.landing-surface-stamp,
.landing-cta,
.landing-cta-ghost,
.landing-surface-cta,
.landing-price-cta,
.landing-picker-custom,
.landing-cta-band,
.landing-plan-btn,
.landing-nav-link,
.landing-nav-cta,
.landing-footer-link,
.landing-plan-name,
.landing-viz-op,
.landing-price-badge,
.landing-audience-label {
  font-family: var(--font-delius), cursive;
}

.landing-root {
  --bg: var(--landing-paper) !important;
  --bg-panel: var(--landing-panel) !important;
  --text: var(--landing-ink) !important;
  --text-dim: var(--landing-muted) !important;
  --accent-main: var(--landing-blue-deep) !important;
  --accent-sprint: var(--landing-pink) !important;
  --accent: var(--landing-blue-deep) !important;
  --on-accent: #ffffff !important;
  --r-card: 18px !important;
  --r-ctl: 999px !important;
  --r-pill: 999px !important;
  background:
    radial-gradient(900px 520px at 92% -8%, color-mix(in srgb, var(--landing-blue) 16%, transparent), transparent 58%),
    radial-gradient(700px 420px at -6% 18%, color-mix(in srgb, var(--landing-pink) 12%, transparent), transparent 55%),
    var(--landing-paper) !important;
  position: relative;
  isolation: isolate;
}
.landing-root::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.55;
  background-image: repeating-linear-gradient(
    180deg,
    transparent,
    transparent 27px,
    rgba(38, 61, 91, 0.07) 27px,
    rgba(38, 61, 91, 0.07) 28px
  );
  mask-image: radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 78%);
}
```

Note: `.landing-root::after` (the `content: "BRIEFING"` watermark) is deleted entirely — do not carry any replacement rule forward for it.

- [ ] **Step 3: Add the shared doodle-card hover utility and asset styling**

Append to the end of the same edited region (directly after the block from Step 2):

```css
/* Shared hover-lift for "sticky note" cards. Pure CSS — no JS, no pointer tracking. */
.landing-doodle-card {
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.landing-doodle-card:hover {
  transform: rotate(0deg) translateY(-4px);
  box-shadow: 0 16px 26px -10px color-mix(in srgb, var(--landing-ink) 32%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .landing-doodle-card,
  .landing-doodle-card:hover {
    transition: none;
    transform: none;
  }
}

.doodle-underline {
  display: block;
  width: 100px;
  height: 10px;
  color: var(--landing-pink);
  overflow: visible;
}
.landing-section-underline {
  margin: -6px 0 14px;
}
.doodle-arrow {
  display: inline-block;
  color: var(--landing-blue-deep);
  flex-shrink: 0;
}
.doodle-star {
  display: inline-block;
  color: var(--landing-flare);
}
.doodle-bullet {
  display: inline-block;
  color: var(--landing-blue-deep);
  flex-shrink: 0;
  margin-top: 3px;
}
.landing-li-bullet-not {
  color: var(--landing-muted);
}
.doodle-circled-number {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--landing-blue-deep);
}
.doodle-circled-number svg {
  position: absolute;
  inset: 0;
}
.doodle-circled-number-val {
  position: relative;
  font-family: var(--font-jetbrains), ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--landing-ink);
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev`, open `/`. Expected: page background is warm paper white with faint horizontal notebook rule lines (no grid, no "BRIEFING" watermark); nav brand text and hero heading render in the Delius Swash Caps handwritten font; no console errors. Run `npx tsc --noEmit && npx eslint app/layout.tsx app/dualtrack.css` — expected no errors (CSS isn't type-checked/linted by these but confirms `layout.tsx` compiles).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/dualtrack.css
git commit -m "Add doodle font, color tokens, and paper background foundation"
```

---

## Task 3: Section CSS — brutalist → doodle shape, shadow, and color pass

**Files:**
- Modify: `app/dualtrack.css` (selectors from `.landing-nav` through the `@media (max-width: 860px)` block at the end of the landing section, i.e. current lines 4093–5565 minus the excluded `.legal-*` / `.landing-features*` / `.landing-billing*` ranges — see Global Constraints)

Every edit below is a small, targeted `Edit` (exact old text → exact new text). Apply them in the order listed; each is independent. Do not touch any selector not listed here — everything not listed keeps its current declarations (padding/gap/grid-template-columns/font-size etc. — pure layout, doesn't need to change for the doodle skin).

- [ ] **Step 1: Nav**

Old:
```css
.landing-nav-link,
.landing-nav-cta {
  cursor: pointer;
  font-family: inherit;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 0;
  border: 2.5px solid var(--landing-ink);
  box-shadow: 2px 2px 0 color-mix(in srgb, var(--landing-ink) 18%, transparent);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, color 0.12s ease;
}
```
New:
```css
.landing-nav-link,
.landing-nav-cta {
  cursor: pointer;
  font-weight: 400;
  font-size: 13px;
  letter-spacing: 0.02em;
  text-transform: none;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  border: 2px solid var(--landing-ink);
  box-shadow: 0 3px 8px -3px color-mix(in srgb, var(--landing-ink) 24%, transparent);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, color 0.12s ease;
}
```

Old:
```css
.landing-nav-link:hover {
  color: var(--landing-ink);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 28%, transparent);
  background: color-mix(in srgb, var(--landing-blue) 12%, var(--landing-panel));
}
```
New:
```css
.landing-nav-link:hover {
  color: var(--landing-ink);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px -4px color-mix(in srgb, var(--landing-ink) 30%, transparent);
  background: color-mix(in srgb, var(--landing-blue) 16%, var(--landing-panel));
}
```

Old:
```css
.landing-nav-cta:hover {
  background: color-mix(in srgb, var(--landing-ink) 88%, black);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 28%, transparent);
}
```
New:
```css
.landing-nav-cta:hover {
  background: color-mix(in srgb, var(--landing-ink) 88%, black);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px -4px color-mix(in srgb, var(--landing-ink) 30%, transparent);
}
```

Old:
```css
.landing-brand-mark {
  width: 18px;
  height: 18px;
  background: var(--landing-blue);
  border: 2.5px solid var(--landing-ink);
  box-shadow: 3px 3px 0 var(--landing-ink);
  transform: none;
  flex-shrink: 0;
  animation: landingMarkPulse 2.8s ease-in-out infinite;
}
```
New:
```css
.landing-brand-mark {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--landing-blue);
  border: 2.5px solid var(--landing-ink);
  box-shadow: 0 2px 5px -1px color-mix(in srgb, var(--landing-ink) 40%, transparent);
  flex-shrink: 0;
  animation: landingMarkPulse 2.8s ease-in-out infinite;
}
```

- [ ] **Step 2: Hero**

Old:
```css
.landing-hero {
  position: relative;
  margin-top: 24px;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 28px 36px;
  align-items: center;
  padding: 28px 28px 28px 32px;
  background: var(--landing-panel);
  color: var(--landing-ink);
  border: 3.5px solid var(--landing-ink);
  box-shadow:
    8px 8px 0 var(--landing-ink),
    0 0 0 1px color-mix(in srgb, var(--landing-blue) 25%, transparent);
  overflow: hidden;
  isolation: isolate;
}
```
New:
```css
.landing-hero {
  position: relative;
  margin-top: 24px;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 28px 36px;
  align-items: center;
  padding: 28px 28px 28px 32px;
  background: var(--landing-panel);
  color: var(--landing-ink);
  border: 2.5px solid var(--landing-ink);
  border-radius: var(--landing-radius);
  box-shadow: 0 20px 40px -16px color-mix(in srgb, var(--landing-ink) 30%, transparent);
  overflow: hidden;
  isolation: isolate;
}
```

Old:
```css
.landing-hero-kicker {
  display: inline-block;
  margin: 0 0 10px;
  padding: 5px 11px;
  background: var(--landing-mint);
  border: 2.5px solid var(--landing-ink);
  box-shadow: 3px 3px 0 var(--landing-ink);
  font-family: var(--font-jetbrains), ui-monospace, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0b1220;
  line-height: 1.2;
}
```
New:
```css
.landing-hero-kicker {
  display: inline-block;
  margin: 0 0 10px;
  padding: 6px 14px;
  background: var(--landing-mint);
  border-radius: 999px;
  box-shadow: 0 4px 10px -3px color-mix(in srgb, var(--landing-ink) 35%, transparent);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--landing-on);
  line-height: 1.2;
}
```

Old:
```css
.landing-brand-hero {
  margin: 0 0 10px;
  font-family: var(--font-archivo), var(--font-space), sans-serif;
  font-weight: 800;
  font-size: clamp(48px, 7vw, 78px);
  line-height: 0.88;
  letter-spacing: -0.05em;
  color: var(--landing-ink);
  text-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-blue) 22%, transparent);
  animation: landingRise 0.45s ease-out both;
}
```
New:
```css
.landing-brand-hero {
  margin: 0 0 10px;
  font-weight: 400;
  font-size: clamp(48px, 7vw, 78px);
  line-height: 0.88;
  letter-spacing: -0.01em;
  color: var(--landing-ink);
  text-shadow: none;
  animation: landingRise 0.45s ease-out both;
}
```

Old:
```css
.landing-hero-line {
  display: block;
  color: color-mix(in srgb, var(--landing-ink) 72%, var(--landing-blue));
}
```
New:
```css
.landing-hero-line {
  display: block;
  color: color-mix(in srgb, var(--landing-ink) 72%, var(--landing-blue-deep));
}
```

Old:
```css
.landing-hero-chip {
  font-family: var(--font-jetbrains), ui-monospace, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 5px 9px;
  border: 1.5px solid var(--landing-ink);
  background: color-mix(in srgb, var(--landing-panel) 70%, transparent);
  color: var(--landing-ink);
}
```
New:
```css
.landing-hero-chip {
  font-family: var(--font-jetbrains), ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: none;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1.5px solid var(--landing-ink);
  background: color-mix(in srgb, var(--landing-panel) 70%, transparent);
  color: var(--landing-ink);
}
```

- [ ] **Step 3: CTA buttons**

Old:
```css
.landing-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 24px;
  cursor: pointer;
  border: 3px solid var(--landing-ink);
  border-radius: 0;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: var(--landing-blue);
  color: var(--landing-on);
  box-shadow: 4px 4px 0 var(--landing-ink);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}
.landing-cta:hover {
  background: color-mix(in srgb, var(--landing-blue) 82%, #000);
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--landing-ink);
}
.landing-cta:active {
  transform: translate(1px, 1px);
  box-shadow: 2px 2px 0 var(--landing-ink);
}
```
New:
```css
.landing-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 26px;
  cursor: pointer;
  border: 2px solid var(--landing-ink);
  border-radius: 999px;
  font-weight: 400;
  font-size: 15px;
  letter-spacing: 0.01em;
  text-transform: none;
  background: var(--landing-ink);
  color: var(--landing-on);
  box-shadow: 0 10px 22px -8px color-mix(in srgb, var(--landing-ink) 45%, transparent);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}
.landing-cta:hover {
  background: color-mix(in srgb, var(--landing-ink) 88%, black);
  transform: translateY(-3px);
  box-shadow: 0 14px 28px -8px color-mix(in srgb, var(--landing-ink) 50%, transparent);
}
.landing-cta:active {
  transform: translateY(0);
  box-shadow: 0 6px 14px -6px color-mix(in srgb, var(--landing-ink) 45%, transparent);
}
```

(Note: `.landing-cta` background moves from `var(--landing-blue)` to `var(--landing-ink)` — white text on raw sky blue is 2.3:1 and fails AA; white text on navy is 11:1. This is the fix called out in the spec's accessibility section.)

Old:
```css
.landing-cta-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 24px;
  cursor: pointer;
  border: 3px solid var(--landing-ink);
  border-radius: 0;
  background: var(--landing-panel);
  color: var(--landing-ink);
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  box-shadow: 4px 4px 0 var(--landing-ink);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}
.landing-cta-ghost:hover {
  background: color-mix(in srgb, var(--landing-flare) 55%, var(--landing-panel));
  border-color: var(--landing-ink);
  color: var(--landing-ink);
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--landing-ink);
}
.landing-cta-ghost:active {
  transform: translate(1px, 1px);
  box-shadow: 2px 2px 0 var(--landing-ink);
}
```
New:
```css
.landing-cta-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 26px;
  cursor: pointer;
  border: 2px solid var(--landing-ink);
  border-radius: 999px;
  background: var(--landing-panel);
  color: var(--landing-ink);
  font-weight: 400;
  font-size: 15px;
  letter-spacing: 0.01em;
  text-transform: none;
  box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--landing-ink) 22%, transparent);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}
.landing-cta-ghost:hover {
  background: color-mix(in srgb, var(--landing-blue) 14%, var(--landing-panel));
  border-color: var(--landing-ink);
  color: var(--landing-ink);
  transform: translateY(-3px);
  box-shadow: 0 12px 24px -8px color-mix(in srgb, var(--landing-ink) 26%, transparent);
}
.landing-cta-ghost:active {
  transform: translateY(0);
  box-shadow: 0 4px 10px -4px color-mix(in srgb, var(--landing-ink) 22%, transparent);
}
```

- [ ] **Step 4: Hero viz mockup**

Old:
```css
.landing-viz-board {
  width: min(100%, 340px);
  margin-right: 48px;
  padding: 14px;
  background: color-mix(in srgb, var(--landing-panel) 88%, #fff);
  border: 2.5px solid var(--landing-ink);
  box-shadow: 5px 5px 0 var(--landing-ink);
  transform-style: preserve-3d;
  will-change: transform;
}
```
New:
```css
.landing-viz-board {
  width: min(100%, 340px);
  margin-right: 48px;
  padding: 14px;
  background: color-mix(in srgb, var(--landing-panel) 88%, #fff);
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius);
  box-shadow: 0 18px 34px -14px color-mix(in srgb, var(--landing-ink) 35%, transparent);
  transform: rotate(-1.5deg);
}
```

(The `transform-style: preserve-3d` / `will-change: transform` are dropped — Task 4 removes the pointer-tracked `rotateX`/`rotateY`/`transformPerspective` inline style entirely, this becomes a plain static element.)

Old:
```css
.landing-viz-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  background: var(--landing-mint);
  border: 1.5px solid var(--landing-ink);
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #111;
}
```
New:
```css
.landing-viz-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  background: var(--landing-mint);
  border-radius: 999px;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--landing-on);
}
```

Old:
```css
.landing-viz-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0a7a3e;
  animation: landingPulse 1.4s ease-in-out infinite;
}
```
New:
```css
.landing-viz-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--landing-on);
  animation: landingPulse 1.4s ease-in-out infinite;
}
```

Old:
```css
.landing-viz-bar {
  height: 10px;
  border: 2px solid var(--landing-ink);
  background: color-mix(in srgb, var(--landing-ink) 6%, var(--landing-panel));
  overflow: hidden;
}
```
New:
```css
.landing-viz-bar {
  height: 10px;
  border: 2px solid var(--landing-ink);
  border-radius: 999px;
  background: color-mix(in srgb, var(--landing-ink) 6%, var(--landing-panel));
  overflow: hidden;
}
```

Old:
```css
.landing-viz-day {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px 8px;
  border: 1.5px solid color-mix(in srgb, var(--landing-ink) 35%, transparent);
  background: var(--landing-panel);
  font-size: 12px;
  font-weight: 600;
}
```
New:
```css
.landing-viz-day {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1.5px solid color-mix(in srgb, var(--landing-ink) 35%, transparent);
  border-radius: var(--landing-radius-sm);
  background: var(--landing-panel);
  font-size: 12px;
  font-weight: 600;
}
```

Old:
```css
.landing-viz-day.is-active {
  border-color: var(--landing-ink);
  border-width: 2px;
  background: color-mix(in srgb, var(--landing-blue) 14%, var(--landing-panel));
  box-shadow: 2px 2px 0 var(--landing-ink);
  animation: landingActiveBlink 2.8s ease-in-out infinite;
}
```
New:
```css
.landing-viz-day.is-active {
  border-color: var(--landing-ink);
  border-width: 2px;
  background: color-mix(in srgb, var(--landing-blue) 14%, var(--landing-panel));
  box-shadow: 0 4px 10px -3px color-mix(in srgb, var(--landing-ink) 35%, transparent);
  animation: landingActiveBlink 2.8s ease-in-out infinite;
}
```

Old:
```css
.landing-viz-check {
  width: 14px;
  height: 14px;
  border: 2px solid var(--landing-ink);
  background: var(--landing-mint);
  position: relative;
}
```
New:
```css
.landing-viz-check {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--landing-ink);
  background: var(--landing-mint);
  position: relative;
}
```

Old:
```css
.landing-viz-now {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 2px 5px;
  background: var(--landing-flare);
  border: 1.5px solid var(--landing-ink);
  color: #0b1220;
}
```
New:
```css
.landing-viz-now {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--landing-flare);
  color: var(--landing-on);
}
```

Old:
```css
.landing-viz-kit-label {
  align-self: flex-start;
  margin-bottom: 6px;
  padding: 2px 6px;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--landing-ink);
  color: var(--landing-panel);
}
```
New:
```css
.landing-viz-kit-label {
  align-self: flex-start;
  margin-bottom: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: none;
  background: var(--landing-ink);
  color: var(--landing-panel);
}
```

Old:
```css
.landing-viz-slip {
  padding: 10px 10px 12px;
  border: 2px solid var(--landing-ink);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
  color: #111;
  box-shadow: 2px 2px 0 color-mix(in srgb, var(--landing-ink) 35%, transparent);
}
```
New:
```css
.landing-viz-slip {
  padding: 10px 10px 12px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius-sm);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--landing-ink);
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--landing-ink) 35%, transparent);
}
```

Old:
```css
.landing-viz-stamp {
  position: absolute;
  top: 6px;
  right: 12px;
  padding: 8px 10px;
  border: 3px solid color-mix(in srgb, #c2410c 80%, var(--landing-ink));
  color: color-mix(in srgb, #c2410c 80%, var(--landing-ink));
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transform: rotate(12deg);
  opacity: 0.85;
  background: color-mix(in srgb, #ffd0c8 35%, transparent);
  animation: landingStampIn 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  animation-delay: 0.45s;
}
```
New:
```css
.landing-viz-stamp {
  position: absolute;
  top: 6px;
  right: 12px;
  padding: 8px 12px;
  border: 2.5px dashed color-mix(in srgb, var(--landing-pink) 75%, var(--landing-ink));
  border-radius: 999px;
  color: color-mix(in srgb, var(--landing-pink) 75%, var(--landing-ink));
  font-family: var(--font-jetbrains), ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transform: rotate(8deg);
  opacity: 0.9;
  background: color-mix(in srgb, var(--landing-pink) 14%, transparent);
  animation: landingStampIn 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  animation-delay: 0.45s;
}
```

- [ ] **Step 5: Stats**

Old:
```css
.landing-stat {
  background: var(--landing-panel);
  border: 2.5px solid var(--landing-ink);
  border-radius: 0;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 18%, transparent);
  animation: landingRise 0.4s ease-out both;
  animation-delay: calc(0.22s + min(var(--i, 0), 3) * 50ms);
}
.landing-stat:nth-child(1) { background: color-mix(in srgb, var(--landing-mint) 55%, var(--landing-panel)); }
.landing-stat:nth-child(2) { background: #c8e7ff; }
.landing-stat:nth-child(3) { background: var(--landing-flare); }
.landing-stat:nth-child(4) { background: #ffd0c8; }
.landing-stat-val {
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.03em;
  color: var(--landing-ink);
}
```
New:
```css
.landing-stat {
  background: var(--landing-panel);
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius-sm);
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--landing-ink) 24%, transparent);
  animation: landingRise 0.4s ease-out both;
  animation-delay: calc(0.22s + min(var(--i, 0), 3) * 50ms);
}
.landing-stat:nth-child(1) { background: color-mix(in srgb, var(--landing-mint) 30%, var(--landing-panel)); }
.landing-stat:nth-child(2) { background: color-mix(in srgb, var(--landing-blue) 20%, var(--landing-panel)); }
.landing-stat:nth-child(3) { background: var(--landing-flare); }
.landing-stat:nth-child(3) .landing-stat-val,
.landing-stat:nth-child(3) .landing-stat-label { color: var(--landing-on); }
.landing-stat:nth-child(4) { background: color-mix(in srgb, var(--landing-pink) 20%, var(--landing-panel)); }
.landing-stat-val {
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.03em;
  color: var(--landing-ink);
}
```

- [ ] **Step 6: Final CTA band**

Old:
```css
.landing-band {
  margin-top: var(--landing-gap);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: 28px 32px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--landing-blue) 12%, transparent), transparent 50%),
    var(--landing-panel);
  color: var(--landing-ink);
  border-radius: 0;
  border: 3px solid var(--landing-ink);
  box-shadow: 5px 5px 0 color-mix(in srgb, var(--landing-ink) 20%, transparent);
  animation: landingRise 0.4s ease-out both;
}
```
New:
```css
.landing-band {
  position: relative;
  margin-top: var(--landing-gap);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: 28px 32px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--landing-blue) 12%, transparent), transparent 50%),
    var(--landing-panel);
  color: var(--landing-ink);
  border-radius: var(--landing-radius);
  border: 2px solid var(--landing-ink);
  box-shadow: 0 18px 32px -16px color-mix(in srgb, var(--landing-ink) 26%, transparent);
  animation: landingRise 0.4s ease-out both;
}
.landing-band-arrow {
  position: absolute;
  top: -14px;
  right: 120px;
  color: var(--landing-blue-deep);
  transform: rotate(35deg);
}
```

Old:
```css
.landing-cta-band {
  background: var(--landing-blue);
  color: var(--landing-on);
}
.landing-cta-band:hover {
  background: color-mix(in srgb, var(--landing-blue) 86%, black);
}
```
New:
```css
.landing-cta-band {
  background: var(--landing-ink);
  color: var(--landing-on);
}
.landing-cta-band:hover {
  background: color-mix(in srgb, var(--landing-ink) 86%, black);
}
```

- [ ] **Step 7: Picker**

Old:
```css
.landing-plan {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  border-radius: 0;
  min-height: 220px;
  border: 3px solid var(--landing-ink);
  box-shadow: 5px 5px 0 var(--landing-ink);
}
.landing-plan-a {
  background: color-mix(in srgb, var(--landing-blue) 12%, var(--landing-panel));
  color: var(--landing-ink);
}
.landing-plan-b {
  background: color-mix(in srgb, var(--landing-flare) 55%, var(--landing-panel));
  color: var(--landing-ink);
}
```
New:
```css
.landing-plan {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  border-radius: var(--landing-radius);
  min-height: 220px;
  border: 2px solid var(--landing-ink);
  box-shadow: 0 14px 28px -14px color-mix(in srgb, var(--landing-ink) 30%, transparent);
  transform: rotate(var(--landing-tilt, 0deg));
}
.landing-plan:nth-child(odd) { --landing-tilt: -0.7deg; }
.landing-plan:nth-child(even) { --landing-tilt: 0.7deg; }
.landing-plan-a {
  background: color-mix(in srgb, var(--landing-blue) 14%, var(--landing-panel));
  color: var(--landing-ink);
}
.landing-plan-b {
  background: color-mix(in srgb, var(--landing-pink) 16%, var(--landing-panel));
  color: var(--landing-ink);
}
```

Old:
```css
.landing-plan-btn {
  margin-top: 12px;
  align-self: flex-start;
  min-height: 44px;
  padding: 0 16px;
  cursor: pointer;
  border: 2.5px solid var(--landing-ink);
  border-radius: 0;
  background: var(--landing-panel);
  color: var(--landing-ink);
  font-family: inherit;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: 2px 2px 0 var(--landing-ink);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.landing-plan-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--landing-ink);
}
.landing-plan-btn:active {
  transform: translate(0, 0);
  box-shadow: 1px 1px 0 var(--landing-ink);
}
```
New:
```css
.landing-plan-btn {
  margin-top: 12px;
  align-self: flex-start;
  min-height: 44px;
  padding: 0 18px;
  cursor: pointer;
  border: 2px solid var(--landing-ink);
  border-radius: 999px;
  background: var(--landing-panel);
  color: var(--landing-ink);
  font-weight: 400;
  font-size: 14px;
  letter-spacing: 0.01em;
  text-transform: none;
  box-shadow: 0 4px 10px -3px color-mix(in srgb, var(--landing-ink) 30%, transparent);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.landing-plan-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px color-mix(in srgb, var(--landing-ink) 34%, transparent);
}
.landing-plan-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px -2px color-mix(in srgb, var(--landing-ink) 30%, transparent);
}
```

Old:
```css
.landing-picker-or::before,
.landing-picker-or::after {
  content: "";
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--landing-ink) 12%, transparent);
}
```
New:
```css
.landing-picker-or::before,
.landing-picker-or::after {
  content: "";
  flex: 1;
  height: 2px;
  border-radius: 999px;
  background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--landing-ink) 20%, transparent) 0 6px, transparent 6px 10px);
}
```

Old:
```css
.landing-picker-custom {
  display: flex;
  width: 100%;
  border-color: var(--landing-ink);
  color: var(--landing-ink);
  background: var(--landing-panel);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 18%, transparent);
}
.landing-picker-custom:hover {
  background: color-mix(in srgb, var(--landing-blue) 10%, var(--landing-panel));
  border-color: var(--landing-ink);
  color: var(--landing-ink);
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--landing-ink) 26%, transparent);
}
```
New:
```css
.landing-picker-custom {
  display: flex;
  width: 100%;
  border-color: var(--landing-ink);
  color: var(--landing-ink);
  background: var(--landing-panel);
  box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--landing-ink) 22%, transparent);
}
.landing-picker-custom:hover {
  background: color-mix(in srgb, var(--landing-blue) 14%, var(--landing-panel));
  border-color: var(--landing-ink);
  color: var(--landing-ink);
  transform: translateY(-2px);
  box-shadow: 0 10px 22px -6px color-mix(in srgb, var(--landing-ink) 26%, transparent);
}
```

- [ ] **Step 8: Footer**

Old:
```css
.landing-footer-dot {
  width: 8px;
  height: 8px;
  border-radius: 0;
  background: var(--landing-blue);
  border: 1.5px solid var(--landing-ink);
}
```
New:
```css
.landing-footer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--landing-blue);
  border: 1.5px solid var(--landing-ink);
}
```

Old:
```css
.landing-footer-link {
  appearance: none;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  min-height: 40px;
  padding: 0 14px;
  border: 2px solid var(--landing-ink);
  background: var(--landing-panel);
  color: var(--landing-ink);
  box-shadow: 2px 2px 0 color-mix(in srgb, var(--landing-ink) 14%, transparent);
}
.landing-footer-link:hover {
  transform: translate(-1px, -1px);
  background: color-mix(in srgb, var(--landing-blue) 12%, var(--landing-panel));
}
```
New:
```css
.landing-footer-link {
  appearance: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.02em;
  text-transform: none;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1.5px solid var(--landing-ink);
  background: var(--landing-panel);
  color: var(--landing-ink);
  box-shadow: 0 3px 8px -3px color-mix(in srgb, var(--landing-ink) 18%, transparent);
}
.landing-footer-link:hover {
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--landing-blue) 14%, var(--landing-panel));
}
```

- [ ] **Step 9: Section stamp/title + problem list**

Old:
```css
.landing-stamp {
  display: inline-block;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 3px 8px;
  border: 2px solid var(--landing-ink);
  background: var(--landing-flare);
  color: #0b1220;
  margin-bottom: 12px;
}
```
New:
```css
.landing-stamp {
  display: inline-block;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.02em;
  text-transform: none;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--landing-flare);
  color: var(--landing-on);
  margin-bottom: 12px;
}
```

Old:
```css
.landing-section-title {
  margin: 0 0 10px;
  font-family: var(--display, var(--font-space), sans-serif);
  font-size: clamp(26px, 4vw, 36px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--landing-ink);
}
```
New:
```css
.landing-section-title {
  margin: 0 0 10px;
  font-size: clamp(26px, 4vw, 36px);
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--landing-ink);
}
```

Old:
```css
.landing-problem-list li {
  position: relative;
  padding: 14px 16px 14px 18px;
  border: 2.5px solid var(--landing-ink);
  background: var(--landing-panel);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 16%, transparent);
  font-size: 14px;
  line-height: 1.45;
  font-weight: 600;
}
```
New:
```css
.landing-problem-list li {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 18px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius-sm);
  background: var(--landing-panel);
  box-shadow: 0 8px 18px -10px color-mix(in srgb, var(--landing-ink) 22%, transparent);
  font-size: 14px;
  line-height: 1.45;
  font-weight: 500;
}
```

- [ ] **Step 10: Loop steps**

Old:
```css
.landing-loop-step {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 140px;
  padding: 16px;
  border: 2.5px solid var(--landing-ink);
  background: var(--landing-panel);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 16%, transparent);
}
```
New:
```css
.landing-loop-step {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 140px;
  padding: 18px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius);
  background: var(--landing-panel);
  box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--landing-ink) 24%, transparent);
  transform: rotate(var(--landing-tilt, 0deg));
}
.landing-loop-step:nth-child(6n + 1) { --landing-tilt: -0.8deg; }
.landing-loop-step:nth-child(6n + 2) { --landing-tilt: 0.6deg; }
.landing-loop-step:nth-child(6n + 3) { --landing-tilt: -0.5deg; }
.landing-loop-step:nth-child(6n + 4) { --landing-tilt: 0.9deg; }
.landing-loop-step:nth-child(6n + 5) { --landing-tilt: -0.7deg; }
.landing-loop-step:nth-child(6n + 6) { --landing-tilt: 0.5deg; }
```

Old:
```css
.landing-loop-n {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--landing-muted);
}
```
New: delete this rule entirely — `.landing-loop-n` (the plain "01" text span) is replaced by `<DoodleCircledNumber>` in Task 4 and no longer rendered.

Old:
```css
.landing-loop-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
```
New:
```css
.landing-loop-title {
  margin: 0;
  font-size: 18px;
  font-weight: 400;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 11: Surfaces**

Old:
```css
.landing-surfaces-callout {
  padding: 14px 16px;
  border: 2.5px solid var(--landing-ink);
  background: color-mix(in srgb, var(--landing-mint) 55%, var(--landing-panel));
  box-shadow: 3px 3px 0 var(--landing-ink);
  color: var(--landing-ink);
}
```
New:
```css
.landing-surfaces-callout {
  padding: 14px 18px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius-sm);
  background: color-mix(in srgb, var(--landing-mint) 30%, var(--landing-panel));
  box-shadow: 0 8px 18px -10px color-mix(in srgb, var(--landing-ink) 22%, transparent);
  color: var(--landing-ink);
}
```

Old:
```css
.landing-surface {
  padding: 20px;
  border: 3px solid var(--landing-ink);
  box-shadow: 5px 5px 0 var(--landing-ink);
}
```
New:
```css
.landing-surface {
  padding: 22px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius);
  box-shadow: 0 14px 26px -14px color-mix(in srgb, var(--landing-ink) 28%, transparent);
  transform: rotate(var(--landing-tilt, 0deg));
}
.landing-surface:nth-child(odd) { --landing-tilt: -0.6deg; }
.landing-surface:nth-child(even) { --landing-tilt: 0.6deg; }
```

Old:
```css
.landing-surface-deck {
  background: color-mix(in srgb, var(--landing-blue) 16%, var(--landing-panel));
}
.landing-surface-kit {
  background: color-mix(in srgb, #c4b5fd 22%, var(--landing-panel));
}
```
New:
```css
.landing-surface-deck {
  background: color-mix(in srgb, var(--landing-blue) 18%, var(--landing-panel));
}
.landing-surface-kit {
  background: color-mix(in srgb, var(--landing-pink) 16%, var(--landing-panel));
}
```

Old:
```css
.landing-surface-stamp {
  display: inline-block;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border: 1.5px solid var(--landing-ink);
  background: var(--landing-panel);
  margin-bottom: 10px;
}
```
New:
```css
.landing-surface-stamp {
  display: inline-block;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.01em;
  text-transform: none;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1.5px solid var(--landing-ink);
  background: var(--landing-panel);
  margin-bottom: 10px;
}
```

Old:
```css
.landing-surface-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
```
New:
```css
.landing-surface-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 400;
  letter-spacing: -0.01em;
}
```

Old:
```css
.landing-surface-cta {
  appearance: none;
  cursor: pointer;
  min-height: 42px;
  padding: 0 14px;
  border: 2.5px solid var(--landing-ink);
  background: var(--landing-panel);
  color: var(--landing-ink);
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: 2px 2px 0 var(--landing-ink);
}
.landing-surface-cta:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--landing-ink);
}
```
New:
```css
.landing-surface-cta {
  appearance: none;
  cursor: pointer;
  min-height: 42px;
  padding: 0 16px;
  border: 2px solid var(--landing-ink);
  border-radius: 999px;
  background: var(--landing-panel);
  color: var(--landing-ink);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.01em;
  text-transform: none;
  box-shadow: 0 4px 10px -3px color-mix(in srgb, var(--landing-ink) 26%, transparent);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.landing-surface-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px color-mix(in srgb, var(--landing-ink) 30%, transparent);
}
```

- [ ] **Step 12: AI cards**

Old:
```css
.landing-ai-card {
  padding: 20px;
  border: 2.5px solid var(--landing-ink);
  background: var(--landing-panel);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 16%, transparent);
}
.landing-ai-card-main {
  background: color-mix(in srgb, var(--landing-blue) 12%, var(--landing-panel));
  box-shadow: 4px 4px 0 var(--landing-ink);
}
```
New:
```css
.landing-ai-card {
  padding: 22px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius);
  background: var(--landing-panel);
  box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--landing-ink) 22%, transparent);
}
.landing-ai-card-main {
  background: color-mix(in srgb, var(--landing-blue) 14%, var(--landing-panel));
  box-shadow: 0 16px 28px -14px color-mix(in srgb, var(--landing-ink) 28%, transparent);
}
```

Old:
```css
.landing-ai-card-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 800;
}
```
New:
```css
.landing-ai-card-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 400;
  font-family: var(--font-delius), cursive;
}
```

- [ ] **Step 13: Pricing**

Old:
```css
.landing-price-card {
  position: relative;
  padding: 18px 16px 16px;
  border: 2.5px solid var(--landing-ink);
  background: var(--landing-panel);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 16%, transparent);
}
```
New:
```css
.landing-price-card {
  position: relative;
  padding: 20px 18px 18px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius);
  background: var(--landing-panel);
  box-shadow: 0 12px 24px -14px color-mix(in srgb, var(--landing-ink) 24%, transparent);
  transform: rotate(var(--landing-tilt, 0deg));
}
.landing-price-card:nth-child(3n + 1) { --landing-tilt: -0.6deg; }
.landing-price-card:nth-child(3n + 2) { --landing-tilt: 0deg; }
.landing-price-card:nth-child(3n + 3) { --landing-tilt: 0.6deg; }
```

Old:
```css
.landing-price-card-free {
  border-width: 3px;
  box-shadow: 5px 5px 0 var(--landing-ink);
  background: color-mix(in srgb, var(--landing-mint) 35%, var(--landing-panel));
}
```
New:
```css
.landing-price-card-free {
  position: relative;
  border-width: 2.5px;
  box-shadow: 0 18px 32px -16px color-mix(in srgb, var(--landing-ink) 30%, transparent);
  background: color-mix(in srgb, var(--landing-mint) 20%, var(--landing-panel));
}
```

Old:
```css
.landing-price-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 7px;
  border: 1.5px solid var(--landing-ink);
  background: #ffd0c8;
  color: #111;
}
.landing-price-badge-live { background: var(--landing-mint); }
```
New:
```css
.landing-price-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.02em;
  text-transform: none;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1.5px dashed var(--landing-ink);
  background: color-mix(in srgb, var(--landing-flare) 30%, var(--landing-panel));
  color: var(--landing-ink);
}
.landing-price-badge-live {
  background: var(--landing-mint);
  border-style: solid;
  color: var(--landing-on);
}
```

Old:
```css
.landing-price-rank {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
```
New:
```css
.landing-price-rank {
  margin: 0;
  font-size: 22px;
  font-weight: 400;
  letter-spacing: -0.01em;
}
```

Old:
```css
.landing-price-cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}
```
New: unchanged, no edit needed (no hard-edge values here) — skip.

- [ ] **Step 14: Trust + audience**

Old:
```css
.landing-trust-card {
  padding: 16px;
  border: 2.5px solid var(--landing-ink);
  background: var(--landing-panel);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 14%, transparent);
}
```
New:
```css
.landing-trust-card {
  padding: 18px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius);
  background: var(--landing-panel);
  box-shadow: 0 10px 20px -12px color-mix(in srgb, var(--landing-ink) 22%, transparent);
  transform: rotate(var(--landing-tilt, 0deg));
}
.landing-trust-card:nth-child(3n + 1) { --landing-tilt: -0.5deg; }
.landing-trust-card:nth-child(3n + 2) { --landing-tilt: 0.4deg; }
.landing-trust-card:nth-child(3n + 3) { --landing-tilt: -0.4deg; }
```

Old:
```css
.landing-trust-card h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 800;
}
```
New:
```css
.landing-trust-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 400;
  font-family: var(--font-delius), cursive;
}
```

Old:
```css
.landing-audience-for,
.landing-audience-not {
  padding: 18px;
  border: 2.5px solid var(--landing-ink);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--landing-ink) 14%, transparent);
}
.landing-audience-for {
  background: color-mix(in srgb, var(--landing-mint) 40%, var(--landing-panel));
}
.landing-audience-not {
  background: color-mix(in srgb, #ffd0c8 35%, var(--landing-panel));
}
```
New:
```css
.landing-audience-for,
.landing-audience-not {
  padding: 20px;
  border: 2px solid var(--landing-ink);
  border-radius: var(--landing-radius);
  box-shadow: 0 10px 20px -12px color-mix(in srgb, var(--landing-ink) 22%, transparent);
}
.landing-audience-for {
  background: color-mix(in srgb, var(--landing-mint) 22%, var(--landing-panel));
}
.landing-audience-not {
  background: color-mix(in srgb, var(--landing-muted) 12%, var(--landing-panel));
}
.landing-audience-for ul li,
.landing-audience-not ul li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
```

Old:
```css
.landing-audience-label {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```
New:
```css
.landing-audience-label {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.01em;
  text-transform: none;
}
```

- [ ] **Step 15: Keyframes touching hard-edge box-shadows**

Old:
```css
@keyframes landingMarkPulse {
  0%, 100% { box-shadow: 3px 3px 0 var(--landing-ink); }
  50% { box-shadow: 4px 4px 0 var(--landing-pink); background: color-mix(in srgb, var(--landing-blue) 80%, #fff); }
}
```
New:
```css
@keyframes landingMarkPulse {
  0%, 100% { box-shadow: 0 2px 5px -1px color-mix(in srgb, var(--landing-ink) 40%, transparent); }
  50% { box-shadow: 0 3px 8px -1px color-mix(in srgb, var(--landing-pink) 55%, transparent); background: color-mix(in srgb, var(--landing-blue) 80%, #fff); }
}
```

Old:
```css
@keyframes landingActiveBlink {
  0%, 100% { box-shadow: 2px 2px 0 var(--landing-ink); }
  50% { box-shadow: 3px 3px 0 var(--landing-ink); }
}
```
New:
```css
@keyframes landingActiveBlink {
  0%, 100% { box-shadow: 0 4px 10px -3px color-mix(in srgb, var(--landing-ink) 35%, transparent); }
  50% { box-shadow: 0 6px 14px -3px color-mix(in srgb, var(--landing-ink) 45%, transparent); }
}
```

- [ ] **Step 16: Responsive block**

Old (inside `@media (max-width: 860px)`):
```css
  .landing-feature { grid-template-columns: 44px 1fr; padding: 16px; gap: 12px; }
  .landing-feature-icon { width: 44px; height: 44px; border-radius: 0; }
```
New: delete these two lines — `.landing-feature*` is dead CSS (zero references in `HomeView.tsx`, confirmed by grep), leave the rest of that media block (`.landing`, `.landing-hero`, `.landing-brand-hero`, `.landing-stats`, `.landing-picker-grid`, `.landing-band`) untouched — pure layout values, no color/shape fix needed.

- [ ] **Step 17: Verify**

Run: `npm run dev`, open `/`. Expected: buttons/badges/nav links are pill-shaped, cards have soft rounded corners and soft drop shadows (no hard offset "brutalist" shadows remain), loop-step/surface/price/trust/plan cards show a slight alternating tilt. Run `npx tsc --noEmit`.

- [ ] **Step 18: Commit**

```bash
git add app/dualtrack.css
git commit -m "Restyle homepage cards, buttons, and badges to doodle shapes and soft shadows"
```

---

## Task 4: HomeView.tsx — copy, structure, and doodle accents

**Files:**
- Modify: `features/landing/HomeView.tsx` (full-file rewrite)

**Interfaces:**
- Consumes: `DoodleUnderline`, `DoodleArrow`, `DoodleStar`, `DoodleBullet`, `DoodleCircledNumber` from `@/features/landing/doodle-assets` (Task 1); `.landing-doodle-card`, `.landing-section-underline`, `.landing-li-bullet-not`, `.landing-band-arrow` CSS classes (Task 2/3); `useReducedMotion` from `motion/react` (replaces the deleted `useHeroTilt`).
- Produces: same exported `HomeView(props)` signature as today — no prop changes. `CAMPAIGN_STEPS` keeps the same shape (`{ n, title, copy }`) consumed by the render loop.
- No longer imports `TiltCard` (`features/landing/TiltCard.tsx`) or `useHeroTilt` (`features/landing/use3d.ts`) — both files are deleted in Task 5, once this task removes their last usages.

- [ ] **Step 1: Write the complete new file**

```tsx
// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { classNames } from "@/lib/classNames";
import { SUBSCRIPTION_TIERS, TIER_ORDER } from "@/lib/subscriptions";
import {
  DoodleUnderline,
  DoodleArrow,
  DoodleStar,
  DoodleBullet,
  DoodleCircledNumber,
} from "@/features/landing/doodle-assets";

const CAMPAIGN_STEPS = [
  {
    n: "01",
    title: "Start",
    copy: "Pick an example campaign, or generate a custom plan for any subject — psychology, economics, history, languages, crafts, tech, and more.",
  },
  {
    n: "02",
    title: "Show up",
    copy: "Daily Console — list, bento, or spine. Check topics. Write day notes.",
  },
  {
    n: "03",
    title: "Get a hand",
    copy: "Optional: Quiz me, generate notes, draft a LinkedIn post — with your own AI key.",
  },
  {
    n: "04",
    title: "Remember",
    copy: "Spaced repetition Review queue, Weekly recap, and On This Day resurfacing.",
  },
  {
    n: "05",
    title: "Catch the overflow",
    copy: "Rabbit holes go to Field Kit — not lost, not cluttering the campaign.",
  },
  {
    n: "06",
    title: "Progress",
    copy: "XP, levels, rank, streaks, and badges track the arc.",
  },
];

function scrollToId(id) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Marketing landing + cold-start plan picker.
 * Primary CTA requires sign-in / sign-up.
 */
export function HomeView({
  hasCampaign,
  summary,
  examples,
  onAddExample,
  onOpenBuilder,
  onOpenAccount,
  accountLabel,
  onRequireAuth,
  onStartWithAccount,
  onGoDashboard,
  onOpenPricing,
  onOpenKit,
  learnedCount = 0,
  bookmarkCount = 0,
}) {
  const [started, setStarted] = useState(false);
  const pickerRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (started && pickerRef.current) {
      pickerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [started]);

  /** Require account, then reveal plan picker. */
  const startAccount = () => {
    const go = () => setStarted(true);
    if (typeof onStartWithAccount === "function") {
      onStartWithAccount(go);
      return;
    }
    onRequireAuth?.(go);
  };

  const buildCustom = () => {
    const go = () => onOpenBuilder?.();
    if (typeof onStartWithAccount === "function") {
      onStartWithAccount(go);
      return;
    }
    onRequireAuth?.(go);
  };

  const openFieldKit = () => onOpenKit?.("learned");

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand" aria-label="Refrainly">
          <span className="landing-brand-mark" aria-hidden="true" />
          <span className="landing-brand-text">REFRAINLY</span>
        </div>
        <div className="landing-nav-actions">
          {onOpenKit && (
            <button
              type="button"
              className="landing-nav-link landing-nav-kit"
              onClick={openFieldKit}
            >
              Field kit
              {(learnedCount > 0 || bookmarkCount > 0) && (
                <span className="landing-nav-kit-count">{learnedCount + bookmarkCount}</span>
              )}
            </button>
          )}
          {hasCampaign && (
            <button type="button" className="landing-nav-link landing-nav-dash" onClick={onGoDashboard}>
              Dashboard
            </button>
          )}
          <button type="button" className="landing-nav-link" onClick={() => scrollToId("pricing")}>
            Pricing
          </button>
          <button type="button" className="landing-nav-cta" onClick={onOpenAccount}>
            {accountLabel ? "Account" : "Sign in"}
          </button>
        </div>
      </header>

      {/* 1. Hero */}
      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero-mesh" aria-hidden="true" />
        <div className="landing-hero-copy">
          <span className="landing-hero-kicker">Daily learning journal</span>
          <p className="landing-brand-hero">REFRAINLY</p>
          {hasCampaign ? (
            <>
              <h1 id="landing-hero-title" className="landing-hero-title">
                Ready to pick up where you left off?
              </h1>
              <p className="landing-hero-lead">
                Continue <strong>{summary.name}</strong> — {summary.daysComplete} of{" "}
                {summary.totalDays} days done.
              </p>
              <div className="landing-hero-actions">
                <button type="button" className="landing-cta" onClick={onGoDashboard}>
                  Go to dashboard
                </button>
                <button type="button" className="landing-cta-ghost" onClick={startAccount}>
                  Add another plan
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 id="landing-hero-title" className="landing-hero-title">
                Turn any subject into a daily learning habit
              </h1>
              <p className="landing-hero-lead">
                A <strong>daily campaign</strong> for any subject — day-by-day plans, real memory,
                and a Field Kit for every rabbit hole.
              </p>
              <div className="landing-hero-subjects" aria-hidden="true">
                {["Psychology", "Economics", "History", "Languages", "Music", "Tech"].map((s) => (
                  <span key={s} className="landing-hero-chip">{s}</span>
                ))}
              </div>
              <div className="landing-hero-actions">
                <button type="button" className="landing-cta" onClick={startAccount}>
                  Create free account
                </button>
                <button
                  type="button"
                  className="landing-cta-ghost"
                  onClick={() => scrollToId("pricing")}
                >
                  View pricing
                </button>
              </div>
              <p className="landing-hero-fine">Free Recruit tier · sign in required · syncs across devices</p>
            </>
          )}
        </div>

        <div className="landing-hero-viz" aria-hidden="true">
          <div className="landing-viz-board">
            <div className="landing-viz-top">
              <span className="landing-viz-op">MY LEARNING LOG</span>
              <span className="landing-viz-live">
                <span className="landing-viz-live-dot" />
                LIVE
              </span>
            </div>
            <div className="landing-viz-progress">
              <div className="landing-viz-progress-meta">
                <span>Day 12 / 30</span>
                <span>40%</span>
              </div>
              <div className="landing-viz-bar">
                <span className="landing-viz-bar-fill" />
              </div>
            </div>
            <ul className="landing-viz-days">
              <li className="landing-viz-day is-done">
                <span className="landing-viz-day-n">10</span>
                <span className="landing-viz-day-t">Deliberate practice</span>
                <span className="landing-viz-check" />
              </li>
              <li className="landing-viz-day is-done">
                <span className="landing-viz-day-n">11</span>
                <span className="landing-viz-day-t">Spaced repetition</span>
                <span className="landing-viz-check" />
              </li>
              <li className="landing-viz-day is-active">
                <span className="landing-viz-day-n">12</span>
                <span className="landing-viz-day-t">Retrieval practice</span>
                <span className="landing-viz-now">NOW</span>
              </li>
              <li className="landing-viz-day">
                <span className="landing-viz-day-n">13</span>
                <span className="landing-viz-day-t">Metacognition</span>
              </li>
            </ul>
          </div>
          <div className="landing-viz-kit">
            <span className="landing-viz-kit-label">Field Kit</span>
            <motion.div
              className="landing-viz-slip landing-viz-slip-a"
              initial={{ rotate: 3 }}
              animate={reduceMotion ? undefined : { rotate: [3, 6, 3], y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              Loss aversion ≠ risk aversion
            </motion.div>
            <motion.div
              className="landing-viz-slip landing-viz-slip-b"
              initial={{ rotate: -4 }}
              animate={reduceMotion ? undefined : { rotate: [-4, -6, -4], x: [0, 4, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              Link · Kahneman ch. 26
            </motion.div>
            <motion.div
              className="landing-viz-slip landing-viz-slip-c"
              initial={{ rotate: 1.5 }}
              animate={reduceMotion ? undefined : { rotate: [1.5, 3.5, 1.5], y: [0, 4, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              Rabbit hole → keep
            </motion.div>
          </div>
          <span className="landing-viz-stamp">DAY 12</span>
        </div>
      </section>

      {hasCampaign && summary && (
        <section className="landing-stats" aria-label="Your progress">
          <div className="landing-stat" style={{ "--i": 0 }}>
            <span className="landing-stat-val">{summary.streak}</span>
            <span className="landing-stat-label">day streak</span>
          </div>
          <div className="landing-stat" style={{ "--i": 1 }}>
            <span className="landing-stat-val">{summary.xp.toLocaleString()}</span>
            <span className="landing-stat-label">XP</span>
          </div>
          <div className="landing-stat" style={{ "--i": 2 }}>
            <span className="landing-stat-val">LV {summary.level}</span>
            <span className="landing-stat-label">{summary.rank}</span>
          </div>
          <div className="landing-stat" style={{ "--i": 3 }}>
            <span className="landing-stat-val">
              {summary.daysComplete}/{summary.totalDays}
            </span>
            <span className="landing-stat-label">days</span>
          </div>
        </section>
      )}

      {/* 2. Problem */}
      <section className="landing-section landing-problem" aria-labelledby="landing-problem-title">
        <span className="landing-stamp">The problem</span>
        <h2 id="landing-problem-title" className="landing-section-title">
          Most tools dump content on you — or lock you into one path
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <ul className="landing-problem-list">
          <li>
            <DoodleBullet />
            <span>Content dumps with no finishable structure — or one rigid course you can&apos;t reshape.</span>
          </li>
          <li>
            <DoodleBullet />
            <span>Checkboxes without memory: nothing resurfaces, so yesterday&apos;s topics evaporate.</span>
          </li>
          <li>
            <DoodleBullet />
            <span>
              No clean split between day notes and rabbit holes — tangents either vanish or clutter
              the plan.
            </span>
          </li>
          <li>
            <DoodleBullet />
            <span>AI gated behind a vendor quota before you&apos;ve proven the loop works.</span>
          </li>
        </ul>
      </section>

      {/* 3. How it works */}
      <section
        id="how-it-works"
        className="landing-section landing-loop"
        aria-labelledby="landing-loop-title"
      >
        <span className="landing-stamp">The loop</span>
        <h2 id="landing-loop-title" className="landing-section-title">
          How a campaign runs
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <p className="landing-section-lead">Six steps. Skim the headlines — that&apos;s the loop.</p>
        <ol className="landing-loop-grid">
          {CAMPAIGN_STEPS.map((step, i) => (
            <motion.li
              key={step.n}
              className="landing-loop-step landing-doodle-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="landing-loop-step-inner">
                <DoodleCircledNumber n={step.n} />
                <h3 className="landing-loop-title">{step.title}</h3>
                <p className="landing-loop-copy">{step.copy}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* 4. Surfaces */}
      <section
        id="field-kit"
        className="landing-section landing-surfaces"
        aria-labelledby="landing-surfaces-title"
      >
        <span className="landing-stamp">Two notebooks</span>
        <h2 id="landing-surfaces-title" className="landing-section-title">
          Two notebooks. One home base.
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <p className="landing-section-lead landing-surfaces-callout">
          <strong>Day notes</strong> live inside a campaign day.{" "}
          <strong>Field Kit notes</strong> are for everything else — talks, tools, tips, and rabbit
          holes that don&apos;t belong to any single day. Same words, different jobs.
        </p>
        <div className="landing-surfaces-grid">
          <article className="landing-surface landing-surface-deck landing-doodle-card">
            <div className="landing-surface-inner">
              <span className="landing-surface-stamp">Deck</span>
              <h3 className="landing-surface-title">Campaign Deck</h3>
              <p className="landing-surface-copy">
                Your daily driver: active plan hero, Field Ops filters, and views — Console, Grid,
                Review, Weekly, Analytics.
              </p>
              <ul className="landing-surface-list">
                <li>Topic clears + day notes on each mission</li>
                <li>Review queue (spaced repetition)</li>
                <li>XP, streaks, On This Day</li>
              </ul>
              {hasCampaign && (
                <button type="button" className="landing-surface-cta" onClick={onGoDashboard}>
                  Open dashboard
                </button>
              )}
            </div>
          </article>
          <article className="landing-surface landing-surface-kit landing-doodle-card">
            <div className="landing-surface-inner">
              <span className="landing-surface-stamp">Kit</span>
              <h3 className="landing-surface-title">Field Kit</h3>
              <p className="landing-surface-copy">
                Independent of any campaign. Always one click away — even before you start a plan.
              </p>
              <ul className="landing-surface-list">
                <li>
                  <strong>Notes</strong> — date-keyed slips, Chrono filters, tags (talk / paper /
                  tool / tip / course / other)
                </li>
                <li>
                  <strong>Bookmarks</strong> — YouTube, Vimeo, articles, repos, docs
                </li>
                <li>
                  <strong>Lens</strong> — search across Notes and Bookmarks
                </li>
              </ul>
              {onOpenKit && (
                <button type="button" className="landing-surface-cta" onClick={openFieldKit}>
                  Open Field Kit
                </button>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* 5. AI */}
      <section
        id="ai"
        className="landing-section landing-ai"
        aria-labelledby="landing-ai-title"
      >
        <span className="landing-stamp">AI, your way</span>
        <h2 id="landing-ai-title" className="landing-section-title">
          Bring your own key. Keep the loop free.
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <div className="landing-ai-grid">
          <div className="landing-ai-card landing-ai-card-main">
            <h3 className="landing-ai-card-title">Recruit · bring your own key (live)</h3>
            <p className="landing-ai-card-copy">
              Add your own AI key in Settings. Quiz, study notes, LinkedIn drafts, plan
              generation, and Field Kit polish run on <em>your</em> credits — no vendor lock-in, no
              quota wall on day one.
            </p>
            <ul className="landing-ai-list">
              <li>Key stays in memory by default (cleared when the tab closes)</li>
              <li>Optional “remember on this device” if you want persistence</li>
              <li>Without a key, the full campaign loop still works — AI panels degrade gracefully</li>
            </ul>
          </div>
          <div className="landing-ai-card">
            <h3 className="landing-ai-card-title">Managed AI · live</h3>
            <p className="landing-ai-card-copy">
              Operator and Architect include managed AI (no key required) with monthly quotas.
              Paid tiers keep bring-your-own-key too — managed AI is an option, not a replacement.
            </p>
            <button type="button" className="landing-surface-cta landing-ai-link" onClick={() => scrollToId("pricing")}>
              See plans
            </button>
          </div>
        </div>
      </section>

      {/* 6. Pricing */}
      <section
        id="pricing"
        className="landing-section landing-pricing"
        aria-labelledby="landing-pricing-title"
      >
        <span className="landing-stamp">Pricing</span>
        <h2 id="landing-pricing-title" className="landing-section-title">
          Start free with an account. Upgrade anytime with Stripe.
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <p className="landing-section-lead">
          Tier names match XP ranks (Recruit / Operator / Architect). Paid plans check out monthly
          via Stripe — manage invoices and cancel anytime in the billing portal. An account is
          required to run campaigns and Field Kit.
        </p>

        <div className="landing-pricing-grid">
          {TIER_ORDER.map((id) => {
            const tier = SUBSCRIPTION_TIERS[id];
            const isFree = tier.priceMonthlyUsd === 0;
            return (
              <article
                key={id}
                className={classNames(
                  "landing-price-card",
                  `landing-price-card-${id}`,
                  isFree && "landing-price-card-free",
                  tier.comingSoon && "landing-price-card-soon",
                  "landing-doodle-card",
                )}
              >
                {isFree && <DoodleStar className="landing-price-star" />}
                {tier.comingSoon ? (
                  <span className="landing-price-badge">Coming soon</span>
                ) : (
                  <span className="landing-price-badge landing-price-badge-live">Live</span>
                )}
                <div className="landing-price-card-inner">
                  <h3 className="landing-price-rank">{tier.rankLabel}</h3>
                  <div className="landing-price-amount">
                    {isFree ? (
                      <>$0</>
                    ) : (
                      <>
                        <span className="landing-price-num">${tier.priceMonthlyUsd}</span>
                        <span className="landing-price-per">/mo</span>
                      </>
                    )}
                  </div>
                  <p className="landing-price-tagline">{tier.tagline}</p>
                  <ul className="landing-price-features">
                    {isFree ? (
                      <>
                        <li>Free account — full campaign loop</li>
                        <li>Console, XP, Review queue, Field Kit</li>
                        <li>Bring-your-own-key AI (unlimited on your credits)</li>
                        <li>Cloud sync · export / import</li>
                        <li>Multi-plan switcher, themes, badges</li>
                      </>
                    ) : id === "operator" ? (
                      <>
                        <li>Everything in Recruit</li>
                        <li>Managed AI — 3 plan gens + 150 actions / month</li>
                        <li>No key required for those quotas</li>
                        <li>Bring-your-own-key remains available</li>
                        <li>Stripe checkout · invoices · billing portal</li>
                      </>
                    ) : (
                      <>
                        <li>Everything in Operator</li>
                        <li>Managed AI — 5 plan gens + 400 actions / month</li>
                        <li>Highest managed allowance</li>
                        <li>Bring-your-own-key remains available</li>
                        <li>Stripe checkout · invoices · billing portal</li>
                      </>
                    )}
                  </ul>
                  {isFree ? (
                    <button type="button" className="landing-cta landing-price-cta" onClick={startAccount}>
                      Create free account
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="landing-surface-cta landing-price-cta"
                      onClick={onOpenPricing}
                    >
                      {`Get ${tier.rankLabel}`}
                    </button>
                  )}
                  {isFree && (
                    <p className="landing-price-fine">Free forever on Recruit · no card for signup</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="landing-pricing-note">
          Prefer the in-app panel?{" "}
          <button type="button" className="landing-text-btn" onClick={onOpenPricing}>
            Open Plans
          </button>
          . All paid plans are billed monthly.
        </p>
      </section>

      {/* 7. Trust */}
      <section
        id="trust"
        className="landing-section landing-trust"
        aria-labelledby="landing-trust-title"
      >
        <span className="landing-stamp">The fine print</span>
        <h2 id="landing-trust-title" className="landing-section-title">
          Your data, spelled out
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <div className="landing-trust-grid">
          <article className="landing-trust-card landing-doodle-card">
            <h3>Account required</h3>
            <p>
              Sign up to run campaigns and Field Kit. Your plans, progress, notes, review state,
              learned slips, and bookmarks belong to your account.
            </p>
          </article>
          <article className="landing-trust-card landing-doodle-card">
            <h3>Cloud sync</h3>
            <p>
              Signed-in sessions sync the full snapshot across devices — so a long campaign can
              follow you from laptop to phone without starting over.
            </p>
          </article>
          <article className="landing-trust-card landing-doodle-card">
            <h3>Export · import</h3>
            <p>
              Export markdown notes, a full backup, or a plan-only share file. Import supports{" "}
              <strong>merge</strong> or <strong>replace</strong>. Exports never include your AI
              keys.
            </p>
          </article>
        </div>
      </section>

      {/* 8. Audience */}
      <section className="landing-section landing-audience" aria-labelledby="landing-audience-title">
        <span className="landing-stamp">Who it&apos;s for</span>
        <h2 id="landing-audience-title" className="landing-section-title">
          Who it&apos;s for
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <div className="landing-audience-grid">
          <div className="landing-audience-for">
            <h3 className="landing-audience-label">For</h3>
            <ul>
              <li>
                <DoodleBullet />
                <span>
                  Anyone running a serious self-study arc — psychology, economics, history,
                  languages, arts, sciences, trades, tech, or something you invent yourself
                </span>
              </li>
              <li>
                <DoodleBullet />
                <span>People who want structure + recall + a place for messy off-plan learning</span>
              </li>
            </ul>
          </div>
          <div className="landing-audience-not">
            <h3 className="landing-audience-label">Not for</h3>
            <ul>
              <li>
                <DoodleBullet className="landing-li-bullet-not" />
                <span>Not a Coursera-style course platform — you build (or generate) the curriculum</span>
              </li>
              <li>
                <DoodleBullet className="landing-li-bullet-not" />
                <span>Not a Notion template</span>
              </li>
              <li>
                <DoodleBullet className="landing-li-bullet-not" />
                <span>Not a generic habit tracker</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Plan picker (conversion) */}
      {(started || hasCampaign) && (
        <section className="landing-picker" ref={pickerRef} id="start">
          <div className="landing-picker-head">
            <h2 className="landing-picker-title">
              {hasCampaign ? "Add a campaign" : "Start your first campaign"}
            </h2>
            <p className="landing-picker-lead">
              Start with an example — psychology &amp; decision science, a year of systems depth, or an AI
              sprint — or build a custom plan for any subject.
            </p>
          </div>
          <div className="landing-picker-grid">
            {(examples || []).map((p, i) => (
              <article
                key={p.id}
                className={classNames("landing-plan", i % 2 === 0 ? "landing-plan-a" : "landing-plan-b")}
              >
                <div className="landing-plan-meta">{p.totalDays} days · example</div>
                <h3 className="landing-plan-name">{p.name}</h3>
                <p className="landing-plan-sub">{p.subtitle}</p>
                {p.blurb && <p className="landing-plan-blurb">{p.blurb}</p>}
                <button type="button" className="landing-plan-btn" onClick={() => onAddExample(p.id)}>
                  Add plan
                </button>
              </article>
            ))}
          </div>
          <div className="landing-picker-or">
            <span>or</span>
          </div>
          <button type="button" className="landing-cta-ghost landing-picker-custom" onClick={buildCustom}>
            Build a custom plan
          </button>
        </section>
      )}

      {/* 10. Final CTA */}
      {!hasCampaign && (
        <section className="landing-band" aria-labelledby="landing-final-title">
          <DoodleArrow className="landing-band-arrow" direction="down" />
          <div className="landing-band-copy">
            <h2 id="landing-final-title" className="landing-band-title">
              Run the campaign. Keep the rabbit holes.
            </h2>
            <p className="landing-band-lead">
              Create a free account — then pick a plan and start day one.
            </p>
          </div>
          <button type="button" className="landing-cta landing-cta-band" onClick={startAccount}>
            Create free account
          </button>
        </section>
      )}

      {/* 11. Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span>REFRAINLY</span>
          <span className="landing-footer-dot" aria-hidden="true" />
          <span>Progress saves automatically</span>
        </div>
        <nav className="landing-footer-nav" aria-label="Footer">
          <button type="button" className="landing-footer-link" onClick={() => scrollToId("pricing")}>
            Pricing
          </button>
          {onOpenKit && (
            <button type="button" className="landing-footer-link" onClick={openFieldKit}>
              Field Kit
            </button>
          )}
          <button type="button" className="landing-footer-link" onClick={onOpenAccount}>
            {accountLabel ? "Account" : "Sign in"}
          </button>
          <a className="landing-footer-link" href="/privacy">
            Privacy
          </a>
          <a className="landing-footer-link" href="/terms">
            Terms
          </a>
        </nav>
        <p className="landing-footer-legal">
          Paid plans checkout via Stripe. See Privacy and Terms for accounts, data, and billing.
        </p>
      </footer>
    </div>
  );
}
```

Note on the `landing-audience` section: the `<span className="landing-stamp">` and the `<h2>` now show the same text ("Who it's for") since the original stamp ("Fit") had no independent meaning worth preserving — this is intentional, not a mistake to fix.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint features/landing/HomeView.tsx`. Expected: no errors — in particular, confirm there is no remaining `TiltCard` or `useHeroTilt` import/usage anywhere in the file (`grep -n "TiltCard\|useHeroTilt" features/landing/HomeView.tsx` should return nothing).

Run: `npm run dev`, open `/`. Walk both states (no campaign / has campaign, via whatever local fixture or query param the app uses) and confirm: no "OPERATION MINDFIELD" / "BRIEFING" / "Field Ops" / "mission" text remains anywhere on the page; loop steps show circled numerals; problem/audience lists show doodle bullet marks; pricing free-tier card shows a star accent; section headings show a hand-drawn underline that draws in on scroll; hero board and slip notes render with no pointer-tracking (mouse movement over the hero no longer tilts anything); hover over a loop-step/surface/price/trust card lifts it slightly with no rotation glitch.

- [ ] **Step 3: Commit**

```bash
git add features/landing/HomeView.tsx
git commit -m "Rewrite homepage copy and structure for the doodle redesign"
```

---

## Task 5: Cleanup — remove dead 3D-tilt files, verify, QA pass

**Files:**
- Delete: `features/landing/TiltCard.tsx`
- Delete: `features/landing/use3d.ts`

**Interfaces:**
- Consumes: nothing (by this point Task 4 has already removed every import of these two files — this task only removes the now-dead files themselves).

- [ ] **Step 1: Confirm nothing still references the deleted files**

Run: `grep -rn "TiltCard\|use3d\|useHeroTilt\|useTilt3D" --include="*.tsx" --include="*.ts" features app | grep -v "features/landing/TiltCard.tsx\|features/landing/use3d.ts"`
Expected: no output (no remaining references outside the two files being deleted).

- [ ] **Step 2: Delete the files**

```bash
git rm features/landing/TiltCard.tsx features/landing/use3d.ts
```

- [ ] **Step 3: Full verification**

Run, in order:
```bash
npx tsc --noEmit
npx eslint features/landing app/layout.tsx
npm run build
```
Expected: all three pass with no errors. (Do not run whole-repo `npx eslint .` — the repo baseline already has 22 pre-existing errors/warnings outside this plan's scope; see Global Constraints.)

Run: `grep -rn "OPERATION MINDFIELD\|BRIEFING\|Field Ops\b" features/landing/HomeView.tsx app/dualtrack.css`
Expected: no output (all tactical framing removed from the homepage; note this grep intentionally does not scan `app/layout.tsx`, since the metadata `title`/`description` tactical wording is a documented out-of-scope item per Global Constraints).

- [ ] **Step 4: Manual browser QA against the spec checklist**

Run `npm run dev`, open `/`, and confirm each item from the spec's QA checklist (`docs/superpowers/specs/2026-07-30-doodle-homepage-redesign-design.md`):
- All nav/CTA callbacks still fire (`onAddExample`, `onOpenBuilder`, `onOpenAccount`, `onRequireAuth`, `onStartWithAccount`, `onGoDashboard`, `onOpenPricing`, `onOpenKit`) — click through each entry point.
- Toggle OS/browser "reduce motion" and confirm: hero slip notes stop floating, loop/surface/price/trust cards stop lifting on hover, section underlines appear instantly instead of drawing in.
- Spot-check contrast in devtools: primary CTA (navy bg/white text), nav pills (navy border/text on white), "Live" pricing badge (dark green bg/white text) — all should read comfortably.
- Scroll the full page top to bottom: hero, stats (if signed in with a campaign), problem, how-it-works, surfaces, AI, pricing, trust, audience, picker, final CTA, footer — confirm doodle styling (rounded shapes, soft shadows, hand-drawn accents) throughout, no leftover hard-edged blueprint styling anywhere.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove pointer-tracked 3D tilt files, homepage redesign complete"
```

---

## Deviations from the spec (flagged, not silently dropped)

- **Card borders:** the spec called for "doubled hand-drawn border via offset box-shadow." Task 3 instead uses a single border + soft blurred drop-shadow + slight per-card rotation. A literal double-stroke offset border adds real CSS complexity across ~6 card types for a marginal visual gain over what rotation + soft shadow already delivers; if the single-border look reads too flat once built, the double-stroke technique can be layered on in a follow-up.
- **Connecting arrows between loop steps:** the spec's Loop steps component rule called for "a small connecting doodle arrow between steps at wide viewports." This is cut from Task 4. The loop grid reflows from 3 columns to 1 column at 900px (see the existing `@media (max-width: 900px)` rule), so a connector would need different placement logic per breakpoint and per grid row-position (items 3 and 6 are row-ends with no next-sibling to point at) — real fragility for a purely decorative flourish. `DoodleCircledNumber`, card tilt, and hover-lift already carry the loop section's doodle identity.

## Post-plan follow-ups (not in scope, flag to user)

- `app/layout.tsx` `metadata.title` / `metadata.description` still read "Refrainly | Field Ops Learning Campaigns" / mention "Field Ops learning console" — the spec scoped this plan to `HomeView.tsx` + its CSS only; updating SEO metadata copy is a natural follow-up but was deliberately not bundled in here.
