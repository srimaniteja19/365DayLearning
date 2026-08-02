import type { CSSProperties } from "react";
import type { ThemeKey } from "@/lib/types";

export type PaletteMode = "dark" | "light" | "muted";

export type StyleCategory = "neobrutalism" | "minimal" | "dark";

export type ThemeDef = {
  name: string;
  mode: "light" | "dark";
  palette: PaletteMode;
  styleCategory: StyleCategory;
  borderWidth: string;
  shadows: { card: string; pop: string; btn: string };
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
    "psychology": "#F9A8D4", "cognitive-sci": "#E9D5FF", "behavioral-econ": "#FCD34D",
    "economics": "#86EFAC", "history": "#FDBA74", "philosophy": "#C4B5FD",
    "languages": "#7DD3FC", "literature": "#FDA4AF", "writing": "#A5B4FC",
    "arts": "#F0ABFC", "music": "#67E8F9", "biology": "#4ADE80",
    "physics": "#93C5FD", "math": "#FDE68A", "health": "#6EE7B7",
    "business": "#FCA5A5", "law-civics": "#D4D4D8", "geography": "#A3E635",
    "sociology": "#F9A8D4", "communication": "#A5F3FC",
  },
  light: {
    "ai-ml": "#B4730A", "backend-node": "#0E8C7F", "frontend": "#7C3AED",
    "databases": "#10855F", "infra-cloud": "#1D4ED8", "data-eng": "#BE185D",
    "distributed-sys": "#C2410C", "security": "#B91C1C", "observability": "#4D7C0F",
    "perf": "#A16207", "systems-eng": "#4B5563",
    "psychology": "#BE185D", "cognitive-sci": "#7E22CE", "behavioral-econ": "#A16207",
    "economics": "#15803D", "history": "#C2410C", "philosophy": "#6D28D9",
    "languages": "#0369A1", "literature": "#BE123C", "writing": "#4338CA",
    "arts": "#A21CAF", "music": "#0E7490", "biology": "#15803D",
    "physics": "#1D4ED8", "math": "#A16207", "health": "#0F766E",
    "business": "#B91C1C", "law-civics": "#52525B", "geography": "#4D7C0F",
    "sociology": "#9D174D", "communication": "#0E7490",
  },
  muted: {
    "ai-ml": "#C4A052", "backend-node": "#5FA89C", "frontend": "#9A8CBF",
    "databases": "#74A88A", "infra-cloud": "#7B94BF", "data-eng": "#B98BA0",
    "distributed-sys": "#C08F6B", "security": "#BE7A7A", "observability": "#9AAE72",
    "perf": "#C0AE6A", "systems-eng": "#8C9199",
    "psychology": "#C49AA8", "cognitive-sci": "#B0A0C4", "behavioral-econ": "#C4B06A",
    "economics": "#7AA88A", "history": "#C08F6B", "philosophy": "#A08CBF",
    "languages": "#7B94BF", "literature": "#BE8A8A", "writing": "#8C8CBF",
    "arts": "#B98BBF", "music": "#5FA8B8", "biology": "#74A88A",
    "physics": "#7B94BF", "math": "#C0AE6A", "health": "#5FA89C",
    "business": "#BE7A7A", "law-civics": "#8C9199", "geography": "#9AAE72",
    "sociology": "#C49AA8", "communication": "#5FA8B8",
  },
};

const FONT_STACKS = {
  mono: "var(--font-jetbrains), ui-monospace, monospace",
  sans: "var(--font-space), sans-serif",
  serif: "var(--font-literata), Georgia, serif",
  grotesk: "var(--font-host), var(--font-space), sans-serif",
};

/** Default dashboard theme (user-selectable). Key stays `doodle` for saved snapshots. */
export const DEFAULT_THEME_KEY: ThemeKey = "doodle";

/**
 * Neobrutalism skin — yellow primary, violet secondary, flat warm surface, bold ink borders.
 * Shared by the public homepage (`LANDING_THEME`) and the default dashboard theme.
 */
const NEO_THEME: ThemeDef = {
  name: "Neo",
  mode: "light",
  palette: "light",
  styleCategory: "neobrutalism",
  borderWidth: "2.5px",
  shadows: {
    card: "4px 4px 0px #1C293C",
    pop: "6px 6px 0px #1C293C",
    btn: "3px 3px 0px #1C293C",
  },
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

/** Fixed public homepage skin — same for every visitor, ignores account theme. */
export const LANDING_THEME: ThemeDef = NEO_THEME;

/**
 * User-selectable skins. `doodle` key = Neo (default) for snapshot compatibility.
 * Extended with high-contrast Neobrutalism, Minimal Light, and Sleek Dark variants.
 */
export const THEMES: Record<ThemeKey, ThemeDef> = {
  doodle: NEO_THEME,
  signal: {
    name: "Signal",
    mode: "light",
    palette: "light",
    styleCategory: "minimal",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 16px -4px rgba(15,23,42,0.06)",
      pop: "0 12px 32px -8px rgba(15,23,42,0.12)",
      btn: "0 2px 8px rgba(29,78,216,0.15)",
    },
    effects: false,
    swatch: ["#F8FAFC", "#2563EB", "#F43F5E"],
    accents: { main: "#2563EB", sprint: "#F43F5E" },
    display: FONT_STACKS.grotesk,
    radius: { card: "6px", ctl: "4px", pill: "4px", bar: "3px" },
    grid: { color: "rgba(37,99,235,0.06)", size: "36px", scan: "0" },
    c: {
      bg: "#F8FAFC", panel: "#FFFFFF", panel2: "#F1F5F9", blur: "rgba(248,250,252,0.9)",
      text: "#0F172A", dim: "#475569", faint: "#64748B",
      border: "rgba(15,23,42,0.12)", borderSoft: "rgba(15,23,42,0.06)", borderHover: "rgba(37,99,235,0.4)",
      track: "rgba(15,23,42,0.08)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#059669", warn: "#D97706", err: "#E11D48", info: "#2563EB",
    },
  },
  folio: {
    name: "Folio",
    mode: "light",
    palette: "light",
    styleCategory: "minimal",
    borderWidth: "1px",
    shadows: {
      card: "0 2px 12px -2px rgba(23,23,23,0.05)",
      pop: "0 8px 24px -4px rgba(23,23,23,0.10)",
      btn: "0 2px 6px rgba(23,23,23,0.12)",
    },
    effects: false,
    swatch: ["#FBF9F5", "#171717", "#E11D48"],
    accents: { main: "#171717", sprint: "#E11D48" },
    display: FONT_STACKS.serif,
    radius: { card: "3px", ctl: "2px", pill: "2px", bar: "1px" },
    grid: { color: "rgba(23,23,23,0.05)", size: "48px", scan: "0" },
    c: {
      bg: "#FBF9F5", panel: "#FFFFFF", panel2: "#F3EFEA", blur: "rgba(251,249,245,0.92)",
      text: "#171717", dim: "#525252", faint: "#737373",
      border: "rgba(23,23,23,0.14)", borderSoft: "rgba(23,23,23,0.07)", borderHover: "rgba(23,23,23,0.35)",
      track: "rgba(23,23,23,0.08)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#15803D", warn: "#B45309", err: "#BE123C", info: "#1D4ED8",
    },
  },
  afterburn: {
    name: "Afterburn",
    mode: "dark",
    palette: "dark",
    styleCategory: "dark",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 20px -2px rgba(249,115,22,0.12)",
      pop: "0 10px 30px -4px rgba(249,115,22,0.22)",
      btn: "0 0 12px rgba(249,115,22,0.35)",
    },
    effects: true,
    swatch: ["#0A0A0C", "#F97316", "#FACC15"],
    accents: { main: "#F97316", sprint: "#FACC15" },
    display: FONT_STACKS.grotesk,
    radius: { card: "4px", ctl: "3px", pill: "3px", bar: "2px" },
    grid: { color: "rgba(249,115,22,0.09)", size: "32px", scan: "0.35" },
    c: {
      bg: "#0A0A0C", panel: "#141418", panel2: "#1C1C22", blur: "rgba(10,10,12,0.85)",
      text: "#F4F4F5", dim: "#A1A1AA", faint: "#71717A",
      border: "rgba(244,244,245,0.14)", borderSoft: "rgba(244,244,245,0.07)", borderHover: "rgba(249,115,22,0.5)",
      track: "rgba(244,244,245,0.10)", onAccent: "#0A0A0C", onAccentSoft: "rgba(10,10,12,0.85)",
      ok: "#4ADE80", warn: "#FBBF24", err: "#F87171", info: "#38BDF8",
    },
  },
  chlorophyll: {
    name: "Chlorophyll",
    mode: "light",
    palette: "light",
    styleCategory: "minimal",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 16px -4px rgba(20,83,45,0.06)",
      pop: "0 10px 28px -6px rgba(20,83,45,0.12)",
      btn: "0 2px 8px rgba(22,101,52,0.15)",
    },
    effects: true,
    swatch: ["#F0F4EF", "#15803D", "#65A30D"],
    accents: { main: "#15803D", sprint: "#65A30D" },
    display: FONT_STACKS.serif,
    radius: { card: "6px", ctl: "4px", pill: "4px", bar: "2px" },
    grid: { color: "rgba(21,128,61,0.07)", size: "42px", scan: "0" },
    c: {
      bg: "#F0F4EF", panel: "#F7FAF6", panel2: "#E1EADF", blur: "rgba(240,244,239,0.9)",
      text: "#122417", dim: "#3B5742", faint: "#64806A",
      border: "rgba(18,36,23,0.14)", borderSoft: "rgba(18,36,23,0.07)", borderHover: "rgba(21,128,61,0.4)",
      track: "rgba(18,36,23,0.09)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#15803D", warn: "#A16207", err: "#B91C1C", info: "#0F766E",
    },
  },
  oxide: {
    name: "Oxide",
    mode: "dark",
    palette: "muted",
    styleCategory: "dark",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 18px -2px rgba(234,88,12,0.10)",
      pop: "0 8px 26px -4px rgba(234,88,12,0.18)",
      btn: "0 2px 10px rgba(234,88,12,0.25)",
    },
    effects: false,
    swatch: ["#12100E", "#EA580C", "#D6D3D1"],
    accents: { main: "#EA580C", sprint: "#A8A29E" },
    display: FONT_STACKS.mono,
    radius: { card: "2px", ctl: "2px", pill: "2px", bar: "1px" },
    grid: { color: "rgba(234,88,12,0.08)", size: "34px", scan: "0" },
    c: {
      bg: "#12100E", panel: "#1A1715", panel2: "#272320", blur: "rgba(18,16,14,0.85)",
      text: "#F5F5F4", dim: "#A8A29E", faint: "#78716C",
      border: "rgba(245,245,244,0.14)", borderSoft: "rgba(245,245,244,0.07)", borderHover: "rgba(234,88,12,0.45)",
      track: "rgba(245,245,244,0.10)", onAccent: "#12100E", onAccentSoft: "rgba(18,16,14,0.88)",
      ok: "#10B981", warn: "#F59E0B", err: "#EF4444", info: "#A8A29E",
    },
  },
  ion: {
    name: "Ion",
    mode: "dark",
    palette: "dark",
    styleCategory: "dark",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 20px -2px rgba(6,182,212,0.15)",
      pop: "0 10px 32px -4px rgba(6,182,212,0.28)",
      btn: "0 0 14px rgba(6,182,212,0.4)",
    },
    effects: true,
    swatch: ["#070B15", "#06B6D4", "#8B5CF6"],
    accents: { main: "#06B6D4", sprint: "#8B5CF6" },
    display: FONT_STACKS.mono,
    radius: { card: "4px", ctl: "3px", pill: "3px", bar: "2px" },
    grid: { color: "rgba(6,182,212,0.10)", size: "28px", scan: "0.45" },
    c: {
      bg: "#070B15", panel: "#0E1526", panel2: "#162038", blur: "rgba(7,11,21,0.82)",
      text: "#F1F5F9", dim: "#94A3B8", faint: "#64748B",
      border: "rgba(241,245,249,0.14)", borderSoft: "rgba(241,245,249,0.07)", borderHover: "rgba(6,182,212,0.55)",
      track: "rgba(241,245,249,0.10)", onAccent: "#070B15", onAccentSoft: "rgba(7,11,21,0.85)",
      ok: "#34D399", warn: "#FBBF24", err: "#F87171", info: "#06B6D4",
    },
  },
  cinnabar: {
    name: "Cinnabar",
    mode: "light",
    palette: "light",
    styleCategory: "minimal",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 16px -4px rgba(153,27,27,0.06)",
      pop: "0 10px 28px -6px rgba(153,27,27,0.12)",
      btn: "0 2px 8px rgba(185,28,28,0.15)",
    },
    effects: true,
    swatch: ["#F5EFE6", "#991B1B", "#44403C"],
    accents: { main: "#991B1B", sprint: "#44403C" },
    display: FONT_STACKS.serif,
    radius: { card: "4px", ctl: "3px", pill: "3px", bar: "2px" },
    grid: { color: "rgba(153,27,27,0.07)", size: "40px", scan: "0" },
    c: {
      bg: "#F5EFE6", panel: "#FAF6F0", panel2: "#EAE0D3", blur: "rgba(245,239,230,0.9)",
      text: "#1C1917", dim: "#57534E", faint: "#78716C",
      border: "rgba(28,25,23,0.15)", borderSoft: "rgba(28,25,23,0.08)", borderHover: "rgba(153,27,27,0.4)",
      track: "rgba(28,25,23,0.09)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#3F6212", warn: "#B45309", err: "#9F1239", info: "#1E3A5F",
    },
  },
  halide: {
    name: "Halide",
    mode: "light",
    palette: "light",
    styleCategory: "minimal",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 16px -4px rgba(13,148,136,0.06)",
      pop: "0 10px 28px -6px rgba(13,148,136,0.12)",
      btn: "0 2px 8px rgba(13,148,136,0.15)",
    },
    effects: false,
    swatch: ["#EEF2F6", "#0D9488", "#D97706"],
    accents: { main: "#0D9488", sprint: "#D97706" },
    display: FONT_STACKS.mono,
    radius: { card: "2px", ctl: "2px", pill: "2px", bar: "1px" },
    grid: { color: "rgba(13,148,136,0.07)", size: "30px", scan: "0" },
    c: {
      bg: "#EEF2F6", panel: "#F8FAFC", panel2: "#DEE5EC", blur: "rgba(238,242,246,0.9)",
      text: "#0F172A", dim: "#475569", faint: "#64748B",
      border: "rgba(15,23,42,0.15)", borderSoft: "rgba(15,23,42,0.08)", borderHover: "rgba(13,148,136,0.45)",
      track: "rgba(15,23,42,0.09)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#047857", warn: "#D97706", err: "#BE123C", info: "#0369A1",
    },
  },
  voltaic: {
    name: "Voltaic",
    mode: "dark",
    palette: "dark",
    styleCategory: "neobrutalism",
    borderWidth: "2.5px",
    shadows: {
      card: "4px 4px 0px #D9F99D",
      pop: "6px 6px 0px #D9F99D",
      btn: "3px 3px 0px #D9F99D",
    },
    effects: true,
    swatch: ["#08080A", "#D9F99D", "#FAFAFA"],
    accents: { main: "#D9F99D", sprint: "#FAFAFA" },
    display: FONT_STACKS.grotesk,
    radius: { card: "0px", ctl: "0px", pill: "0px", bar: "0px" },
    grid: { color: "rgba(217,249,157,0.10)", size: "40px", scan: "0.4" },
    c: {
      bg: "#08080A", panel: "#121216", panel2: "#1A1A22", blur: "rgba(8,8,10,0.85)",
      text: "#FAFAFA", dim: "#A1A1AA", faint: "#71717A",
      border: "#D9F99D", borderSoft: "rgba(217,249,157,0.3)", borderHover: "#FAFAFA",
      track: "rgba(250,250,250,0.12)", onAccent: "#08080A", onAccentSoft: "rgba(8,8,10,0.9)",
      ok: "#A3E635", warn: "#FACC15", err: "#FB7185", info: "#67E8F9",
    },
  },
  marina: {
    name: "Marina",
    mode: "light",
    palette: "light",
    styleCategory: "minimal",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 16px -4px rgba(2,132,199,0.06)",
      pop: "0 10px 28px -6px rgba(2,132,199,0.12)",
      btn: "0 2px 8px rgba(2,132,199,0.15)",
    },
    effects: true,
    swatch: ["#ECF5F8", "#0284C7", "#F43F5E"],
    accents: { main: "#0284C7", sprint: "#F43F5E" },
    display: FONT_STACKS.grotesk,
    radius: { card: "6px", ctl: "4px", pill: "4px", bar: "2px" },
    grid: { color: "rgba(2,132,199,0.08)", size: "38px", scan: "0" },
    c: {
      bg: "#ECF5F8", panel: "#F6FAFC", panel2: "#D8E9F0", blur: "rgba(236,245,248,0.9)",
      text: "#082F49", dim: "#335C78", faint: "#5B809B",
      border: "rgba(8,47,73,0.14)", borderSoft: "rgba(8,47,73,0.07)", borderHover: "rgba(2,132,199,0.45)",
      track: "rgba(8,47,73,0.09)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#0D9488", warn: "#C2410C", err: "#BE123C", info: "#0284C7",
    },
  },
  popart: {
    name: "Pop Brutal",
    mode: "light",
    palette: "light",
    styleCategory: "neobrutalism",
    borderWidth: "2.5px",
    shadows: {
      card: "4px 4px 0px #0F172A",
      pop: "6px 6px 0px #0F172A",
      btn: "3px 3px 0px #0F172A",
    },
    effects: true,
    swatch: ["#FFFDF7", "#FF2E93", "#00F0FF"],
    accents: { main: "#FF2E93", sprint: "#00F0FF" },
    display: FONT_STACKS.grotesk,
    radius: { card: "0px", ctl: "0px", pill: "0px", bar: "0px" },
    grid: { color: "rgba(255,46,147,0.08)", size: "24px", scan: "0" },
    c: {
      bg: "#FFFDF7", panel: "#FFFDF7", panel2: "#F7F2E8", blur: "rgba(255,253,247,0.95)",
      text: "#0F172A", dim: "#334155", faint: "#64748B",
      border: "#0F172A", borderSoft: "rgba(15,23,42,0.2)", borderHover: "#FF2E93",
      track: "rgba(15,23,42,0.12)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#10B981", warn: "#F59E0B", err: "#FF2E93", info: "#00F0FF",
    },
  },
  cyberpunk: {
    name: "Cyberpunk",
    mode: "dark",
    palette: "dark",
    styleCategory: "neobrutalism",
    borderWidth: "2.5px",
    shadows: {
      card: "4px 4px 0px #00E5FF",
      pop: "6px 6px 0px #00E5FF",
      btn: "3px 3px 0px #00E5FF",
    },
    effects: true,
    swatch: ["#090910", "#FF0055", "#00E5FF"],
    accents: { main: "#FF0055", sprint: "#00E5FF" },
    display: FONT_STACKS.mono,
    radius: { card: "0px", ctl: "0px", pill: "0px", bar: "0px" },
    grid: { color: "rgba(0,229,255,0.12)", size: "32px", scan: "0.5" },
    c: {
      bg: "#090910", panel: "#12121E", panel2: "#1C1C2E", blur: "rgba(9,9,16,0.85)",
      text: "#F8FAFC", dim: "#CBD5E1", faint: "#94A3B8",
      border: "#FF0055", borderSoft: "rgba(255,0,85,0.3)", borderHover: "#00E5FF",
      track: "rgba(248,250,252,0.12)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#00FF66", warn: "#FFB700", err: "#FF0055", info: "#00E5FF",
    },
  },
  synthwave: {
    name: "Synthwave",
    mode: "dark",
    palette: "dark",
    styleCategory: "neobrutalism",
    borderWidth: "2.5px",
    shadows: {
      card: "4px 4px 0px #F43F5E",
      pop: "6px 6px 0px #F59E0B",
      btn: "3px 3px 0px #F43F5E",
    },
    effects: true,
    swatch: ["#13091F", "#F43F5E", "#F59E0B"],
    accents: { main: "#F43F5E", sprint: "#F59E0B" },
    display: FONT_STACKS.grotesk,
    radius: { card: "0px", ctl: "0px", pill: "0px", bar: "0px" },
    grid: { color: "rgba(244,63,94,0.10)", size: "36px", scan: "0.4" },
    c: {
      bg: "#13091F", panel: "#1D102F", panel2: "#291842", blur: "rgba(19,9,31,0.85)",
      text: "#FAFAF9", dim: "#D6D3D1", faint: "#A8A29E",
      border: "#F43F5E", borderSoft: "rgba(244,63,94,0.3)", borderHover: "#F59E0B",
      track: "rgba(250,250,249,0.12)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#10B981", warn: "#F59E0B", err: "#F43F5E", info: "#A855F7",
    },
  },
  sakura: {
    name: "Sakura",
    mode: "light",
    palette: "light",
    styleCategory: "minimal",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 16px -4px rgba(225,29,72,0.08)",
      pop: "0 10px 28px -6px rgba(225,29,72,0.14)",
      btn: "0 2px 8px rgba(225,29,72,0.15)",
    },
    effects: true,
    swatch: ["#FDF7F9", "#E11D48", "#F472B6"],
    accents: { main: "#E11D48", sprint: "#F472B6" },
    display: FONT_STACKS.serif,
    radius: { card: "8px", ctl: "5px", pill: "5px", bar: "3px" },
    grid: { color: "rgba(225,29,72,0.06)", size: "40px", scan: "0" },
    c: {
      bg: "#FDF7F9", panel: "#FFFFFF", panel2: "#F7ECF0", blur: "rgba(253,247,249,0.9)",
      text: "#1E1B1E", dim: "#524950", faint: "#827680",
      border: "rgba(225,29,72,0.18)", borderSoft: "rgba(225,29,72,0.08)", borderHover: "rgba(225,29,72,0.5)",
      track: "rgba(30,27,30,0.08)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#059669", warn: "#D97706", err: "#E11D48", info: "#9333EA",
    },
  },
  nordic: {
    name: "Nordic Frost",
    mode: "light",
    palette: "light",
    styleCategory: "minimal",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 16px -4px rgba(2,132,199,0.07)",
      pop: "0 10px 28px -6px rgba(2,132,199,0.14)",
      btn: "0 2px 8px rgba(2,132,199,0.15)",
    },
    effects: true,
    swatch: ["#F4F8FA", "#0284C7", "#0D9488"],
    accents: { main: "#0284C7", sprint: "#0D9488" },
    display: FONT_STACKS.grotesk,
    radius: { card: "6px", ctl: "4px", pill: "4px", bar: "2px" },
    grid: { color: "rgba(2,132,199,0.06)", size: "36px", scan: "0" },
    c: {
      bg: "#F4F8FA", panel: "#FFFFFF", panel2: "#E4EFF4", blur: "rgba(244,248,250,0.9)",
      text: "#0F172A", dim: "#475569", faint: "#64748B",
      border: "rgba(2,132,199,0.16)", borderSoft: "rgba(2,132,199,0.08)", borderHover: "rgba(2,132,199,0.45)",
      track: "rgba(15,23,42,0.08)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#0D9488", warn: "#D97706", err: "#E11D48", info: "#0284C7",
    },
  },
  midnight: {
    name: "Midnight OLED",
    mode: "dark",
    palette: "dark",
    styleCategory: "dark",
    borderWidth: "1px",
    shadows: {
      card: "0 4px 20px -2px rgba(168,85,247,0.16)",
      pop: "0 10px 32px -4px rgba(168,85,247,0.30)",
      btn: "0 0 14px rgba(168,85,247,0.4)",
    },
    effects: true,
    swatch: ["#050608", "#A855F7", "#38BDF8"],
    accents: { main: "#A855F7", sprint: "#38BDF8" },
    display: FONT_STACKS.mono,
    radius: { card: "6px", ctl: "4px", pill: "4px", bar: "2px" },
    grid: { color: "rgba(168,85,247,0.10)", size: "32px", scan: "0.3" },
    c: {
      bg: "#050608", panel: "#0C0E14", panel2: "#151824", blur: "rgba(5,6,8,0.85)",
      text: "#F8FAFC", dim: "#94A3B8", faint: "#64748B",
      border: "rgba(168,85,247,0.22)", borderSoft: "rgba(168,85,247,0.10)", borderHover: "rgba(168,85,247,0.55)",
      track: "rgba(248,250,252,0.10)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#34D399", warn: "#FBBF24", err: "#F87171", info: "#38BDF8",
    },
  },
};

export const THEME_ORDER: ThemeKey[] = [
  "doodle",
  "popart",
  "voltaic",
  "synthwave",
  "cyberpunk",
  "sakura",
  "nordic",
  "signal",
  "folio",
  "chlorophyll",
  "oxide",
  "ion",
  "cinnabar",
  "halide",
  "marina",
  "midnight",
  "afterburn",
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
    /* Neobrutalism & Minimal style tokens */
    "--shadow-card": t.shadows.card,
    "--shadow-pop": t.shadows.pop,
    "--shadow-btn-hover": t.shadows.btn,
    "--border-width": t.borderWidth,
    "--style-category": t.styleCategory,
  } as CSSProperties;
}

