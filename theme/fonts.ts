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

/** Default type voice — geometric ops sans. */
export const DEFAULT_FONT_KEY: FontKey = "space";

/**
 * Ten distinctive Google Font voices for the field-manual UI.
 * Avoids Inter, Roboto, Arial, system-ui, Open Sans, Montserrat, Poppins, etc.
 */
export const FONT_PACKS: Record<FontKey, FontPack> = {
  space: {
    key: "space",
    name: "Space Grotesk",
    hint: "Geometric ops sans",
    sample: "Sg",
    ...voice("var(--font-space)", "sans-serif"),
  },
  literata: {
    key: "literata",
    name: "Literata",
    hint: "Literary book serif",
    sample: "Ll",
    ...voice("var(--font-literata)", "Georgia, serif"),
  },
  jetbrains: {
    key: "jetbrains",
    name: "JetBrains Mono",
    hint: "Full console monospace",
    sample: "01",
    ...voice("var(--font-jetbrains)", "ui-monospace, monospace"),
  },
  archivo: {
    key: "archivo",
    name: "Archivo",
    hint: "Condensed industrial sans",
    sample: "Aa",
    ...voice("var(--font-archivo)", "sans-serif"),
  },
  newsreader: {
    key: "newsreader",
    name: "Newsreader",
    hint: "Press editorial serif",
    sample: "Nn",
    ...voice("var(--font-newsreader)", "Georgia, serif"),
  },
  spacemono: {
    key: "spacemono",
    name: "Space Mono",
    hint: "Brutalist raw mono",
    sample: "Xx",
    ...voice("var(--font-spacemono)", "ui-monospace, monospace"),
  },
  sora: {
    key: "sora",
    name: "Sora",
    hint: "Soft rounded geometric",
    sample: "So",
    ...voice("var(--font-sora)", "sans-serif"),
  },
  kalnia: {
    key: "kalnia",
    name: "Kalnia",
    hint: "Quirky display serif",
    sample: "Kk",
    ...voice("var(--font-kalnia)", "Georgia, serif"),
  },
  host: {
    key: "host",
    name: "Host Grotesk",
    hint: "Contemporary workhorse",
    sample: "Hh",
    ...voice("var(--font-host)", "sans-serif"),
  },
  redmono: {
    key: "redmono",
    name: "Red Hat Mono",
    hint: "Friendly technical mono",
    sample: "Rh",
    ...voice("var(--font-redmono)", "ui-monospace, monospace"),
  },
};

export const FONT_ORDER: FontKey[] = [
  "space",
  "literata",
  "jetbrains",
  "archivo",
  "newsreader",
  "spacemono",
  "sora",
  "kalnia",
  "host",
  "redmono",
];

/** Map retired font keys → current ones so saved snapshots keep working. */
const LEGACY_FONT_MAP: Record<string, FontKey> = {
  syne: "space",
  fraunces: "literata",
  bricolage: "host",
  instrument: "newsreader",
  recursive: "sora",
  fragment: "jetbrains",
  young: "literata",
  besley: "kalnia",
  oxanium: "archivo",
  bodoni: "kalnia",
};

export function resolveFontKey(raw: unknown): FontKey {
  if (typeof raw === "string") {
    if (raw in FONT_PACKS) return raw as FontKey;
    if (raw in LEGACY_FONT_MAP) return LEGACY_FONT_MAP[raw];
  }
  return DEFAULT_FONT_KEY;
}

export function fontVars(pack: FontPack): CSSProperties {
  return {
    "--sans": pack.sans,
    "--display": pack.display,
    "--mono": pack.mono,
  } as CSSProperties;
}
