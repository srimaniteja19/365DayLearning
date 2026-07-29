import type { CSSProperties } from "react";
import type { ThemeKey } from "@/lib/types";

export type PaletteMode = "dark" | "light" | "muted";

export type ThemeDef = {
  name: string;
  mode: "light" | "dark";
  palette: PaletteMode;
  effects: boolean;
  swatch: string[];
  accents: { main: string; sprint: string };
  display: string;
  radius: { card: string; ctl: string; pill: string; bar: string };
  grid: { color: string; size: string; scan: string };
  c: {
    bg: string; panel: string; panel2: string; blur: string;
    text: string; dim: string; faint: string;
    border: string; borderSoft: string; borderHover: string;
    track: string; onAccent: string; onAccentSoft: string;
    ok: string; warn: string; err: string; info: string;
  };
};

export const DOMAIN_PALETTES: Record<PaletteMode, Record<string, string>> = {
  dark: {
    "ai-ml": "#F5A623", "backend-node": "#3FE0D0", "frontend": "#C792EA",
    "databases": "#6EE7B7", "infra-cloud": "#60A5FA", "data-eng": "#F472B6",
    "distributed-sys": "#FB923C", "security": "#EF4444", "observability": "#A3E635",
    "perf": "#FACC15", "systems-eng": "#94A3B8",
  },
  light: {
    "ai-ml": "#B4730A", "backend-node": "#0E8C7F", "frontend": "#7C3AED",
    "databases": "#10855F", "infra-cloud": "#1D4ED8", "data-eng": "#BE185D",
    "distributed-sys": "#C2410C", "security": "#B91C1C", "observability": "#4D7C0F",
    "perf": "#A16207", "systems-eng": "#4B5563",
  },
  muted: {
    "ai-ml": "#C4A052", "backend-node": "#5FA89C", "frontend": "#9A8CBF",
    "databases": "#74A88A", "infra-cloud": "#7B94BF", "data-eng": "#B98BA0",
    "distributed-sys": "#C08F6B", "security": "#BE7A7A", "observability": "#9AAE72",
    "perf": "#C0AE6A", "systems-eng": "#8C9199",
  },
};

const FONT_STACKS = {
  mono: "var(--font-jetbrains), ui-monospace, monospace",
  sans: "var(--font-space), sans-serif",
  serif: "var(--font-literata), Georgia, serif",
  grotesk: "var(--font-host), var(--font-space), sans-serif",
};

/** Default dashboard + landing theme. */
export const DEFAULT_THEME_KEY: ThemeKey = "signal";

/**
 * Ten field-manual skins — distinct moods, not soft SaaS pastels.
 * Mix of light/dark, sharp/soft radii, and singular accent stories.
 */
export const THEMES: Record<ThemeKey, ThemeDef> = {
  signal: {
    name: "Signal", mode: "light", palette: "light", effects: false,
    swatch: ["#EEF2F6", "#1D4ED8", "#E11D48"],
    accents: { main: "#1D4ED8", sprint: "#E11D48" },
    display: FONT_STACKS.grotesk,
    radius: { card: "4px", ctl: "3px", pill: "3px", bar: "2px" },
    grid: { color: "rgba(29,78,216,0.08)", size: "36px", scan: "0" },
    c: {
      bg: "#EEF2F6", panel: "#FFFFFF", panel2: "#E4EAF1", blur: "rgba(238,242,246,0.88)",
      text: "#0F172A", dim: "#475569", faint: "#64748B",
      border: "rgba(15,23,42,0.14)", borderSoft: "rgba(15,23,42,0.08)", borderHover: "rgba(15,23,42,0.28)",
      track: "rgba(15,23,42,0.10)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.88)",
      ok: "#047857", warn: "#B45309", err: "#DC2626", info: "#1D4ED8",
    },
  },
  folio: {
    name: "Folio", mode: "light", palette: "light", effects: false,
    swatch: ["#F7F5F2", "#171717", "#DB2777"],
    accents: { main: "#171717", sprint: "#DB2777" },
    display: FONT_STACKS.serif,
    radius: { card: "2px", ctl: "2px", pill: "2px", bar: "1px" },
    grid: { color: "rgba(23,23,23,0.06)", size: "48px", scan: "0" },
    c: {
      bg: "#F7F5F2", panel: "#FFFEFC", panel2: "#EEEBE6", blur: "rgba(247,245,242,0.9)",
      text: "#171717", dim: "#525252", faint: "#737373",
      border: "rgba(23,23,23,0.16)", borderSoft: "rgba(23,23,23,0.08)", borderHover: "rgba(23,23,23,0.32)",
      track: "rgba(23,23,23,0.10)", onAccent: "#FFFEFC", onAccentSoft: "rgba(255,254,252,0.9)",
      ok: "#166534", warn: "#A16207", err: "#BE123C", info: "#1D4ED8",
    },
  },
  afterburn: {
    name: "Afterburn", mode: "dark", palette: "dark", effects: true,
    swatch: ["#0C0C0E", "#F97316", "#94A3B8"],
    accents: { main: "#F97316", sprint: "#FBBF24" },
    display: FONT_STACKS.grotesk,
    radius: { card: "0px", ctl: "0px", pill: "0px", bar: "0px" },
    grid: { color: "rgba(249,115,22,0.07)", size: "32px", scan: "0.35" },
    c: {
      bg: "#0C0C0E", panel: "#151518", panel2: "#1C1C21", blur: "rgba(12,12,14,0.78)",
      text: "#F4F4F5", dim: "#A1A1AA", faint: "#71717A",
      border: "rgba(244,244,245,0.12)", borderSoft: "rgba(244,244,245,0.06)", borderHover: "rgba(244,244,245,0.28)",
      track: "rgba(244,244,245,0.10)", onAccent: "#0C0C0E", onAccentSoft: "rgba(12,12,14,0.8)",
      ok: "#4ADE80", warn: "#FBBF24", err: "#F87171", info: "#38BDF8",
    },
  },
  chlorophyll: {
    name: "Chlorophyll", mode: "light", palette: "light", effects: true,
    swatch: ["#EEF4EC", "#166534", "#65A30D"],
    accents: { main: "#166534", sprint: "#65A30D" },
    display: FONT_STACKS.serif,
    radius: { card: "6px", ctl: "4px", pill: "4px", bar: "2px" },
    grid: { color: "rgba(22,101,52,0.07)", size: "42px", scan: "0" },
    c: {
      bg: "#EEF4EC", panel: "#F7FBF5", panel2: "#E1EBDC", blur: "rgba(238,244,236,0.88)",
      text: "#14261A", dim: "#3F5A45", faint: "#6B8570",
      border: "rgba(20,38,26,0.14)", borderSoft: "rgba(20,38,26,0.08)", borderHover: "rgba(20,38,26,0.28)",
      track: "rgba(20,38,26,0.10)", onAccent: "#F7FBF5", onAccentSoft: "rgba(247,251,245,0.9)",
      ok: "#15803D", warn: "#A16207", err: "#B91C1C", info: "#0F766E",
    },
  },
  oxide: {
    name: "Oxide", mode: "dark", palette: "muted", effects: false,
    swatch: ["#14110F", "#C2410C", "#D6D3D1"],
    accents: { main: "#C2410C", sprint: "#A8A29E" },
    display: FONT_STACKS.mono,
    radius: { card: "2px", ctl: "2px", pill: "2px", bar: "1px" },
    grid: { color: "rgba(194,65,12,0.08)", size: "34px", scan: "0" },
    c: {
      bg: "#14110F", panel: "#1C1917", panel2: "#292524", blur: "rgba(20,17,15,0.8)",
      text: "#E7E5E4", dim: "#A8A29E", faint: "#78716C",
      border: "rgba(231,229,228,0.12)", borderSoft: "rgba(231,229,228,0.06)", borderHover: "rgba(231,229,228,0.26)",
      track: "rgba(231,229,228,0.10)", onAccent: "#FFF7ED", onAccentSoft: "rgba(255,247,237,0.85)",
      ok: "#A3A3A3", warn: "#D97706", err: "#E11D48", info: "#A8A29E",
    },
  },
  ion: {
    name: "Ion", mode: "dark", palette: "dark", effects: true,
    swatch: ["#0B1020", "#22D3EE", "#818CF8"],
    accents: { main: "#22D3EE", sprint: "#818CF8" },
    display: FONT_STACKS.mono,
    radius: { card: "3px", ctl: "3px", pill: "3px", bar: "2px" },
    grid: { color: "rgba(34,211,238,0.08)", size: "28px", scan: "0.45" },
    c: {
      bg: "#0B1020", panel: "#12182B", panel2: "#1A2238", blur: "rgba(11,16,32,0.78)",
      text: "#E2E8F0", dim: "#94A3B8", faint: "#64748B",
      border: "rgba(226,232,240,0.12)", borderSoft: "rgba(226,232,240,0.06)", borderHover: "rgba(226,232,240,0.28)",
      track: "rgba(226,232,240,0.10)", onAccent: "#0B1020", onAccentSoft: "rgba(11,16,32,0.8)",
      ok: "#34D399", warn: "#FBBF24", err: "#F87171", info: "#22D3EE",
    },
  },
  cinnabar: {
    name: "Cinnabar", mode: "light", palette: "light", effects: true,
    swatch: ["#F3EDE4", "#B91C1C", "#44403C"],
    accents: { main: "#B91C1C", sprint: "#44403C" },
    display: FONT_STACKS.serif,
    radius: { card: "3px", ctl: "3px", pill: "3px", bar: "2px" },
    grid: { color: "rgba(185,28,28,0.07)", size: "40px", scan: "0" },
    c: {
      bg: "#F3EDE4", panel: "#FAF6F0", panel2: "#E8E0D4", blur: "rgba(243,237,228,0.88)",
      text: "#1C1917", dim: "#57534E", faint: "#78716C",
      border: "rgba(28,25,23,0.14)", borderSoft: "rgba(28,25,23,0.08)", borderHover: "rgba(28,25,23,0.30)",
      track: "rgba(28,25,23,0.10)", onAccent: "#FAF6F0", onAccentSoft: "rgba(250,246,240,0.9)",
      ok: "#3F6212", warn: "#B45309", err: "#9F1239", info: "#1E3A5F",
    },
  },
  halide: {
    name: "Halide", mode: "light", palette: "light", effects: false,
    swatch: ["#EBEEF2", "#0F766E", "#B45309"],
    accents: { main: "#0F766E", sprint: "#B45309" },
    display: FONT_STACKS.mono,
    radius: { card: "1px", ctl: "1px", pill: "1px", bar: "1px" },
    grid: { color: "rgba(15,118,110,0.07)", size: "30px", scan: "0" },
    c: {
      bg: "#EBEEF2", panel: "#F8FAFC", panel2: "#DEE3EA", blur: "rgba(235,238,242,0.9)",
      text: "#0F172A", dim: "#475569", faint: "#64748B",
      border: "rgba(15,23,42,0.15)", borderSoft: "rgba(15,23,42,0.08)", borderHover: "rgba(15,23,42,0.32)",
      track: "rgba(15,23,42,0.10)", onAccent: "#F8FAFC", onAccentSoft: "rgba(248,250,252,0.9)",
      ok: "#047857", warn: "#B45309", err: "#BE123C", info: "#0369A1",
    },
  },
  voltaic: {
    name: "Voltaic", mode: "dark", palette: "dark", effects: true,
    swatch: ["#09090B", "#C8E600", "#FAFAFA"],
    accents: { main: "#C8E600", sprint: "#FAFAFA" },
    display: FONT_STACKS.grotesk,
    radius: { card: "0px", ctl: "0px", pill: "0px", bar: "0px" },
    grid: { color: "rgba(200,230,0,0.06)", size: "40px", scan: "0.4" },
    c: {
      bg: "#09090B", panel: "#121214", panel2: "#1A1A1D", blur: "rgba(9,9,11,0.8)",
      text: "#FAFAFA", dim: "#A1A1AA", faint: "#71717A",
      border: "rgba(250,250,250,0.12)", borderSoft: "rgba(250,250,250,0.06)", borderHover: "rgba(250,250,250,0.28)",
      track: "rgba(250,250,250,0.10)", onAccent: "#09090B", onAccentSoft: "rgba(9,9,11,0.85)",
      ok: "#A3E635", warn: "#FACC15", err: "#FB7185", info: "#67E8F9",
    },
  },
  marina: {
    name: "Marina", mode: "light", palette: "light", effects: true,
    swatch: ["#E8F0F4", "#0F5C6B", "#E85D4C"],
    accents: { main: "#0F5C6B", sprint: "#E85D4C" },
    display: FONT_STACKS.grotesk,
    radius: { card: "5px", ctl: "4px", pill: "4px", bar: "2px" },
    grid: { color: "rgba(15,92,107,0.08)", size: "38px", scan: "0" },
    c: {
      bg: "#E8F0F4", panel: "#F5FAFC", panel2: "#D5E4EB", blur: "rgba(232,240,244,0.88)",
      text: "#0C2A33", dim: "#3D6570", faint: "#5F828C",
      border: "rgba(12,42,51,0.14)", borderSoft: "rgba(12,42,51,0.08)", borderHover: "rgba(12,42,51,0.28)",
      track: "rgba(12,42,51,0.10)", onAccent: "#F5FAFC", onAccentSoft: "rgba(245,250,252,0.9)",
      ok: "#0F766E", warn: "#C2410C", err: "#BE123C", info: "#0369A1",
    },
  },
};

export const THEME_ORDER: ThemeKey[] = [
  "signal",
  "folio",
  "afterburn",
  "chlorophyll",
  "oxide",
  "ion",
  "cinnabar",
  "halide",
  "voltaic",
  "marina",
];

/** Map retired theme keys → current ones so saved snapshots keep working. */
const LEGACY_THEME_MAP: Record<string, ThemeKey> = {
  bloom: "signal",
  ledger: "folio",
  terminal: "ion",
  pebble: "cinnabar",
  graphite: "halide",
  parchment: "chlorophyll",
  blueprint: "marina",
  matte: "afterburn",
};

export function resolveThemeKey(raw: unknown): ThemeKey {
  if (typeof raw === "string") {
    if (raw in THEMES) return raw as ThemeKey;
    if (raw in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[raw];
  }
  return DEFAULT_THEME_KEY;
}

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function themeVars(t: ThemeDef): CSSProperties {
  const c = t.c;
  return {
    "--bg": c.bg, "--bg-panel": c.panel, "--bg-panel-2": c.panel2, "--bg-blur": c.blur,
    "--text": c.text, "--text-dim": c.dim, "--text-faint": c.faint,
    "--border": c.border, "--border-soft": c.borderSoft, "--border-hover": c.borderHover,
    "--track": c.track, "--on-accent": c.onAccent, "--on-accent-soft": c.onAccentSoft,
    "--ok": c.ok, "--warn": c.warn, "--err": c.err, "--info": c.info,
    "--accent-main": t.accents.main, "--accent-sprint": t.accents.sprint,
    /* Default campaign accent for modals/settings (overridden by plan scopes). */
    "--accent": t.accents.main,
    "--glow": t.effects ? hexToRgba(t.accents.main, 0.35) : "transparent",
    "--overlay": t.mode === "light" ? "rgba(30, 24, 16, 0.38)" : "rgba(0, 0, 0, 0.58)",
    /* Fonts are owned by the font pack switcher; themes only set colors/radii. */
    "--r-card": t.radius.card, "--r-ctl": t.radius.ctl, "--r-pill": t.radius.pill, "--r-bar": t.radius.bar,
    "--grid-color": t.grid.color, "--grid-size": t.grid.size, "--scan-op": t.grid.scan,
    "--dot-glow": t.effects ? "0 0 8px currentColor" : "none",
  } as CSSProperties;
}
