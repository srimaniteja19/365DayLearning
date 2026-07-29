# Dashboard Override — Refrainly

> Overrides `MASTER.md` for the campaign dashboard (console / index / spine).

## Direction

**Field Manual / Swiss Brutalist** — tactical learning ops console, not soft SaaS bento.

- Asymmetric 12-col index grid (current day spans wider)
- Hairline rules, inset accent bars, mono labels
- Progress as bullet segments + flat fills (no glow bars, no soft rings as primary)
- Theme radii via `--r-card` / `--r-ctl` (Afterburn/Voltaic 0px, Folio/Halide near-sharp, Marina softer)

## Avoid (AI tells)

- Soft multi-layer shadows + hover lift
- Radial glow blobs on cards
- `rounded-full` pills for day stamps / badges
- Glass blur on numbers
- Gradient progress bars with bloom shadows
- Decorative continuous pulse animations

## Motion

- 150–250ms ease-out only
- Prefer border/background shifts over translateY
- Respect `prefers-reduced-motion`

## Layout names

| Key | Label | Role |
|-----|-------|------|
| list | List | Dense rows |
| bento | Index | Asymmetric day cards |
| timeline | Spine | Alternating mission spine |
