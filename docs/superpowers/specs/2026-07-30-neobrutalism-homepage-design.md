# Neobrutalism homepage + marketing chrome redesign

## Context and goals

The signed-out homepage (`features/landing/HomeView.tsx` + `.landing*` / `.landing-root` rules in `app/dualtrack.css`) currently uses a light **doodle** skin (warm paper, hand-drawn SVG accents from `features/landing/doodle-assets.tsx`, soft doodle cards). Account and Pricing modals opened from that path still inherit the app’s theme-driven modal chrome, not a dedicated marketing look.

**Goal:** Rewrite the homepage as a **neobrutalist poster stack** and restyle Account + Pricing modals when shown on the landing path, using the neobrutalism design-system skill (yellow primary `#FDC800`, violet secondary `#432DD7`, hard shadows, thick borders, flat surfaces).

This is a **visual + IA rewrite** of the marketing surface (Approach 1 — Poster stack). Product behavior (auth gates, plan picker, Stripe pricing handlers, Field Kit entry) stays the same.

**Out of scope**
- Signed-in dashboard / Field Kit / theme system (`theme/themes.ts`, including the separate doodle Phase A work)
- Settings, Builder, Export, Quiz, Badges, and other non-marketing modals
- Changing subscription tier data or Stripe flows

## Design tokens and foundations

Scoped under `.landing` / `.landing-root` (and landing-path modal overrides). Do not mutate global dashboard theme tokens.

| Token | Value | Purpose |
|-------|-------|---------|
| Primary | `#FDC800` | Primary CTAs, highlighted surfaces, accent blocks |
| Secondary | `#432DD7` | Links, secondary actions, stamps, complementary accents |
| Success | `#16A34A` | Live / positive badges |
| Warning | `#D97706` | Coming soon / caution |
| Danger | `#DC2626` | Errors only |
| Surface | `#FBFBF9` | Page and panel backgrounds |
| Text / ink | `#1C293C` | Body, headings, borders, hard shadows |
| Border | `2.5px–3px solid #1C293C` | Structural borders on interactive + containers |
| Shadow | `4px 4px 0 #1C293C` | Default hard offset (no blur) |
| Shadow hover | `6px 6px 0 #1C293C` + translate `(-2px, -2px)` | Pointer hover |
| Shadow active | `2px 2px 0 #1C293C` + translate `(0, 0)` | Pressed |

**Typography (hybrid)**
- Body / UI: **Inter** — load via `next/font/google` as `--font-inter`; apply only on landing + marketing modals. Scale: `13 / 15 / 17 / 21` (and `27 / 35` for large display where needed).
- Brand + hero titles: **Space Grotesk** (`--font-space`) for `REFRAINLY` and hero/section display titles — not Inter.
- Mono stamps / prices / day marks: **JetBrains Mono** (`--font-jetbrains`, already loaded).
- Dashboard font packs and `themes.test.ts` “avoid Inter” rule remain for signed-in themes; Inter is marketing-path only.

**Spacing:** `4 / 8 / 12 / 16 / 24 / 32` base unit. Account for border + shadow bulk so blocks do not crowd.

**Shape language**
- `border-radius: 0` on landing cards, buttons, inputs, stamps
- Flat solid fills only — no gradients, glass, soft blur, or notebook rule textures
- Remove doodle SVG accents from the landing path (no `DoodleUnderline` / `DoodleBullet` / `DoodleStar` / `DoodleArrow` / `DoodleCircledNumber` in `HomeView`)

## Page architecture (poster stack)

Section order:

1. **Nav** — ink-border bar; brand mark + `REFRAINLY`; Pricing / Field kit / Dashboard (conditional); yellow primary Sign in / Account.
2. **Hero (first viewport)** — one composition: brand as hero-level signal, one headline (product clarity), one short lead, one CTA group (yellow primary + violet-outline secondary), one dominant hard-bordered “Next dispatch” progress mock. No subject chip clouds, stat strips, or doodle underlines in the hero.
3. **Proof strip** — 3–4 hard metric tiles (guest: sample streak/XP/days/Field Kit; returning with campaign: real `summary` stats).
4. **What it is** — three punchy claim blocks (structure · memory · rabbit holes); fold former audience “not for” into one short footnote.
5. **The loop** — six stamp cards (same step meanings as `CAMPAIGN_STEPS`; shorter copy; ink numbered squares).
6. **Two surfaces** — Deck vs Field Kit as equal neo panels (yellow header bar vs violet header bar).
7. **AI** — wide BYOK panel + side Managed AI panel; flat fills; CTAs scroll to pricing / unchanged handlers.
8. **Pricing** — three thick-border tier cards from existing `SUBSCRIPTION_TIERS` / `TIER_ORDER`; free = yellow wash; paid = violet stamps; CTAs keep `startAccount` / `onOpenPricing`.
9. **Trust** — three compact blocks (Account · Sync · Export).
10. **Final band** — full-width yellow CTA slab (unsigned only).
11. **Footer** — mono legal row; Privacy / Terms unchanged.

**Plan picker** — remains after auth gate (`started || hasCampaign`); restyle to neo cards; behavior unchanged.

**Motion (2–3 intentional only)**
- CTA hard-shadow punch on hover/active
- Loop cards enter with short lift (`whileInView`), respect `prefers-reduced-motion`
- Stamp badge pop on hero mock (optional, reduced-motion safe)

No ambient infinite float loops for Field Kit slips on the new hero.

## Marketing chrome (Account + Pricing)

When the shell has `landing-root` (signed-out marketing path in `DualTrackConsole`), Account and Pricing modals must use neo tokens:

- Panel: surface `#FBFBF9`, `2.5px` ink border, `4px 4px 0` ink shadow
- Primary buttons: `#FDC800` fill, `#1C293C` text (never white-on-yellow)
- Secondary / links: `#432DD7`
- Inputs: min-height 48px, ink border, `border-radius: 0`, 16px font on narrow viewports
- Pricing cards: match landing tier treatment

**Implementation mechanism:** CSS scoped as `.landing-root .modal-account` / `.landing-root .modal-pricing` (and panel children), and/or a `marketing-neo` class on the marketing shell. Do not globally restyle modals for signed-in theme sessions.

## Component-level rules

**Buttons**
- Default: thick ink border + hard shadow
- Hover: expand shadow / slight translate
- Active: compress shadow
- Focus-visible: `3px solid #1C293C` outline, `2px` offset
- Disabled: opacity ~0.55, no shadow motion
- Primary = yellow; ghost/secondary = surface or violet outline with ink text

**Cards / blocks**
- Zero radius, solid fill, ink border, hard shadow
- Section stamps: JetBrains Mono, violet or ink, not soft pills

**Hero dispatch mock**
- Dominates the visual plane (full-bleed block or edge-to-edge panel), not an inset soft collage
- Shows day list + progress energy; decorative only (`aria-hidden` where appropriate)

**Forms (account modal)**
- Same chunky neo inputs; full-width actions on ≤860px (align with existing mobile form fixes)

## Copy and tone

- Concise, confident, helpful
- Keep product vocabulary: campaign, Console, Field Kit, Review, Recruit / Operator / Architect, BYOK
- Drop doodle/journal warmth and remaining ops jargon; prefer poster-direct headlines
- Exact strings finalized in implementation; direction is fixed here

**Hero jobs (distributed, not all in first viewport)**
- Clarity: hero headline + “What it is”
- Progress energy: hero mock + proof strip
- Start CTA: hero primary + final band + pricing free tier

## Accessibility requirements (testable)

- WCAG 2.2 AA: `#1C293C` on `#FBFBF9`; `#1C293C` on `#FDC800` for CTA labels; violet links on surface meet AA or use underline + weight fallback
- Never white text on `#FDC800`
- Keyboard-visible focus on all interactive controls
- Decorative visuals `aria-hidden="true"`; information not decoration-only
- `prefers-reduced-motion: reduce` disables enter/hover motion beyond color/border changes
- Touch targets ≥44px; mobile stacked CTAs; no crushed flex inputs in modals

## Implementation sketch

1. Add Inter via `next/font` (`--font-inter`); on the marketing shell in `DualTrackConsole`, stop applying `FONT_PACKS.archivo` and set body→Inter, display→Space Grotesk, mono→JetBrains.
2. Replace `.landing` / `.landing-root` CSS variables with neo tokens; remove paper/doodle decoration (`::before`/`::after` notebook rules, soft radii, doodle card rotations).
3. Rewrite `HomeView.tsx` to the poster-stack sections; remove doodle-asset imports.
4. Update `LANDING_THEME` in `theme/themes.ts` (still used for `themeVars` on the shell) to the neo palette / light mode.
5. Add `.landing-root` modal overrides for Account + Pricing.
6. Responsive pass: hero stacks; pricing 1-col; full-width CTAs; modal full-bleed (reuse recent mobile modal/form rules).
7. QA checklist below.

## Anti-patterns / prohibited

- Soft shadows, gradients, glassmorphism, rounded “AI SaaS” pills as primary chrome
- White-on-yellow buttons
- Reintroducing doodle SVGs on the landing path
- Changing dashboard themes or signed-in modal look globally
- Crowding the first viewport with stats, schedules, or secondary marketing blocks
- Using Inter inside dashboard theme packs (marketing-only exception)

## QA checklist

- [ ] First viewport brand test: brand still reads if nav is ignored
- [ ] Hero has brand + one headline + one lead + one CTA group + one dominant visual
- [ ] Yellow CTAs use dark ink text; contrast checked
- [ ] Account + Pricing from landing match neo chrome; dashboard modals unchanged when signed in
- [ ] Plan picker / auth / Stripe handlers still work
- [ ] No doodle SVG usage in `HomeView`
- [ ] Mobile 375 / 768 / 1024 layouts; inputs usable with keyboard open
- [ ] Focus-visible and reduced-motion verified
- [ ] Dashboard theme switcher / doodle Phase A unaffected
