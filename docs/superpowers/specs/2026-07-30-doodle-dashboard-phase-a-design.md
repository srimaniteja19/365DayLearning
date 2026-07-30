# Doodle dashboard redesign — Phase A: Foundation

## Context and goals

The homepage (`features/landing/HomeView.tsx`) was already redesigned to a light "doodle" hand-drawn style, driven by a fixed `LANDING_THEME` object and bespoke `.landing-*` CSS. The rest of the application — the signed-in dashboard/console (`components/dualtrack/DualTrackConsole.tsx`, pages `dashboard`/`kit`, and their modals: Account, Pricing, Settings, Builder, Export, Badges, Quiz) — still uses the pre-existing "field-manual" brutalist visual language (hard 0px-radius corners, hard offset box-shadows) across a *user-selectable* 10-theme system (`theme/themes.ts`), and has not been touched.

Goal for the full effort (multi-phase, only Phase A is speced/planned/implemented now): bring the same doodle hand-drawn identity to the dashboard, as a new **dark** palette (distinct from the homepage's light palette), matching the user-supplied reference screenshots (near-black warm background, cream/blush accent, hand-drawn white card outlines).

**Phase roadmap** (Phase A only is in scope for this spec; B–E are each their own future brainstorm → spec → plan cycle):
- **Phase A — Foundation** (this spec): new dark "Doodle" theme registered in the existing theme system as the new default; scoped heading-font treatment; a shared, dashboard-wide doodle SVG/CSS toolkit for later phases to consume.
- **Phase B — Primary surfaces**: top bar/nav, view tabs, day tiles, primary/secondary buttons.
- **Phase C — Secondary surfaces**: Field Kit, badges, remaining console cards.
- **Phase D — Modals**: Account, Pricing, Settings, Builder, Export, Quiz.
- **Phase E — Sweep**: stragglers, skeletons, responsive breakpoints, final QA.

Key finding driving this phasing: the dashboard's `--r-card`/`--r-ctl`/`--r-pill`/`--r-bar` radius tokens exist in every `ThemeDef` but are almost unused (9 references app-wide); the actual card/button shapes are hardcoded per-selector (`border-radius: 0` appears 108 times, hard offset box-shadows 238 times, outside `.landing-*`). A theme-only change recolors everything for free (1,112 existing `var(--bg)`/`var(--text)`/`var(--accent-*)` etc. references) but cannot reshape anything — reshaping is unavoidably a large per-selector effort, hence Phases B–E.

## Design tokens and foundations — Phase A deliverable

**New `ThemeDef`, key `"doodle"`, in `theme/themes.ts`:**

```ts
doodle: {
  name: "Doodle",
  mode: "dark",
  palette: "dark",
  effects: true,
  swatch: ["#14100D", "#E3C4AE", "#D97757"],
  accents: { main: "#E3C4AE", sprint: "#D97757" },
  display: FONT_STACKS.grotesk, // unchanged mechanism; see Font section below for why
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

- `onAccent: "#2B2118"` (dark brown text on the light blush `accents.main` background) is an explicit AA choice — dark-on-light passes comfortably; verify computed contrast in QA regardless.
- `border`/`borderSoft`/`borderHover` are unusually opaque/bright (vs. other themes' subtler borders) — this is deliberate: the reference screenshots' signature look is a **bright, near-white hand-drawn stroke** around cards on a near-black fill, not a subtle border. Later phases building card outlines should lean on `var(--border)` at full opacity for the visible stroke.
- `radius.card`/`radius.ctl` values are defined now for correctness and for the handful of already-wired consumers, but most of the visual "roundness" work happens in Phases B–E per-selector, not automatically from this token.

**Wiring** (`theme/themes.ts` + `lib/types.ts`):
- Add `"doodle"` to the `ThemeKey` union type (`lib/types.ts`).
- Add the `doodle` entry to the `THEMES` record.
- Add `"doodle"` to `THEME_ORDER` (so it's visible/selectable in the existing theme picker UI, not just a silent default).
- Change `DEFAULT_THEME_KEY` from `"signal"` to `"doodle"`.
- No change needed to `resolveThemeKey`, snapshot loading, or export/import — `themeKey` is per-user-persisted (`snap.meta?.themeKey`), so this only changes what *new*/never-chosen users see; anyone with an existing saved `themeKey` is unaffected.

## Font — scoped heading treatment, not a new FONT_PACKS entry

`FONT_PACKS` (`theme/fonts.ts`) applies one font family uniformly to sans+display+mono for the *entire* UI — buttons, table cells, form inputs, stat numbers. Delius Swash Caps (or a similarly decorative face) as a full `FontPack` would put dense console UI (numbers, inputs, labels) in a handwritten face, hurting legibility. Per the same accessibility-first reasoning used for the homepage:

- `DEFAULT_FONT_KEY` stays unchanged (`"space"`) — no new font pack is added in Phase A.
- Instead, add a small, explicit CSS selector list (living in `app/dualtrack.css`, scoped to dashboard/console page-title and section-header classes only — enumerate the actual selectors in the implementation plan once identified) that sets `font-family: var(--font-delius), cursive;` on top of whatever font pack is active, mirroring the homepage's `.landing-brand-text, .landing-hero-title, ...` pattern.
- `Delius_Swash_Caps` is already loaded globally via `app/layout.tsx` (added in the homepage redesign) — no new font-loading work needed, just new consumers of the existing `--font-delius` CSS variable.

## Shared doodle toolkit — Phase A deliverable

To avoid re-deriving hover/shadow/radius CSS in every later phase (and to avoid touching already-shipped, reviewed homepage code), Phase A creates **new, parallel, non-landing-prefixed** artifacts rather than modifying or importing from `features/landing/doodle-assets.tsx`:

- New file `components/doodle/doodle-assets.tsx` — the same five components as the landing version (`DoodleUnderline`, `DoodleArrow`, `DoodleStar`, `DoodleBullet`, `DoodleCircledNumber`), generalized (no landing-specific naming), for Phases B–E to import. This duplicates ~100 lines from the landing version rather than sharing an import — a deliberate small tradeoff to avoid a cross-cutting refactor of already-shipped, already-reviewed code as part of "foundation" work.
- New shared CSS utility classes in `app/dualtrack.css` (outside the `.landing-*` block, near the existing shared button/card primitives): `.doodle-card` (rounded corners via `var(--r-card)`, soft shadow, hover-lift transition, `prefers-reduced-motion` guard — same mechanism as `.landing-doodle-card` but independent, not landing-scoped) and `.doodle-pill` (fully rounded, for buttons/badges/tags). Later phases apply these as additional classNames on existing dashboard selectors rather than writing bespoke shape CSS per component.

## Accessibility requirements

- Verify computed contrast for: `var(--text)` on `var(--bg)`, `var(--onAccent)` on `var(--accent-main)`, `var(--ok)`/`var(--warn)`/`var(--err)` against whatever background each is actually rendered on (status dots, badges) — meet WCAG 2.2 AA for the text size involved. Adjust any failing value before this phase is considered done (same discipline as the homepage's token pass).
- The dot-grid background effect (`grid.color`/`scan`) must stay subtle enough not to reduce text legibility — verify visually, not just by the token value.
- No behavior change: this phase only touches `theme/themes.ts`, `lib/types.ts`, new toolkit files, and a small scoped heading-font CSS addition. No component logic, props, or callbacks change.

## Content and tone standards

N/A for this phase — no copy changes. (Copy/IA work, if any, belongs to Phases B–E when actual components are touched.)

## Anti-patterns / out of scope for Phase A

- No reshaping of any existing dashboard selector (`border-radius`, box-shadow) — that is Phases B–E's job. Phase A defines the tokens and shared toolkit only; it does not apply them to existing UI beyond the scoped heading-font selectors.
- No changes to `features/landing/*` (homepage) — already shipped, out of scope, do not touch.
- No new `FONT_PACKS` entry (see Font section above).
- No changes to `THEMES` entries other than adding the new `doodle` key — do not alter the other 9 themes.
- No database/snapshot schema changes — `ThemeKey` gains a new valid string value, which is forward/backward compatible with existing persisted snapshots (unrecognized keys already fall back via `resolveThemeKey`).

## QA checklist

- [ ] `"doodle"` theme selectable in the existing theme picker UI, with correct swatch/name.
- [ ] A user with no previously-saved `themeKey` sees the Doodle theme by default.
- [ ] A user with an existing saved `themeKey` (any of the other 9) is unaffected — their dashboard renders unchanged.
- [ ] Dashboard background, panel, text, and accent colors visibly match the new dark doodle palette when the Doodle theme is active (colors only — shapes are expected to remain hard-edged until Phase B+, this is not a bug in this phase).
- [ ] Contrast-checked: text/bg, onAccent/accent-main, ok/warn/err against their actual rendered backgrounds.
- [ ] Scoped heading-font selectors render in Delius Swash Caps; body/table/input text is unaffected.
- [ ] `components/doodle/doodle-assets.tsx` and the new `.doodle-card`/`.doodle-pill` CSS utilities exist and are usable (not yet consumed by any component — that's later phases) — verify via a throwaway smoke usage removed before commit, or via `tsc`/lint only if no visual smoke test is convenient.
- [ ] `tsc --noEmit`, scoped `eslint`, and `next build` all pass.
- [ ] Existing `npm test` suite (162 tests) still passes — confirms no snapshot/export-import regression from the `ThemeKey` union change.
