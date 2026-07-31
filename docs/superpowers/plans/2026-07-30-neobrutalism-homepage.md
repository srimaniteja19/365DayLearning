# Neobrutalism Homepage + Marketing Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the signed-out Refrainly homepage into a neobrutalist poster stack and restyle Account + Pricing modals on the landing path to match, per `docs/superpowers/specs/2026-07-30-neobrutalism-homepage-design.md`.

**Architecture:** Keep the marketing shell (`landing-root` in `DualTrackConsole`) and all HomeView props/callbacks. Repoint `LANDING_THEME` + `.landing` / `.landing-root` CSS tokens to neo yellow/violet; rewrite `HomeView.tsx` section structure/copy; scope Account/Pricing modal overrides under `.landing-root` only. Dashboard themes and signed-in modal look stay untouched. Inter is loaded for the marketing path only and is not added to `FONT_PACKS`.

**Tech Stack:** Next.js 16 (`next/font/google`), React 19, `motion/react` (existing), Vitest, plain CSS in `app/dualtrack.css`.

## Global Constraints

- Neo tokens (verbatim): primary `#FDC800`, secondary `#432DD7`, success `#16A34A`, warning `#D97706`, danger `#DC2626`, surface `#FBFBF9`, text/ink `#1C293C`.
- CTA text on yellow must be `#1C293C` — never white-on-yellow.
- Borders `2.5px–3px solid #1C293C`; hard shadows `4px 4px 0 #1C293C` (hover `6px 6px 0` + translate; active `2px 2px 0`); `border-radius: 0`.
- Type: Inter body (`--font-inter`), Space Grotesk display for brand/hero titles (`--font-space`), JetBrains Mono for stamps/prices (`--font-jetbrains`).
- Do not add Inter to `FONT_PACKS` / dashboard font picker (`themes.test.ts` “avoids Inter” must keep passing).
- No doodle SVG imports in `HomeView.tsx`. Leave `features/landing/doodle-assets.tsx` on disk for dashboard Phase work unless unused elsewhere — do not delete in this plan unless grep shows zero consumers after landing rewrite.
- Out of scope: dashboard themes, Settings/Builder/Export/Quiz/Badges modals, Stripe/tier data, privacy/terms pages.
- Auth gates, plan picker behavior, `onOpenAccount` / `onOpenPricing` / `startAccount` / `onAddExample` / `onOpenKit` handlers must keep working.
- Verify with file-scoped lint + `npm test` + `npm run typecheck` for touched areas; do not chase unrelated repo-wide eslint debt.

## File map

| File | Responsibility |
|------|----------------|
| `app/layout.tsx` | Load Inter → `--font-inter` |
| `theme/themes.ts` | Repoint `LANDING_THEME` to neo palette |
| `theme/themes.test.ts` | Assert `LANDING_THEME` neo values + `onAccent` |
| `components/dualtrack/DualTrackConsole.tsx` | Marketing shell font CSS vars (Inter/Space/JetBrains) |
| `features/landing/HomeView.tsx` | Poster-stack markup + copy rewrite |
| `app/dualtrack.css` | `.landing*` neo skin + `.landing-root` modal overrides + responsive |

---

### Task 1: `LANDING_THEME` neo tokens + tests

**Files:**
- Modify: `theme/themes.ts` (`LANDING_THEME`)
- Modify: `theme/themes.test.ts`

**Interfaces:**
- Consumes: existing `ThemeDef` / `FONT_STACKS` / `themeVars`
- Produces: `LANDING_THEME` with neo colors; `onAccent: "#1C293C"` for yellow CTAs

- [ ] **Step 1: Write the failing test**

Add to `theme/themes.test.ts`:

```ts
import { LANDING_THEME } from "@/theme/themes";

describe("LANDING_THEME (marketing neo)", () => {
  it("uses neobrutalism yellow / violet / surface / ink", () => {
    expect(LANDING_THEME.mode).toBe("light");
    expect(LANDING_THEME.c.bg).toBe("#FBFBF9");
    expect(LANDING_THEME.c.panel).toBe("#FBFBF9");
    expect(LANDING_THEME.c.text).toBe("#1C293C");
    expect(LANDING_THEME.accents.main).toBe("#FDC800");
    expect(LANDING_THEME.accents.sprint).toBe("#432DD7");
    expect(LANDING_THEME.c.onAccent).toBe("#1C293C");
    expect(LANDING_THEME.c.ok).toBe("#16A34A");
    expect(LANDING_THEME.c.warn).toBe("#D97706");
    expect(LANDING_THEME.c.err).toBe("#DC2626");
    expect(LANDING_THEME.radius.card).toBe("0px");
    expect(LANDING_THEME.radius.ctl).toBe("0px");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run theme/themes.test.ts -t "LANDING_THEME"`
Expected: FAIL (still doodle paper/sky values)

- [ ] **Step 3: Update `LANDING_THEME`**

In `theme/themes.ts`, replace the doodle `LANDING_THEME` object with:

```ts
/**
 * Fixed public homepage skin — same for every visitor, ignores account theme.
 * Neobrutalism: yellow primary, violet secondary, flat surface, ink borders.
 */
export const LANDING_THEME: ThemeDef = {
  name: "Neo",
  mode: "light",
  palette: "light",
  effects: true,
  swatch: ["#FBFBF9", "#FDC800", "#432DD7"],
  accents: { main: "#FDC800", sprint: "#432DD7" },
  display: FONT_STACKS.grotesk,
  radius: { card: "0px", ctl: "0px", pill: "0px", bar: "0px" },
  grid: { color: "rgba(28,41,60,0.08)", size: "24px", scan: "0" },
  c: {
    bg: "#FBFBF9",
    panel: "#FBFBF9",
    panel2: "#F3F3EF",
    blur: "rgba(251,251,249,0.94)",
    text: "#1C293C",
    dim: "#3D4D63",
    faint: "#6B7A90",
    border: "rgba(28,41,60,0.85)",
    borderSoft: "rgba(28,41,60,0.2)",
    borderHover: "rgba(28,41,60,1)",
    track: "rgba(28,41,60,0.12)",
    onAccent: "#1C293C",
    onAccentSoft: "rgba(28,41,60,0.9)",
    ok: "#16A34A",
    warn: "#D97706",
    err: "#DC2626",
    info: "#432DD7",
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run theme/themes.test.ts`
Expected: PASS (including existing “avoids Inter” font pack test)

- [ ] **Step 5: Commit**

```bash
git add theme/themes.ts theme/themes.test.ts
git commit -m "feat(landing): point LANDING_THEME at neobrutalism tokens"
```

---

### Task 2: Load Inter + wire marketing shell fonts

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/dualtrack/DualTrackConsole.tsx` (landing-root style block ~1275–1287)

**Interfaces:**
- Produces: `--font-inter` on `<html>`; landing shell inline style sets `--sans` → Inter, `--display` → Space Grotesk, `--mono` → JetBrains
- Consumes: existing `themeVars(LANDING_THEME)`

- [ ] **Step 1: Add Inter in `app/layout.tsx`**

```ts
import {
  // ...existing imports...
  Inter,
} from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

// include inter.variable in the fontVars join array
```

- [ ] **Step 2: Override marketing shell fonts in `DualTrackConsole`**

Replace:

```ts
const homeFont = FONT_PACKS.archivo;
const homeStyle = { ...themeVars(homeTheme), ...fontVars(homeFont) };
```

with:

```ts
const homeStyle = {
  ...themeVars(homeTheme),
  "--sans": "var(--font-inter), sans-serif",
  "--display": "var(--font-space), sans-serif",
  "--mono": "var(--font-jetbrains), ui-monospace, monospace",
} as React.CSSProperties;
```

Remove unused `FONT_PACKS` / `fontVars` imports from this branch only if they become unused in the file (keep if still used for signed-in shell).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx components/dualtrack/DualTrackConsole.tsx
git commit -m "feat(landing): load Inter and wire neo marketing font stacks"
```

---

### Task 3: Landing CSS foundations (tokens + neo primitives)

**Files:**
- Modify: `app/dualtrack.css` (`.landing` token block ~4018+, `.landing-root`, display-font selector list, doodle-card helpers, button/card primitives)

**Interfaces:**
- Produces: `--landing-*` neo tokens; flat surface; hard-shadow button/card utilities; no notebook `::before` rules; display font → Space Grotesk; body → Inter; mono stamps → JetBrains

- [ ] **Step 1: Repoint `.landing` tokens**

Replace the doodle token block at the top of `.landing` with:

```css
.landing {
  --landing-ink: #1c293c;
  --landing-yellow: #fdc800;
  --landing-violet: #432dd7;
  --landing-surface: #fbfbf9;
  --landing-panel: #fbfbf9;
  --landing-muted: #3d4d63;
  --landing-on-yellow: #1c293c;
  --landing-on-violet: #fbfbf9;
  --landing-mint: #16a34a;
  --landing-flare: #d97706;
  --landing-danger: #dc2626;
  --landing-radius: 0;
  --landing-radius-sm: 0;
  --landing-gap: 48px;
  --landing-border: 2.5px solid var(--landing-ink);
  --landing-shadow: 4px 4px 0 var(--landing-ink);
  --landing-shadow-hover: 6px 6px 0 var(--landing-ink);
  --landing-shadow-active: 2px 2px 0 var(--landing-ink);
  position: relative;
  z-index: 2;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 28px 80px;
  font-family: var(--font-inter), sans-serif;
  color: var(--landing-ink);
  background: var(--landing-surface);
}
```

- [ ] **Step 2: Retarget display / mono selectors**

- Change the large “Doodle display font” selector list from `var(--font-delius)` to `var(--font-space)` for brand + hero titles + section titles.
- Set stamps, prices, badges, nav meta to `var(--font-jetbrains)`.
- Keep long body/lead/list copy on Inter (inherit from `.landing`).

- [ ] **Step 3: Flatten `.landing-root`**

```css
.landing-root {
  --bg: #fbfbf9 !important;
  --bg-panel: #fbfbf9 !important;
  --text: #1c293c !important;
  --text-dim: #3d4d63 !important;
  --accent-main: #fdc800 !important;
  --accent-sprint: #432dd7 !important;
  --accent: #fdc800 !important;
  --on-accent: #1c293c !important;
  --r-card: 0 !important;
  --r-ctl: 0 !important;
  --r-pill: 0 !important;
  background: #fbfbf9 !important;
  position: relative;
  isolation: isolate;
}
.landing-root::before,
.landing-root::after {
  content: none !important;
  display: none !important;
}
```

- [ ] **Step 4: Neo button + card primitives**

Update (or replace) `.landing-cta`, `.landing-cta-ghost`, `.landing-doodle-card` (rename usage later in JSX to `landing-neo-card` if cleaner):

```css
.landing-cta {
  background: var(--landing-yellow);
  color: var(--landing-on-yellow);
  border: var(--landing-border);
  border-radius: 0;
  box-shadow: var(--landing-shadow);
  font-family: var(--font-space), sans-serif;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  min-height: 48px;
  padding: 0 18px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.landing-cta:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--landing-shadow-hover);
}
.landing-cta:active {
  transform: translate(0, 0);
  box-shadow: var(--landing-shadow-active);
}
.landing-cta:focus-visible {
  outline: 3px solid var(--landing-ink);
  outline-offset: 2px;
}
.landing-cta-ghost {
  background: var(--landing-surface);
  color: var(--landing-violet);
  border: var(--landing-border);
  border-radius: 0;
  box-shadow: var(--landing-shadow);
  /* same hover/active/focus as .landing-cta */
}
.landing-neo-card {
  background: var(--landing-panel);
  border: var(--landing-border);
  border-radius: 0;
  box-shadow: var(--landing-shadow);
}
```

Remove soft radii, sticky-note rotations, pink highlighter decoration rules that conflict. Keep media-query structure; update color literals inside landing media queries to neo tokens where they hard-code doodle hexes.

- [ ] **Step 5: Visual smoke (dev)**

Run: `npm run dev` → open `/` signed out. Expect flat off-white page, yellow/violet accents beginning to show on existing markup (layout still old until Task 4).

- [ ] **Step 6: Commit**

```bash
git add app/dualtrack.css
git commit -m "style(landing): neo token foundations and hard-shadow primitives"
```

---

### Task 4: Rewrite `HomeView` poster stack

**Files:**
- Modify: `features/landing/HomeView.tsx`

**Interfaces:**
- Consumes: same props as today (`hasCampaign`, `summary`, `examples`, `onAddExample`, `onOpenBuilder`, `onOpenAccount`, `onRequireAuth`, `onStartWithAccount`, `onGoDashboard`, `onOpenPricing`, `onOpenKit`, `learnedCount`, `bookmarkCount`, `accountLabel`)
- Produces: new section DOM matching spec order; no imports from `@/features/landing/doodle-assets`

- [ ] **Step 1: Strip doodle imports + keep handlers**

Remove:

```ts
import {
  DoodleUnderline,
  DoodleArrow,
  DoodleStar,
  DoodleBullet,
  DoodleCircledNumber,
} from "@/features/landing/doodle-assets";
```

Keep `CAMPAIGN_STEPS`, `scrollToId`, auth helpers, and all prop wiring.

- [ ] **Step 2: Rebuild nav + hero**

Hero must be one composition:

```tsx
<section className="landing-hero" aria-labelledby="landing-hero-title">
  <div className="landing-hero-copy">
    <p className="landing-brand-hero">REFRAINLY</p>
    <h1 id="landing-hero-title" className="landing-hero-title">
      {/* clarity headline — unsigned vs returning variants */}
    </h1>
    <p className="landing-hero-lead">{/* one short sentence */}</p>
    <div className="landing-hero-actions">{/* primary + ghost */}</div>
  </div>
  <div className="landing-hero-viz" aria-hidden="true">
    {/* hard-bordered Next dispatch mock — day list + progress bar; no floating slip collage */}
  </div>
</section>
```

Rules: no subject chip row in hero; brand is hero-level; dominant viz is edge-to-edge panel.

- [ ] **Step 3: Add proof strip + “What it is” + loop + surfaces + AI**

- Proof: 4 `.landing-stat` neo tiles (sample values if `!hasCampaign`, real `summary` if campaign).
- What it is: 3 `.landing-neo-card` claim blocks + one “Not this” footnote (merge old audience).
- Loop: map `CAMPAIGN_STEPS` to numbered ink stamps (plain `<span className="landing-loop-num">`), class `landing-neo-card` instead of `landing-doodle-card`.
- Surfaces: Deck (yellow header bar) + Field Kit (violet header bar).
- AI: BYOK main + Managed side; keep pricing scroll / facts.

- [ ] **Step 4: Pricing, trust, picker, final band, footer**

- Pricing cards: `landing-neo-card`; free yellow wash; paid violet badge; no `DoodleStar`.
- Trust: 3 cards.
- Picker: restyle only; same `onAddExample` / `buildCustom`.
- Final band: full-width yellow slab CTA.
- Footer: unchanged links.

- [ ] **Step 5: Grep guard**

Run: `rg "doodle-assets|DoodleUnderline|DoodleBullet|landing-doodle" features/landing/HomeView.tsx`
Expected: no matches

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add features/landing/HomeView.tsx app/dualtrack.css
git commit -m "feat(landing): rewrite homepage as neobrutalism poster stack"
```

(Include any CSS section-layout tweaks needed for new class names in the same commit.)

---

### Task 5: Account + Pricing modal neo chrome on landing path

**Files:**
- Modify: `app/dualtrack.css` (add block after `.landing-root` or near modal-account/pricing)

**Interfaces:**
- Produces: `.landing-root .modal-account` / `.landing-root .modal-pricing` (and panel children) neo look
- Does not change signed-in dashboard modal appearance (no `landing-root` class there)

- [ ] **Step 1: Add scoped overrides**

```css
/* Marketing neo — Account / Pricing only when opened from landing-root */
.landing-root .modal-account,
.landing-root .modal-pricing {
  background: #fbfbf9;
  border: 2.5px solid #1c293c;
  box-shadow: 4px 4px 0 #1c293c;
  border-radius: 0;
  max-width: min(560px, 96vw);
}
.landing-root .modal-pricing {
  max-width: min(720px, 96vw);
}
.landing-root .modal-account .modal-title,
.landing-root .modal-pricing .modal-title {
  font-family: var(--font-space), sans-serif;
  color: #1c293c;
  text-transform: uppercase;
}
.landing-root .account-panel,
.landing-root .pricing-panel {
  --account-blue: #432dd7;
  --account-pink: #fdc800;
  --account-ink: #1c293c;
  --account-muted: #3d4d63;
  --account-paper: #fbfbf9;
  --account-panel: #fbfbf9;
  --account-on: #1c293c;
  --pricing-blue: #fdc800;
  --pricing-pink: #432dd7;
  --pricing-ink: #1c293c;
  --pricing-paper: #fbfbf9;
  --pricing-muted: #3d4d63;
  --pricing-panel: #fbfbf9;
  --pricing-on: #1c293c;
  font-family: var(--font-inter), sans-serif;
}
.landing-root .account-btn-primary,
.landing-root .pricing-card-btn-primary,
.landing-root .pricing-card-free .pricing-card-btn {
  background: #fdc800;
  color: #1c293c;
  border: 2.5px solid #1c293c;
  box-shadow: 4px 4px 0 #1c293c;
  border-radius: 0;
}
.landing-root .account-input,
.landing-root .pricing-card {
  border: 2.5px solid #1c293c;
  border-radius: 0;
  box-shadow: 4px 4px 0 rgba(28, 41, 60, 0.2);
}
```

Tune selectors to match real class names in `AccountPanel` / pricing panel (grep `account-btn`, `pricing-card-btn` and adjust).

- [ ] **Step 2: Manual verify**

Signed out: open Sign in + Pricing — neo chrome.  
Signed in (dashboard): open Account/Pricing — previous theme look unchanged.

- [ ] **Step 3: Commit**

```bash
git add app/dualtrack.css
git commit -m "style(landing): neo Account and Pricing modal chrome on marketing path"
```

---

### Task 6: Responsive polish + QA checklist

**Files:**
- Modify: `app/dualtrack.css` (landing `@media` blocks ~5614+, ~9077+, ~9260+)
- Touch up: `features/landing/HomeView.tsx` only if markup needs mobile wrappers

- [ ] **Step 1: Mobile layout rules**

Ensure ≤860px / ≤640px:

```css
@media (max-width: 860px) {
  .landing-hero {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .landing-hero-actions,
  .landing-band {
    flex-direction: column;
    align-items: stretch;
  }
  .landing-cta,
  .landing-cta-ghost { width: 100%; }
  .landing-pricing-grid,
  .landing-surfaces-grid,
  .landing-loop-grid { grid-template-columns: 1fr; }
}
```

Hero viz stacks under copy; no horizontal crush; modals keep full-bleed rules already under `.modal` mobile block.

- [ ] **Step 2: Run automated checks**

```bash
npx vitest run theme/themes.test.ts
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Manual QA (spec checklist)**

- [ ] First viewport brand test
- [ ] Hero = brand + one headline + one lead + CTA group + one dominant visual
- [ ] Yellow CTAs use ink text
- [ ] Landing Account/Pricing neo; dashboard modals unchanged when signed in
- [ ] Plan picker / auth / Stripe entry points still work
- [ ] No doodle SVG usage in `HomeView`
- [ ] 375 / 768 / 1024 layouts OK
- [ ] Focus-visible + `prefers-reduced-motion` OK
- [ ] Dashboard theme switcher unaffected

- [ ] **Step 4: Final commit**

```bash
git add app/dualtrack.css features/landing/HomeView.tsx
git commit -m "fix(landing): responsive neo poster stack and QA polish"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Neo color tokens | 1, 3 |
| Hybrid type (Inter + Space + JetBrains) | 2, 3 |
| Poster stack IA rewrite | 4 |
| Remove doodle SVGs from HomeView | 4 |
| Account/Pricing landing chrome | 5 |
| Dashboard untouched | 1–5 (scoped) |
| A11y yellow/ink, focus, reduced motion | 3, 4, 6 |
| Mobile / no crushed forms | 5, 6 |
| Auth/pricing handlers preserved | 4 |

No TBD placeholders. `LANDING_THEME.onAccent` consistently `#1C293C` across Task 1 and CSS.
