# Doodle homepage redesign

## Context and goals

The homepage (`features/landing/HomeView.tsx` + `.landing*` rules in `app/dualtrack.css`) currently uses a "Field Ops / military briefing" identity: tactical copy (OPERATION MINDFIELD, BRIEFING watermark, mission language), a blueprint grid background, hard 0px-radius cards, and pointer-tracked 3D tilt/parallax effects (`features/landing/use3d.ts`, `features/landing/TiltCard.tsx`).

Goal: redesign the entire homepage to the "doodle" design system defined in `.agents/skills/design-system/SKILL.md` — a playful, hand-drawn sketch aesthetic — while keeping the same page structure, sections, and functional behavior (all existing props/callbacks/CTAs continue to work identically).

This is a visual + copy skin change, not an IA or functionality change.

## Design tokens and foundations

**Typography**
- Display/heading font: Delius Swash Caps — all headings, nav brand, section stamps/kickers, CTA button labels.
- Body font: keep existing Archivo (`var(--font-archivo)`) for paragraph copy, list items, fine print — chosen over Delius Swash Caps for long-form text per the doodle skill's own accessibility priority ("prioritize accessibility and clarity over novelty").
- Numerals (day/step counters, stat values, price digits): JetBrains Mono.
- Scale: 14/16/18/24/32/40 per skill tokens.

**Color**
- `--doodle-primary: #49B6E5` (sky blue — primary actions, accents)
- `--doodle-secondary: #263D5B` (navy — headings, ink)
- `--doodle-success: #16A34A` (Live badges)
- `--doodle-warning: #D97706` (Coming soon badges)
- `--doodle-danger: #DC2626` (reserved — error states only)
- `--doodle-surface: #FFFFFF`
- `--doodle-text: #111827`
- One added warm "highlighter" accent (coral/pink, exact hex chosen during implementation) for hand-drawn underline/squiggle emphasis marks only — not in the base skill token list, called out as a deliberate small addition.

**Background**
- Warm paper white base, replacing the blueprint grid.
- Faint notebook rule-line texture (thin horizontal lines, no red margin), replacing the graph-paper grid + "BRIEFING" watermark (`.landing-root::before`, `.landing-root::after` reworked or removed).

**Shape language**
- Cards: soft-rounded corners, doubled hand-drawn border via offset box-shadow (no new dependency), slight per-card rotation ("sticky note" feel) — extends the rotation already used for the hero's Field Kit slip notes to loop-step cards, surface cards, and pricing cards.
- Spacing scale: 4/8/12/16/24/32 per skill tokens, applied to existing section rhythm.

## Component-level rules

**Nav** — brand mark + text in doodle font/colors; nav links keep current states (default/hover/focus-visible) restyled with doodle palette, no behavior change.

**Hero**
- Delete pointer-tracked tilt/parallax: `useHeroTilt` and `useTilt3D` (`features/landing/use3d.ts`) are removed; `TiltCard` (`features/landing/TiltCard.tsx`) is rewritten as a non-pointer-tracking `DoodleCard` — hover-only rotate/lift via CSS transition, same `prefers-reduced-motion` fallback contract (flat div, no animation) as today.
- Hero mockup board (currently "OPERATION MINDFIELD" / day progress / live pill) restyled as a doodled daily-tracker sketch card; same data (day count, progress %, day list with done/active states), journal framing instead of ops-board framing.
- Floating Field Kit slip notes keep their existing idle float/rotate loop (already doodle-appropriate) but restyled as sketchy sticky notes.
- Section headings across the page get a hand-drawn SVG underline that draws in on scroll (`stroke-dasharray` + `whileInView`), reusing the existing framer-motion viewport-trigger pattern from the loop-step cards.

**Problem / Trust / Audience lists** — plain `<li>` bullets replaced with small doodle arrow/star SVG bullet marks.

**Loop steps (6 cards)** — circled hand-drawn numerals (replacing plain "01"–"06"), sticky-note rotation via `DoodleCard`, small connecting doodle arrow between steps at wide viewports.

**Surfaces / AI cards** — restyled with doodle card shape + palette; content and CTAs unchanged.

**Pricing cards** — "Live" badge restyled as a hand-drawn circled/underlined stamp in success green; "Coming soon" badge same treatment in warning amber; free-tier card gets a small doodle star-burst accent. Tier data, features, and CTA behavior unchanged.

**Final CTA band** — hand-drawn arrow doodle pointing at the CTA button.

**Footer** — restyled with doodle palette/font, same links and structure.

## Copy changes

Tone shifts from tactical/military to a warm, first-person "hand-kept learning journal" voice. Same information and CTA intent, reworded:
- Remove "OPERATION MINDFIELD", "BRIEFING" watermark, "mission" framing.
- Section stamps/kickers reworded in plain language (e.g. "The idea", "How it works", "Your two notebooks", "AI, your way", "Pricing", "The fine print", "Who this is for") instead of "Problem / Mechanism / Surfaces / AI / Pricing / Trust / Fit".
- Hero headline/lead rewritten to the same meaning without ops framing.
- "Campaign" is kept as core product vocabulary (not inherently military). Overtly tactical words (mission, ops, briefing, deploy, BRIEFING watermark) are removed.
- Exact copy strings are finalized during implementation; this spec fixes the direction and constraints, not final wording.

## Accessibility requirements

- Maintain WCAG 2.2 AA contrast: verify `#263D5B` on white, and white text on `#49B6E5` buttons, meet AA for their respective text sizes; adjust shades if a combination fails.
- All interactive elements keep visible focus-visible states (currently present on nav links, CTAs, plan buttons) — restyled, not removed.
- All new/replacement motion (card hover, scroll-in underlines, idle slip float) respects `prefers-reduced-motion`, matching the existing fallback contract in `use3d.ts`/`TiltCard.tsx`.
- Decorative doodle SVGs (arrows, stars, underlines) are `aria-hidden="true"`; no information conveyed only through decoration.

## Content and tone standards

- Headings/labels: confident, concise, plain language — no jargon substitution for jargon (avoid trading "mission" for another cute-but-vague term).
- Body copy: unchanged register (still specific and factual about product mechanics — Console/Review queue/Field Kit/Stripe billing details are preserved verbatim where they're factual claims, e.g. pricing features, trust section).

## Anti-patterns / out of scope

- No changes to section order, props/callbacks, routing, or any non-visual behavior.
- No changes to pricing data, tier logic, or billing copy facts (numbers, quotas, feature lists stay factually identical — only surrounding decorative copy/tone changes).
- No new runtime dependency for hand-drawn rendering (no roughjs/rough-notation) — doodle effects are static SVG + CSS only.
- Not introducing Delius Swash Caps for body-length paragraph text.

## QA checklist

- [ ] All existing HomeView props/callbacks still wired identically (`onAddExample`, `onOpenBuilder`, `onOpenAccount`, `onRequireAuth`, `onStartWithAccount`, `onGoDashboard`, `onOpenPricing`, `onOpenKit`).
- [ ] `prefers-reduced-motion` verified: hero, loop-step cards, hover states all degrade to static/flat.
- [ ] Contrast-checked: primary/secondary text and button combinations meet AA.
- [ ] No leftover references to `use3d.ts` pointer-tracking hooks or old `TiltCard` 3D transform props.
- [ ] Visual check in browser: hero, loop steps, surfaces, pricing, trust, audience, picker, final CTA, footer all render in doodle style with no leftover blueprint-grid/military copy.
- [ ] Existing tests (if any cover HomeView) still pass.
