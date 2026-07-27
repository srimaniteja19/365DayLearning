import type { FontKey } from "@/lib/types";
import type { CSSProperties } from "react";

/** User-selectable type voice — uncommon faces, not Inter/Roboto/system. */
export type { FontKey };

export type FontPack = {
  key: FontKey;
  name: string;
  hint: string;
  /** Sample glyph shown in the picker */
  sample: string;
  /** CSS font-family stack — applied to sans, display, and mono alike */
  family: string;
  sans: string;
  display: string;
  mono: string;
};

/** One face for the whole UI (labels, body, buttons, inputs, titles). */
function voice(cssVar: string, generic: string): Pick<FontPack, "family" | "sans" | "display" | "mono"> {
  const family = `${cssVar}, ${generic}`;
  return { family, sans: family, display: family, mono: family };
}

/**
 * Ten uncommon Google Font voices.
 * Avoids Inter, Roboto, Arial, system-ui, Open Sans, Montserrat, Poppins, etc.
 */
export const FONT_PACKS: Record<FontKey, FontPack> = {
  syne: {
    key: "syne",
    name: "Syne",
    hint: "Angular geometric display",
    sample: "Ag",
    ...voice("var(--font-syne)", "sans-serif"),
  },
  fraunces: {
    key: "fraunces",
    name: "Fraunces",
    hint: "Soft optical serif",
    sample: "Qq",
    ...voice("var(--font-fraunces)", "Georgia, serif"),
  },
  bricolage: {
    key: "bricolage",
    name: "Bricolage",
    hint: "Wonky workhorse grotesque",
    sample: "Rr",
    ...voice("var(--font-bricolage)", "sans-serif"),
  },
  instrument: {
    key: "instrument",
    name: "Instrument",
    hint: "Sharp editorial serif",
    sample: "Nn",
    ...voice("var(--font-instrument)", "Georgia, serif"),
  },
  recursive: {
    key: "recursive",
    name: "Recursive",
    hint: "Casual mono-sans hybrid",
    sample: "Bb",
    ...voice("var(--font-recursive)", "sans-serif"),
  },
  fragment: {
    key: "fragment",
    name: "Fragment",
    hint: "Rare crisp monospace",
    sample: "01",
    ...voice("var(--font-fragment)", "ui-monospace, monospace"),
  },
  young: {
    key: "young",
    name: "Young Serif",
    hint: "Friendly bookish serif",
    sample: "Yy",
    ...voice("var(--font-young)", "Georgia, serif"),
  },
  besley: {
    key: "besley",
    name: "Besley",
    hint: "Quirky slab serif",
    sample: "Kk",
    ...voice("var(--font-besley)", "Georgia, serif"),
  },
  oxanium: {
    key: "oxanium",
    name: "Oxanium",
    hint: "Soft sci-fi sans",
    sample: "Xx",
    ...voice("var(--font-oxanium)", "sans-serif"),
  },
  bodoni: {
    key: "bodoni",
    name: "Bodoni Moda",
    hint: "High-contrast fashion serif",
    sample: "Dd",
    ...voice("var(--font-bodoni)", "Georgia, serif"),
  },
};

export const FONT_ORDER: FontKey[] = [
  "syne",
  "fraunces",
  "bricolage",
  "instrument",
  "recursive",
  "fragment",
  "young",
  "besley",
  "oxanium",
  "bodoni",
];

export const DEFAULT_FONT_KEY: FontKey = "bricolage";

export function fontVars(pack: FontPack): CSSProperties {
  return {
    "--sans": pack.sans,
    "--display": pack.display,
    "--mono": pack.mono,
  } as CSSProperties;
}
