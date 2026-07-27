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

export const FONT_STACKS = {
  mono: "var(--font-jetbrains), ui-monospace, monospace",
  sans: "var(--font-inter), -apple-system, sans-serif",
  serif: "var(--font-source-serif), Georgia, serif",
  grotesk: "var(--font-space-grotesk), var(--font-inter), sans-serif",
};

export const THEMES: Record<ThemeKey, ThemeDef> = {
  bloom: {
    name: "Bloom", mode: "light", palette: "light", effects: true,
    swatch: ["#F2F9FF", "#2E9BE6", "#FF3D9A"],
    accents: { main: "#2E9BE6", sprint: "#FF3D9A" },
    display: FONT_STACKS.grotesk,
    radius: { card: "16px", ctl: "10px", pill: "999px", bar: "6px" },
    grid: { color: "rgba(46,155,230,0.10)", size: "40px", scan: "0" },
    c: {
      bg: "#F2F9FF", panel: "#FFFFFF", panel2: "#F7FBFF", blur: "rgba(242,249,255,0.82)",
      text: "#12283A", dim: "#4A6B80", faint: "#6F879A",
      border: "rgba(18,40,58,0.10)", borderSoft: "rgba(18,40,58,0.06)", borderHover: "rgba(18,40,58,0.22)",
      track: "rgba(18,40,58,0.10)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.85)",
      ok: "#0E9F6E", warn: "#D97706", err: "#DC2626", info: "#2E9BE6",
    },
  },
  ledger: {
    name: "Ledger", mode: "light", palette: "light", effects: false,
    swatch: ["#FAF6EC", "#A9703B", "#6B5335"],
    accents: { main: "#A9703B", sprint: "#6B7F3A" },
    display: FONT_STACKS.serif,
    radius: { card: "4px", ctl: "3px", pill: "3px", bar: "2px" },
    grid: { color: "rgba(107,83,53,0.07)", size: "44px", scan: "0" },
    c: {
      bg: "#FAF6EC", panel: "#FFFDF7", panel2: "#F4EEDF", blur: "rgba(250,246,236,0.85)",
      text: "#2E2618", dim: "#6B5D46", faint: "#8F8169",
      border: "rgba(46,38,24,0.14)", borderSoft: "rgba(46,38,24,0.08)", borderHover: "rgba(46,38,24,0.30)",
      track: "rgba(46,38,24,0.10)", onAccent: "#FFFDF7", onAccentSoft: "rgba(255,253,247,0.9)",
      ok: "#3F6B2B", warn: "#A9703B", err: "#9B2C1F", info: "#4A6B8A",
    },
  },
  terminal: {
    name: "Terminal", mode: "dark", palette: "dark", effects: true,
    swatch: ["#0C1116", "#3DDC97", "#22D3EE"],
    accents: { main: "#3DDC97", sprint: "#22D3EE" },
    display: FONT_STACKS.mono,
    radius: { card: "8px", ctl: "5px", pill: "6px", bar: "3px" },
    grid: { color: "rgba(61,220,151,0.05)", size: "36px", scan: "0.5" },
    c: {
      bg: "#0C1116", panel: "#121A21", panel2: "#16202A", blur: "rgba(12,17,22,0.72)",
      text: "#D6E4E0", dim: "#7E948E", faint: "#5B6F6B",
      border: "rgba(214,228,224,0.10)", borderSoft: "rgba(214,228,224,0.06)", borderHover: "rgba(214,228,224,0.24)",
      track: "rgba(214,228,224,0.10)", onAccent: "#08120E", onAccentSoft: "rgba(8,18,14,0.7)",
      ok: "#3DDC97", warn: "#FACC15", err: "#F87171", info: "#22D3EE",
    },
  },
  pebble: {
    name: "Pebble", mode: "light", palette: "light", effects: true,
    swatch: ["#F4EDE2", "#C4643C", "#8A6A4F"],
    accents: { main: "#C4643C", sprint: "#7A8B6F" },
    display: FONT_STACKS.grotesk,
    radius: { card: "18px", ctl: "12px", pill: "999px", bar: "8px" },
    grid: { color: "rgba(122,94,66,0.07)", size: "46px", scan: "0" },
    c: {
      bg: "#F4EDE2", panel: "#FFFAF2", panel2: "#EFE5D6", blur: "rgba(244,237,226,0.84)",
      text: "#33281E", dim: "#6F5F4E", faint: "#8D7A64",
      border: "rgba(51,40,30,0.12)", borderSoft: "rgba(51,40,30,0.07)", borderHover: "rgba(51,40,30,0.26)",
      track: "rgba(51,40,30,0.10)", onAccent: "#FFFAF2", onAccentSoft: "rgba(255,250,242,0.9)",
      ok: "#4F7A3F", warn: "#C4843C", err: "#B03A28", info: "#4A6B8A",
    },
  },
  graphite: {
    name: "Graphite", mode: "light", palette: "light", effects: false,
    swatch: ["#EDEFF2", "#2563EB", "#5B6472"],
    accents: { main: "#2563EB", sprint: "#0F766E" },
    display: FONT_STACKS.mono,
    radius: { card: "2px", ctl: "2px", pill: "2px", bar: "1px" },
    grid: { color: "rgba(40,48,60,0.06)", size: "32px", scan: "0" },
    c: {
      bg: "#EDEFF2", panel: "#FBFCFD", panel2: "#E4E7EC", blur: "rgba(237,239,242,0.85)",
      text: "#1B2230", dim: "#5B6472", faint: "#777F8D",
      border: "rgba(27,34,48,0.14)", borderSoft: "rgba(27,34,48,0.08)", borderHover: "rgba(27,34,48,0.32)",
      track: "rgba(27,34,48,0.10)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#15803D", warn: "#B45309", err: "#B91C1C", info: "#2563EB",
    },
  },
  parchment: {
    name: "Parchment", mode: "light", palette: "light", effects: true,
    swatch: ["#F6EFE0", "#6B7F3A", "#8A7A55"],
    accents: { main: "#6B7F3A", sprint: "#A9703B" },
    display: FONT_STACKS.serif,
    radius: { card: "14px", ctl: "10px", pill: "999px", bar: "6px" },
    grid: { color: "rgba(107,127,58,0.07)", size: "42px", scan: "0" },
    c: {
      bg: "#F6EFE0", panel: "#FDF9EF", panel2: "#F0E7D4", blur: "rgba(246,239,224,0.84)",
      text: "#2F2E22", dim: "#67654F", faint: "#847F62",
      border: "rgba(47,46,34,0.13)", borderSoft: "rgba(47,46,34,0.07)", borderHover: "rgba(47,46,34,0.28)",
      track: "rgba(47,46,34,0.10)", onAccent: "#FDF9EF", onAccentSoft: "rgba(253,249,239,0.9)",
      ok: "#4F7A3F", warn: "#A9703B", err: "#9B2C1F", info: "#4A6B8A",
    },
  },
  blueprint: {
    name: "Blueprint", mode: "dark", palette: "dark", effects: true,
    swatch: ["#0B2545", "#F5A623", "#7FB2E5"],
    accents: { main: "#F5A623", sprint: "#7FB2E5" },
    display: FONT_STACKS.mono,
    radius: { card: "4px", ctl: "3px", pill: "4px", bar: "2px" },
    grid: { color: "rgba(160,200,240,0.16)", size: "28px", scan: "0" },
    c: {
      bg: "#0B2545", panel: "#102E52", panel2: "#143760", blur: "rgba(11,37,69,0.75)",
      text: "#DCE9F7", dim: "#8FAFCF", faint: "#5E7FA3",
      border: "rgba(220,233,247,0.16)", borderSoft: "rgba(220,233,247,0.09)", borderHover: "rgba(220,233,247,0.32)",
      track: "rgba(220,233,247,0.14)", onAccent: "#0B2545", onAccentSoft: "rgba(11,37,69,0.75)",
      ok: "#6EE7B7", warn: "#F5A623", err: "#F87171", info: "#7FB2E5",
    },
  },
  matte: {
    name: "Matte Black", mode: "dark", palette: "muted", effects: false,
    swatch: ["#0B0B0C", "#C9CBD1", "#7E8189"],
    accents: { main: "#C9CBD1", sprint: "#8E9299" },
    display: FONT_STACKS.mono,
    radius: { card: "6px", ctl: "4px", pill: "6px", bar: "2px" },
    grid: { color: "rgba(255,255,255,0.022)", size: "40px", scan: "0" },
    c: {
      bg: "#0B0B0C", panel: "#141416", panel2: "#1B1B1E", blur: "rgba(11,11,12,0.78)",
      text: "#E4E4E6", dim: "#8B8C90", faint: "#67686C",
      border: "rgba(255,255,255,0.08)", borderSoft: "rgba(255,255,255,0.05)", borderHover: "rgba(255,255,255,0.20)",
      track: "rgba(255,255,255,0.08)", onAccent: "#0B0B0C", onAccentSoft: "rgba(11,11,12,0.75)",
      ok: "#A8AAAF", warn: "#B9BBC0", err: "#C98A8A", info: "#9FA2A8",
    },
  },
};

export const THEME_ORDER: ThemeKey[] = ["bloom", "ledger", "terminal", "pebble", "graphite", "parchment", "blueprint", "matte"];

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
