/**
 * DualTrack Console — client application shell.
 * Curriculum data lives in /data; styles in app/dualtrack.css;
 * Anthropic calls go through /api/claude; state via localStorage.
 */
// @ts-nocheck — large migrated SPA; typed boundaries live in lib/ and app/api/
"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  createContext,
  useContext,
} from "react";
import { callClaude } from "@/lib/claude-client";
import {
  hasStorage,
  loadState,
  saveState,
  clearState,
} from "@/lib/storage";

import DAYS_365_RAW from "@/data/days-365.json";
import DAYS_45_RAW from "@/data/days-45.json";
import DOMAIN_META from "@/data/domains.json";
import type { DayEntry } from "@/lib/types";

const DAYS_365 = DAYS_365_RAW as DayEntry[];
const DAYS_45 = DAYS_45_RAW as DayEntry[];

/* ============================== THEMES ============================== */
const DOMAIN_PALETTES = {
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
  sans: "var(--font-inter), -apple-system, sans-serif",
  serif: "var(--font-source-serif), Georgia, serif",
  grotesk: "var(--font-space-grotesk), var(--font-inter), sans-serif",
};

const THEMES = {
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

const THEME_ORDER = ["bloom", "ledger", "terminal", "pebble", "graphite", "parchment", "blueprint", "matte"];

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function themeVars(t) {
  const c = t.c;
  return {
    "--bg": c.bg, "--bg-panel": c.panel, "--bg-panel-2": c.panel2, "--bg-blur": c.blur,
    "--text": c.text, "--text-dim": c.dim, "--text-faint": c.faint,
    "--border": c.border, "--border-soft": c.borderSoft, "--border-hover": c.borderHover,
    "--track": c.track, "--on-accent": c.onAccent, "--on-accent-soft": c.onAccentSoft,
    "--ok": c.ok, "--warn": c.warn, "--err": c.err, "--info": c.info,
    "--accent-main": t.accents.main, "--accent-sprint": t.accents.sprint,
    "--display": t.display, "--mono": FONT_STACKS.mono, "--sans": FONT_STACKS.sans,
    "--r-card": t.radius.card, "--r-ctl": t.radius.ctl, "--r-pill": t.radius.pill, "--r-bar": t.radius.bar,
    "--grid-color": t.grid.color, "--grid-size": t.grid.size, "--scan-op": t.grid.scan,
    "--dot-glow": t.effects ? "0 0 8px currentColor" : "none",
  };
}

const ThemeCtx = createContext({ theme: THEMES.terminal, domainColors: DOMAIN_PALETTES.dark });

const CAMPAIGNS = {
  main: {
    key: "main",
    name: "OPERATION LONGHAUL",
    subtitle: "365-Day Full-Stack & Systems Campaign",
    days: DAYS_365,
    unit: "day",
    totalDays: 365,
  },
  sprint: {
    key: "sprint",
    name: "OPERATION FASTBURN",
    subtitle: "45-Day AI / LLM Engineer Intensive",
    days: DAYS_45,
    unit: "day",
    totalDays: 45,
  },
};

/* ============================== PERIODS ============================== */
/* Boundaries mirror the actual section splits in each roadmap document. */
const QUARTERS_365 = [
  { label: "Q1", sub: "Foundations of depth", start: 1, end: 90 },
  { label: "Q2", sub: "Scale and systems", start: 91, end: 181 },
  { label: "Q3", sub: "Frontier engineering", start: 182, end: 273 },
  { label: "Q4", sub: "Synthesis", start: 274, end: 365 },
];

const MONTHS_365 = [
  { label: "Jan", sub: "New-stack ramp-up", start: 1, end: 31 },
  { label: "Feb", sub: "Stack depth", start: 32, end: 59 },
  { label: "Mar", sub: "Core systems", start: 60, end: 90 },
  { label: "Apr", sub: "Scale patterns", start: 91, end: 120 },
  { label: "May", sub: "Deep internals", start: 121, end: 151 },
  { label: "Jun", sub: "Reliability", start: 152, end: 181 },
  { label: "Jul", sub: "Advanced data", start: 182, end: 212 },
  { label: "Aug", sub: "Storage and search", start: 213, end: 243 },
  { label: "Sep", sub: "Retrieval and infra", start: 244, end: 273 },
  { label: "Oct", sub: "Emerging frontiers", start: 274, end: 304 },
  { label: "Nov", sub: "Operations", start: 305, end: 334 },
  { label: "Dec", sub: "Capstone", start: 335, end: 365 },
];

const WEEKS_45 = [
  { label: "Week 1", sub: "Model internals", start: 1, end: 7 },
  { label: "Week 2", sub: "Fine-tuning", start: 8, end: 14 },
  { label: "Week 3", sub: "Embeddings and RAG", start: 15, end: 21 },
  { label: "Week 4", sub: "Agents", start: 22, end: 28 },
  { label: "Week 5", sub: "Serving infra", start: 29, end: 35 },
  { label: "Week 6", sub: "LLMOps and security", start: 36, end: 42 },
  { label: "Week 7", sub: "Multimodal capstone", start: 43, end: 45 },
];

function buildWeeks(totalDays) {
  const out = [];
  for (let start = 1; start <= totalDays; start += 7) {
    const end = Math.min(start + 6, totalDays);
    out.push({ label: `W${out.length + 1}`, sub: `Days ${start}-${end}`, start, end });
  }
  return out;
}

function periodsFor(campaignKey, scope, totalDays) {
  if (scope === "all") return null;
  if (campaignKey === "main") {
    if (scope === "quarter") return QUARTERS_365;
    if (scope === "month") return MONTHS_365;
    return buildWeeks(totalDays);
  }
  if (scope === "week") return WEEKS_45;
  return null;
}

function scopesFor(campaignKey) {
  return campaignKey === "main"
    ? [{ key: "all", label: "All days" }, { key: "quarter", label: "Quarter" }, { key: "month", label: "Month" }, { key: "week", label: "Week" }]
    : [{ key: "all", label: "All days" }, { key: "week", label: "Week" }];
}

/* ============================== SPACED REPETITION ============================== */
const DAY_MS = 86400000;
const SRS_INTERVALS = [7, 30, 90, 180];
const LAPSE_DAYS = 3;

function seedReview(now) {
  return { idx: 0, due: now + SRS_INTERVALS[0] * DAY_MS, graduated: false, reps: 0, last: now };
}

function nextReview(entry, outcome, now) {
  const cur = entry && typeof entry.idx === "number" ? entry.idx : 0;
  const reps = (entry && entry.reps ? entry.reps : 0) + 1;
  if (outcome === "solid") {
    const idx = cur + 1;
    if (idx >= SRS_INTERVALS.length) {
      return { idx: SRS_INTERVALS.length - 1, due: null, graduated: true, reps, last: now };
    }
    return { idx, due: now + SRS_INTERVALS[idx] * DAY_MS, graduated: false, reps, last: now };
  }
  if (outcome === "shaky") {
    return { idx: cur, due: now + SRS_INTERVALS[cur] * DAY_MS, graduated: false, reps, last: now };
  }
  return { idx: 0, due: now + LAPSE_DAYS * DAY_MS, graduated: false, reps, last: now };
}

function dueList(srs, allDays, now) {
  const out = [];
  for (const d of allDays) {
    const e = srs[d.id];
    if (!e || e.graduated || !e.due) continue;
    if (e.due <= now) out.push({ day: d, entry: e });
  }
  out.sort((a, b) => a.entry.due - b.entry.due);
  return out;
}

function relativeDue(ts, now) {
  if (!ts) return "graduated";
  const diff = Math.round((ts - now) / DAY_MS);
  if (diff <= 0) return "due now";
  if (diff === 1) return "tomorrow";
  return `in ${diff} days`;
}

/* ============================== RELATED DAYS ============================== */
const STOPWORDS = new Set(["the","and","for","with","from","into","that","this","your","are","its",
  "how","why","what","when","design","designs","patterns","pattern","internals","internal","deep","dive",
  "advanced","modern","production","systems","system","using","use","based","across","over","under","vs"]);

function tokenizeTopic(t) {
  return t.toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .split(/[\s\-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function buildRelatedIndex(days) {
  const dayTokens = new Map();
  const df = new Map();
  for (const d of days) {
    const set = new Set();
    d.topics.forEach((t) => tokenizeTopic(t).forEach((w) => set.add(w)));
    dayTokens.set(d.id, set);
    set.forEach((w) => df.set(w, (df.get(w) || 0) + 1));
  }
  const n = days.length;
  const idf = new Map();
  df.forEach((c, w) => idf.set(w, Math.log(n / (1 + c))));
  return { dayTokens, idf };
}

function relatedDaysFor(day, days, index, limit) {
  const mine = index.dayTokens.get(day.id);
  if (!mine) return [];
  const scored = [];
  for (const other of days) {
    if (other.id === day.id) continue;
    const theirs = index.dayTokens.get(other.id);
    let score = 0;
    const shared = [];
    mine.forEach((w) => {
      if (theirs.has(w)) {
        const weight = Math.max(0.15, index.idf.get(w) || 0);
        score += weight;
        shared.push({ w, weight });
      }
    });
    if (score <= 0) continue;
    const sharedDomain = other.domains.some((dm) => day.domains.includes(dm));
    if (sharedDomain) score += 0.45;
    shared.sort((a, b) => b.weight - a.weight);
    scored.push({ day: other, score, terms: shared.slice(0, 3).map((x) => x.w) });
  }
  scored.sort((a, b) => b.score - a.score || a.day.day - b.day.day);
  return scored.filter((x) => x.score >= 1.1).slice(0, limit || 3);
}

function stripFences(t) {
  return t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

/* ============================== FILE IO ============================== */
function downloadText(filename, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

/* ============================== HELPERS ============================== */
const XP_PER_TOPIC = 15;
const XP_PER_DAY_BONUS = 10;

function levelFromXp(xp) {
  // level curve: level n requires n*140 cumulative xp roughly
  let level = 1;
  let remain = xp;
  let need = 120;
  while (remain >= need) {
    remain -= need;
    level += 1;
    need = Math.round(need * 1.11);
  }
  return { level, into: remain, need };
}

function rankForLevel(level) {
  const ranks = [
    [1, "Recruit"],
    [4, "Operator"],
    [8, "Specialist"],
    [13, "Engineer II"],
    [19, "Senior Engineer"],
    [26, "Staff Candidate"],
    [34, "Staff Engineer"],
    [43, "Principal Track"],
    [53, "Distinguished Track"],
    [65, "Architect"],
  ];
  let r = ranks[0][1];
  for (const [lvl, name] of ranks) {
    if (level >= lvl) r = name;
  }
  return r;
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* persistence: @/lib/storage */

/* ============================== ICONS (inline svg, no deps) ============================== */
const Icon = {
  Bolt: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Flame: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7.5 7.5 0 1 1-15 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Target: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  Terminal: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Grid: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  List: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Trophy: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4" />
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Note: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  Book: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  Calendar: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Send: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Download: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Cloud: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  Rotate: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  ),
};

/* ============================== ROOT APP ============================== */
export default function DualTrackConsole() {
  const [progress, setProgress] = useState({}); // { "365-1": {0:bool, 1:bool} , ...}
  const [notes, setNotes] = useState({});       // { "365-1": "text" }
  const [activeCampaign, setActiveCampaign] = useState("main");
  const [view, setView] = useState("console"); // console | grid | log
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const [scope, setScope] = useState("all");     // all | quarter | month | week
  const [periodIdx, setPeriodIdx] = useState(0);
  const [toast, setToast] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const [refs, setRefs] = useState({}); // { dayId: {text, topic, style, at} }
  const [srs, setSrs] = useState({});   // { dayId: {idx, due, graduated, reps, last} }
  const [log, setLog] = useState([]);   // [{d: dayId, i: topicIdx, at: ts}]
  const [modal, setModal] = useState(null); // {kind, day?}
  const [themeKey, setThemeKey] = useState("terminal");
  const [saveStatus, setSaveStatus] = useState("loading"); // loading | idle | saving | saved | error | off
  const [confirmReset, setConfirmReset] = useState(false);
  const toastTimer = useRef(null);
  const saveTimer = useRef(null);
  const didLoad = useRef(false);

  const theme = THEMES[themeKey] || THEMES.terminal;
  const domainColors = DOMAIN_PALETTES[theme.palette];

  const themedCampaigns = useMemo(() => {
    const out = {};
    Object.keys(CAMPAIGNS).forEach((k) => {
      const accent = theme.accents[k === "main" ? "main" : "sprint"];
      out[k] = {
        ...CAMPAIGNS[k],
        accent,
        glow: theme.effects ? hexToRgba(accent, 0.35) : "transparent",
      };
    });
    return out;
  }, [theme]);

  const campaign = themedCampaigns[activeCampaign];

  /* ---------- load saved state once on mount ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasStorage()) {
        if (!cancelled) { didLoad.current = true; setSaveStatus("off"); }
        return;
      }
      const saved = await loadState();
      if (cancelled) return;
      if (saved) {
        if (saved.progress) setProgress(saved.progress);
        if (saved.notes) setNotes(saved.notes);
        if (saved.refs) setRefs(saved.refs);
        if (saved.srs) setSrs(saved.srs);
        if (Array.isArray(saved.log)) setLog(saved.log);
        if (saved.themeKey && THEMES[saved.themeKey]) setThemeKey(saved.themeKey);
      }
      didLoad.current = true;
      setSaveStatus("idle");
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------- debounced autosave whenever progress or notes change ---------- */
  useEffect(() => {
    if (!didLoad.current) return;
    if (!hasStorage()) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await saveState({ progress, notes, refs, srs, log, themeKey, updatedAt: Date.now() });
      setSaveStatus(ok ? "saved" : "error");
      if (ok) setTimeout(() => setSaveStatus((cur) => (cur === "saved" ? "idle" : cur)), 1600);
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [progress, notes, refs, srs, log, themeKey]);

  /* ---------- keep scope valid when switching campaigns ---------- */
  useEffect(() => {
    const allowed = scopesFor(activeCampaign).map((x) => x.key);
    if (!allowed.includes(scope)) setScope("all");
    setPeriodIdx(0);
  }, [activeCampaign]);

  const setRef = useCallback((dayId, payload) => {
    setRefs((prev) => {
      const next = { ...prev };
      if (payload) next[dayId] = payload;
      else delete next[dayId];
      return next;
    });
  }, []);

  const appendNote = useCallback((dayId, text) => {
    setNotes((prev) => {
      const cur = prev[dayId] || "";
      const joined = cur.trim() ? cur.trimEnd() + "\n\n" + text : text;
      return { ...prev, [dayId]: joined };
    });
  }, []);

  const setNote = useCallback((dayId, text) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text && text.trim()) next[dayId] = text;
      else delete next[dayId];
      return next;
    });
  }, []);

  const handleReset = useCallback(async () => {
    setProgress({});
    setNotes({});
    setRefs({});
    setSrs({});
    setLog([]);
    await clearState();
    setConfirmReset(false);
    setSaveStatus("idle");
  }, []);

  const setTopicDone = useCallback((dayId, topicIdx, done) => {
    setProgress((prev) => {
      const cur = prev[dayId] || {};
      const next = { ...cur, [topicIdx]: done };
      return { ...prev, [dayId]: next };
    });
  }, []);

  const isDayComplete = useCallback((day) => {
    const p = progress[day.id];
    if (!p) return false;
    return day.topics.every((_, i) => p[i]);
  }, [progress]);

  const topicsDoneCount = useCallback((day) => {
    const p = progress[day.id];
    if (!p) return 0;
    return day.topics.filter((_, i) => p[i]).length;
  }, [progress]);

  /* ---------- derived stats across BOTH campaigns ---------- */
  const globalStats = useMemo(() => {
    let totalTopics = 0, doneTopics = 0, daysComplete = 0, totalDaysAll = 0;
    Object.values(CAMPAIGNS).forEach((c) => {
      c.days.forEach((d) => {
        totalDaysAll += 1;
        totalTopics += d.topics.length;
        const p = progress[d.id];
        let allDone = true;
        d.topics.forEach((_, i) => {
          if (p && p[i]) doneTopics += 1;
          else allDone = false;
        });
        if (allDone && p) daysComplete += 1;
      });
    });
    const xp = doneTopics * XP_PER_TOPIC + daysComplete * XP_PER_DAY_BONUS;
    const { level, into, need } = levelFromXp(xp);
    return { totalTopics, doneTopics, daysComplete, totalDaysAll, xp, level, into, need, rank: rankForLevel(level) };
  }, [progress]);

  const campaignStats = useMemo(() => {
    const stats = {};
    Object.values(CAMPAIGNS).forEach((c) => {
      let doneTopics = 0, daysComplete = 0;
      const domainTally = {};
      c.days.forEach((d) => {
        const p = progress[d.id];
        let allDone = true;
        d.topics.forEach((_, i) => {
          if (p && p[i]) doneTopics += 1;
          else allDone = false;
        });
        if (allDone && p) daysComplete += 1;
        d.domains.forEach((dom, i) => {
          if (!domainTally[dom]) domainTally[dom] = { total: 0, done: 0 };
          domainTally[dom].total += 1;
          if (p && p[i]) domainTally[dom].done += 1;
        });
      });
      // streak: consecutive days (from day 1) fully complete
      let streak = 0;
      for (const d of c.days) {
        if (isDayComplete(d)) streak += 1; else break;
      }
      // current active day = first incomplete day
      const activeDay = c.days.find((d) => !isDayComplete(d)) || c.days[c.days.length - 1];
      stats[c.key] = {
        doneTopics,
        totalTopics: c.days.length * 2,
        daysComplete,
        totalDays: c.days.length,
        pct: Math.round((doneTopics / (c.days.length * 2)) * 100),
        domainTally,
        streak,
        activeDay,
      };
    });
    return stats;
  }, [progress, isDayComplete]);

  const fireToast = useCallback((msg, kind) => {
    setToast({ msg, kind, id: Math.random() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const handleToggleTopic = useCallback((day, idx, campaignObj) => {
    const currentlyDone = !!(progress[day.id] && progress[day.id][idx]);
    const willBeDone = !currentlyDone;
    const now = Date.now();
    setTopicDone(day.id, idx, willBeDone);

    setLog((prev) => willBeDone
      ? [...prev, { d: day.id, i: idx, at: now }]
      : prev.filter((e) => !(e.d === day.id && e.i === idx)));

    const otherIdxAll = day.topics.map((_, i) => i).filter((i) => i !== idx);
    const othersDone = otherIdxAll.every((i) => !!(progress[day.id] && progress[day.id][i]));
    if (willBeDone && othersDone) {
      setSrs((prev) => (prev[day.id] ? prev : { ...prev, [day.id]: seedReview(now) }));
    }
    if (!willBeDone) {
      setSrs((prev) => {
        if (!prev[day.id]) return prev;
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
    }

    if (willBeDone) {
      fireToast(`+${XP_PER_TOPIC} XP · ${day.topics[idx]}`, "xp");
      // check if this completes the day
      const otherIdx = idx === 0 ? 1 : 0;
      const otherDone = day.topics.length === 1 ? true : !!(progress[day.id] && progress[day.id][otherIdx]);
      if (otherDone || day.topics.length === 1) {
        setTimeout(() => {
          setConfetti({ id: Math.random(), color: campaignObj.accent });
          fireToast(`DAY ${day.day} COMPLETE · +${XP_PER_DAY_BONUS} bonus XP`, "day");
          setTimeout(() => setConfetti(null), 1400);
        }, 250);
      }
    }
  }, [progress, setTopicDone, fireToast]);

  /* ---------- review grading ---------- */
  const gradeReview = useCallback((dayId, outcome) => {
    const now = Date.now();
    setSrs((prev) => ({ ...prev, [dayId]: nextReview(prev[dayId], outcome, now) }));
  }, []);

  /* ---------- import ---------- */
  const applyImport = useCallback((data) => {
    if (!data || typeof data !== "object") throw new Error("Not a DualTrack backup file");
    if (!data.progress && !data.notes) throw new Error("No progress or notes found in that file");
    setProgress(data.progress && typeof data.progress === "object" ? data.progress : {});
    setNotes(data.notes && typeof data.notes === "object" ? data.notes : {});
    setRefs(data.refs && typeof data.refs === "object" ? data.refs : {});
    setSrs(data.srs && typeof data.srs === "object" ? data.srs : {});
    setLog(Array.isArray(data.log) ? data.log : []);
    if (data.themeKey && THEMES[data.themeKey]) setThemeKey(data.themeKey);
  }, []);

  /* ---------- period list with per-period completion ---------- */
  const periods = useMemo(() => {
    const list = periodsFor(campaign.key, scope, campaign.totalDays);
    if (!list) return null;
    return list.map((p) => {
      let total = 0, done = 0;
      for (const d of campaign.days) {
        if (d.day < p.start || d.day > p.end) continue;
        const pr = progress[d.id];
        total += d.topics.length;
        d.topics.forEach((_, i) => { if (pr && pr[i]) done += 1; });
      }
      return { ...p, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    });
  }, [campaign, scope, progress]);

  /* ---------- when scope changes, jump to the period holding the active day ---------- */
  const activeDayNum = campaignStats[campaign.key].activeDay
    ? campaignStats[campaign.key].activeDay.day
    : 1;
  useEffect(() => {
    if (scope === "all") return;
    const list = periodsFor(campaign.key, scope, campaign.totalDays);
    if (!list) return;
    const idx = list.findIndex((p) => activeDayNum >= p.start && activeDayNum <= p.end);
    setPeriodIdx(idx >= 0 ? idx : 0);
  }, [scope]);

  const activePeriod = periods && periods[Math.min(periodIdx, periods.length - 1)];

  /* ---------- filtered days: period, then domain, then search ---------- */
  const filteredDays = useMemo(() => {
    let days = campaign.days;
    if (activePeriod) {
      days = days.filter((d) => d.day >= activePeriod.start && d.day <= activePeriod.end);
    }
    if (domainFilter) {
      days = days.filter((d) => d.domains.includes(domainFilter));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      days = days.filter((d) =>
        d.topics.some((t) => t.toLowerCase().includes(q)) ||
        String(d.day).includes(q) ||
        (notes[d.id] || "").toLowerCase().includes(q)
      );
    }
    return days;
  }, [campaign, domainFilter, query, activePeriod, notes]);

  /* ---------- related-days index (per campaign) ---------- */
  const relatedIndex = useMemo(() => buildRelatedIndex(campaign.days), [campaign]);
  const getRelated = useCallback(
    (day) => relatedDaysFor(day, campaign.days, relatedIndex, 3),
    [campaign, relatedIndex]
  );

  /* ---------- review queue ---------- */
  const reviewQueue = useMemo(() => {
    const all = [...CAMPAIGNS.main.days, ...CAMPAIGNS.sprint.days];
    return dueList(srs, all, Date.now());
  }, [srs]);

  const scheduledCount = useMemo(
    () => Object.values(srs).filter((e) => e && !e.graduated).length,
    [srs]
  );

  return (
    <ThemeCtx.Provider value={{ theme, domainColors }}>
    <div className={classNames("app-root", theme.mode === "light" && "is-light", !theme.effects && "no-fx")} style={themeVars(theme)}>
      <BackgroundFX accent={campaign.accent} effects={theme.effects} />
      <TopBar
        stats={globalStats}
        onOpenData={() => setModal({ kind: "export" })}
        themeKey={themeKey}
        setThemeKey={setThemeKey}
        saveStatus={saveStatus}
        noteCount={Object.keys(notes).length}
        confirmReset={confirmReset}
        setConfirmReset={setConfirmReset}
        onReset={handleReset}
      />
      <CampaignSwitcher
        active={activeCampaign}
        setActive={setActiveCampaign}
        campaignStats={campaignStats}
        campaigns={themedCampaigns}
      />
      <CampaignHero campaign={campaign} stats={campaignStats[campaign.key]} />
      <ViewTabs view={view} setView={setView} dueCount={reviewQueue.length} />

      {(view === "console" || view === "grid") && (
      <PeriodNav
        scopes={scopesFor(campaign.key)}
        scope={scope}
        setScope={setScope}
        periods={periods}
        periodIdx={periodIdx}
        setPeriodIdx={setPeriodIdx}
        accent={campaign.accent}
        activeDayNum={activeDayNum}
      />
      )}

      {(view === "console" || view === "grid") && (
      <div className="controls-row">
        <div className="search-wrap">
          <Icon.Search size={15} />
          <input
            className="search-input"
            placeholder={`Search ${campaign.totalDays} days of topics…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <DomainLegend
          tally={campaignStats[campaign.key].domainTally}
          active={domainFilter}
          setActive={setDomainFilter}
          accent={campaign.accent}
        />
      </div>
      )}

      {view === "console" && (
        <ConsoleView
          campaign={campaign}
          days={filteredDays}
          progress={progress}
          onToggle={handleToggleTopic}
          expandedDay={expandedDay}
          setExpandedDay={setExpandedDay}
          topicsDoneCount={topicsDoneCount}
          isDayComplete={isDayComplete}
          jumpTarget={campaignStats[campaign.key].activeDay}
          notes={notes}
          setNote={setNote}
          getRelated={getRelated}
          refs={refs}
          setRef={setRef}
          onJumpDay={(d) => { setExpandedDay(d.id); setScope("all"); }}
          onOpenTool={(kind, day) => setModal({ kind, day })}
          query={query}
        />
      )}
      {view === "grid" && (
        <GridView
          campaign={campaign}
          days={filteredDays}
          progress={progress}
          isDayComplete={isDayComplete}
          topicsDoneCount={topicsDoneCount}
          notes={notes}
          onOpenDay={(d) => { setExpandedDay(d.id); setView("console"); }}
        />
      )}
      {view === "review" && (
        <ReviewView
          queue={reviewQueue}
          srs={srs}
          notes={notes}
          scheduledCount={scheduledCount}
          onGrade={gradeReview}
          onOpenDay={(d) => {
            setActiveCampaign(d.id.startsWith("45") ? "sprint" : "main");
            setExpandedDay(d.id);
            setScope("all");
            setView("console");
          }}
        />
      )}
      {view === "weekly" && (
        <WeeklyView
          log={log}
          notes={notes}
          progress={progress}
          srs={srs}
          campaigns={themedCampaigns}
          activeCampaign={activeCampaign}
          onOpenDay={(d) => { setExpandedDay(d.id); setScope("all"); setView("console"); }}
          onExport={() => setModal({ kind: "export" })}
        />
      )}
      {view === "log" && (
        <LogView campaign={campaign} stats={campaignStats[campaign.key]} progress={progress} notes={notes} />
      )}

      {modal && (
        <ModalHost
          modal={modal}
          onClose={() => setModal(null)}
          notes={notes}
          refs={refs}
          setRef={setRef}
          appendNote={appendNote}
          progress={progress}
          srs={srs}
          log={log}
          themeKey={themeKey}
          onImport={applyImport}
          fireToast={fireToast}
        />
      )}

      <ToastLayer toast={toast} />
      {confetti && <ConfettiBurst key={confetti.id} color={confetti.color} />}
      <Footer />
    </div>
    </ThemeCtx.Provider>
  );
}

/* ============================== BACKGROUND FX ============================== */
function BackgroundFX({ accent, effects }) {
  return (
    <div className="bg-fx" aria-hidden="true">
      <div className="bg-grid" />
      <div
        className="bg-glow"
        style={{ background: `radial-gradient(620px circle at 20% 0%, ${hexToRgba(accent, effects ? 0.14 : 0.04)}, transparent 62%)` }}
      />
      <div className="bg-scanline" />
    </div>
  );
}

/* ============================== TOP BAR ============================== */
const SAVE_COPY = {
  loading: "Loading saved progress",
  idle: "Progress saved automatically",
  saving: "Saving",
  saved: "Saved",
  error: "Save failed - retrying on next change",
  off: "Storage unavailable - this session only",
};

function SaveIndicator({ status }) {
  const label = status === "saving" ? "Saving…"
    : status === "saved" ? "Saved"
    : status === "error" ? "Not saved"
    : status === "loading" ? "Loading…"
    : status === "off" ? "Session only"
    : "Autosaved";
  return (
    <div className={classNames("stat-chip", "save-chip", `save-${status}`)} title={SAVE_COPY[status]}>
      <span className="save-dot" />
      <span className="stat-chip-val">{label}</span>
    </div>
  );
}

function ThemePicker({ themeKey, setThemeKey }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = THEMES[themeKey];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="theme-wrap" ref={wrapRef}>
      <button
        className="stat-chip theme-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change theme"
      >
        <span className="theme-swatches">
          {current.swatch.map((col, i) => (
            <span key={i} className="theme-sw" style={{ background: col }} />
          ))}
        </span>
        <span className="stat-chip-val">{current.name}</span>
        <Icon.Chevron size={12} className={classNames("theme-chev", open && "theme-chev-open")} />
      </button>
      {open && (
        <div className="theme-menu" role="listbox">
          {THEME_ORDER.map((k) => {
            const t = THEMES[k];
            const isOn = k === themeKey;
            return (
              <button
                key={k}
                role="option"
                aria-selected={isOn}
                className={classNames("theme-item", isOn && "theme-item-active")}
                onClick={() => { setThemeKey(k); setOpen(false); }}
              >
                <span className="theme-swatches">
                  {t.swatch.map((col, i) => (
                    <span key={i} className="theme-sw" style={{ background: col }} />
                  ))}
                </span>
                <span className="theme-item-name">{t.name}</span>
                {isOn && <Icon.Check size={12} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopBar({ stats, themeKey, setThemeKey, saveStatus, noteCount, confirmReset, setConfirmReset, onReset, onOpenData }) {
  const pct = stats.need ? Math.min(100, Math.round((stats.into / stats.need) * 100)) : 0;
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-text">DUAL<span className="brand-accent">TRACK</span></span>
        </div>
        <span className="brand-sub">learning ops console</span>
      </div>
      <div className="topbar-right">
        <button className="stat-chip data-btn" onClick={onOpenData} title="Export or import your data">
          <Icon.Download size={13} />
          <span className="stat-chip-val">Data</span>
        </button>
        <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
        <SaveIndicator status={saveStatus} />
        {noteCount > 0 && (
          <div className="stat-chip" title={`${noteCount} ${noteCount === 1 ? "day has" : "days have"} notes`}>
            <Icon.Note size={13} />
            <span className="stat-chip-val">{noteCount}</span>
          </div>
        )}
        <div className="stat-chip">
          <Icon.Trophy size={14} />
          <span className="stat-chip-label">RANK</span>
          <span className="stat-chip-val">{stats.rank}</span>
        </div>
        <div className="stat-chip level-chip">
          <span className="level-badge">LV {stats.level}</span>
          <div className="xp-bar-mini">
            <div className="xp-bar-mini-fill" style={{ width: pct + "%" }} />
          </div>
          <span className="stat-chip-val">{stats.into}/{stats.need} XP</span>
        </div>
        <div className="stat-chip">
          <Icon.Bolt size={14} />
          <span className="stat-chip-val">{stats.xp.toLocaleString()} XP</span>
        </div>
        {confirmReset ? (
          <div className="reset-confirm">
            <span>Erase all progress and notes?</span>
            <button className="reset-yes" onClick={onReset}>Erase</button>
            <button className="reset-no" onClick={() => setConfirmReset(false)}>Keep</button>
          </div>
        ) : (
          <button className="stat-chip reset-btn" onClick={() => setConfirmReset(true)} title="Reset all progress and notes">
            <Icon.Rotate size={13} />
          </button>
        )}
      </div>
    </header>
  );
}

/* ============================== CAMPAIGN SWITCHER ============================== */
function CampaignSwitcher({ active, setActive, campaignStats, campaigns }) {
  return (
    <div className="switcher">
      {Object.values(campaigns).map((c) => {
        const st = campaignStats[c.key];
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            className={classNames("switcher-tab", isActive && "switcher-tab-active")}
            style={isActive ? { "--accent": c.accent, "--glow": c.glow } : undefined}
            onClick={() => setActive(c.key)}
          >
            <div className="switcher-tab-top">
              <span className="switcher-dot" style={{ background: c.accent }} />
              <span className="switcher-name">{c.name}</span>
            </div>
            <div className="switcher-sub">{c.subtitle}</div>
            <div className="switcher-progress-track">
              <div className="switcher-progress-fill" style={{ width: st.pct + "%", background: c.accent }} />
            </div>
            <div className="switcher-meta">
              <span>{st.daysComplete}/{st.totalDays} days</span>
              <span>{st.pct}%</span>
              {st.streak > 0 && (
                <span className="switcher-streak"><Icon.Flame size={11} />{st.streak}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================== CAMPAIGN HERO ============================== */
function CampaignHero({ campaign, stats }) {
  const activeDay = stats.activeDay;
  return (
    <div className="hero" style={{ "--accent": campaign.accent, "--glow": campaign.glow }}>
      <div className="hero-left">
        <div className="hero-eyebrow">ACTIVE CAMPAIGN</div>
        <h1 className="hero-title">{campaign.name}</h1>
        <p className="hero-sub">{campaign.subtitle}</p>
        <div className="hero-ring-row">
          <ProgressRing pct={stats.pct} accent={campaign.accent} />
          <div className="hero-metrics">
            <Metric label="Days Complete" value={`${stats.daysComplete} / ${stats.totalDays}`} />
            <Metric label="Topics Mastered" value={`${stats.doneTopics} / ${stats.totalTopics}`} />
            <Metric label="Current Streak" value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`} icon={stats.streak > 0 ? <Icon.Flame size={14} /> : null} />
          </div>
        </div>
      </div>
      {activeDay && (
        <div className="hero-right">
          <div className="next-mission-label">
            <Icon.Target size={13} /> NEXT MISSION
          </div>
          <div className="next-mission-card">
            <div className="next-mission-day">DAY {activeDay.day}</div>
            <ul className="next-mission-topics">
              {activeDay.topics.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <div className="metric-value">{icon}{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function ProgressRing({ pct, accent }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="progress-ring-wrap">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--track)" strokeWidth="8" />
        <circle
          cx="52" cy="52" r={r} fill="none" stroke={accent} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="progress-ring-label">{pct}%</div>
    </div>
  );
}

/* ============================== VIEW TABS ============================== */
function ViewTabs({ view, setView, dueCount }) {
  const tabs = [
    { key: "console", label: "Console", icon: Icon.Terminal },
    { key: "grid", label: "Grid", icon: Icon.Grid },
    { key: "review", label: "Review", icon: Icon.Rotate, badge: dueCount },
    { key: "weekly", label: "Weekly", icon: Icon.Calendar },
    { key: "log", label: "Analytics", icon: Icon.List },
  ];
  return (
    <div className="view-tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={classNames("view-tab", view === t.key && "view-tab-active")}
          onClick={() => setView(t.key)}
        >
          <t.icon size={13} /> {t.label}
          {t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ============================== PERIOD NAV ============================== */
function PeriodNav({ scopes, scope, setScope, periods, periodIdx, setPeriodIdx, accent, activeDayNum }) {
  const stripRef = useRef(null);

  useEffect(() => {
    if (!stripRef.current) return;
    const el = stripRef.current.querySelector('[data-period-active="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [periodIdx, scope]);

  return (
    <div className="period-nav" style={{ "--accent": accent }}>
      <div className="scope-row">
        {scopes.map((sc) => (
          <button
            key={sc.key}
            className={classNames("scope-btn", scope === sc.key && "scope-btn-active")}
            onClick={() => setScope(sc.key)}
          >
            {sc.label}
          </button>
        ))}
        {periods && (
          <div className="period-summary">
            {periods[Math.min(periodIdx, periods.length - 1)].done}/{periods[Math.min(periodIdx, periods.length - 1)].total} topics
            <span className="period-summary-sep">·</span>
            {periods[Math.min(periodIdx, periods.length - 1)].pct}%
          </div>
        )}
      </div>

      {periods && (
        <div className="period-strip" ref={stripRef}>
          {periods.map((p, i) => {
            const isActive = i === Math.min(periodIdx, periods.length - 1);
            const holdsCurrent = activeDayNum >= p.start && activeDayNum <= p.end;
            const complete = p.pct === 100;
            return (
              <button
                key={p.label + p.start}
                data-period-active={isActive ? "true" : "false"}
                className={classNames("period-chip", isActive && "period-chip-active", complete && "period-chip-complete")}
                onClick={() => setPeriodIdx(i)}
              >
                <div className="period-chip-top">
                  <span className="period-chip-label">{p.label}</span>
                  {holdsCurrent && <span className="period-here" title="Your current day is here" />}
                </div>
                <div className="period-chip-sub">{p.sub}</div>
                <div className="period-chip-track">
                  <div className="period-chip-fill" style={{ width: p.pct + "%" }} />
                </div>
                <div className="period-chip-meta">
                  <span>{p.start}-{p.end}</span>
                  <span>{p.pct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== DOMAIN LEGEND ============================== */
function DomainLegend({ tally, active, setActive, accent }) {
  const { domainColors } = useContext(ThemeCtx);
  const domains = Object.keys(DOMAIN_META).filter((k) => tally[k]);
  return (
    <div className="domain-legend">
      {domains.map((k) => {
        const meta = DOMAIN_META[k];
        const color = domainColors[k];
        const t = tally[k];
        const pct = t ? Math.round((t.done / t.total) * 100) : 0;
        const isActive = active === k;
        return (
          <button
            key={k}
            className={classNames("domain-chip", isActive && "domain-chip-active")}
            style={{ "--dot": color, borderColor: isActive ? color : undefined }}
            onClick={() => setActive(isActive ? null : k)}
            title={`${t.done}/${t.total} complete`}
          >
            <span className="domain-chip-dot" />
            {meta.label}
            <span className="domain-chip-pct">{pct}%</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================== CONSOLE VIEW ============================== */
function ConsoleView({ campaign, days, progress, onToggle, expandedDay, setExpandedDay, topicsDoneCount, isDayComplete, jumpTarget, notes, setNote, getRelated, onJumpDay, onOpenTool, query, refs, setRef }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (jumpTarget && listRef.current) {
      const el = listRef.current.querySelector(`[data-day-id="${jumpTarget.id}"]`);
      if (el) el.scrollIntoView({ block: "center" });
    }
  }, []);

  return (
    <div className="console-view" ref={listRef}>
      {days.length === 0 && <EmptyState />}
      {days.map((day) => {
        const done = topicsDoneCount(day);
        const complete = isDayComplete(day);
        const isExpanded = expandedDay === day.id;
        const isCurrent = jumpTarget && jumpTarget.id === day.id;
        return (
          <div
            key={day.id}
            data-day-id={day.id}
            className={classNames(
              "day-row",
              complete && "day-row-complete",
              isExpanded && "day-row-expanded",
              isCurrent && !complete && "day-row-current"
            )}
            style={{ "--accent": campaign.accent }}
          >
            <button
              className="day-row-header"
              onClick={() => setExpandedDay(isExpanded ? null : day.id)}
            >
              <span className="day-num">
                {complete ? <Icon.Check size={13} /> : <span className="day-num-text">{String(day.day).padStart(3, "0")}</span>}
              </span>
              <span className="day-row-topics-preview">
                {day.topics.map((t, i) => (
                  <span key={i} className={classNames("topic-chip-mini", progress[day.id] && progress[day.id][i] && "topic-chip-mini-done")}>
                    <DomainDot domain={day.domains[i]} />
                    {t}
                  </span>
                ))}
              </span>
              <span className="day-row-right">
                {query && query.trim() && (notes[day.id] || "").toLowerCase().includes(query.trim().toLowerCase()) && (
                  <span className="note-match" title="Matched inside your notes">note</span>
                )}
                {notes[day.id] && (
                  <span className="note-flag" title="This day has notes"><Icon.Note size={12} /></span>
                )}
                {isCurrent && !complete && <span className="current-pill">CURRENT</span>}
                <span className="day-row-frac">{done}/{day.topics.length}</span>
                <Icon.Chevron size={14} className={classNames("chev", isExpanded && "chev-open")} />
              </span>
            </button>
            {isExpanded && (
              <div className="day-row-body">
                {day.topics.map((t, i) => {
                  const isDone = !!(progress[day.id] && progress[day.id][i]);
                  return (
                    <label key={i} className={classNames("topic-line", isDone && "topic-line-done")}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => onToggle(day, i, campaign)}
                      />
                      <span className="topic-checkbox">
                        {isDone && <Icon.Check size={11} />}
                      </span>
                      <span className="topic-text">{t}</span>
                      <DomainTag domain={day.domains[i]} />
                    </label>
                  );
                })}
                <NoteEditor
                  value={notes[day.id] || ""}
                  onChange={(v) => setNote(day.id, v)}
                  dayNum={day.day}
                />
                <div className="day-tools">
                  <button className="tool-btn" onClick={() => onOpenTool("quiz", day)}>
                    <Icon.Target size={12} /> Quiz me
                  </button>
                  <button className="tool-btn" onClick={() => onOpenTool("notes", day)}>
                    <Icon.Book size={12} /> Generate notes
                  </button>
                  <button className="tool-btn" onClick={() => onOpenTool("linkedin", day)}>
                    <Icon.Send size={12} /> Draft post
                  </button>
                </div>
                <ReferenceBlock
                  data={refs[day.id]}
                  onClear={() => setRef(day.id, null)}
                  onRegenerate={() => onOpenTool("notes", day)}
                />
                <RelatedDays related={getRelated(day)} onJump={onJumpDay} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NoteEditor({ value, onChange, dayNum }) {
  const taRef = useRef(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(64, el.scrollHeight) + "px";
  }, [value]);

  return (
    <div className="note-block">
      <div className="note-head">
        <span className="note-label"><Icon.Note size={12} /> Day {dayNum} notes</span>
        {value.trim().length > 0 && (
          <span className="note-count">{value.trim().split(/\s+/).length} words</span>
        )}
      </div>
      <textarea
        ref={taRef}
        className="note-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What clicked, what didn't. Links, gotchas, code to revisit, questions for your team…"
        spellCheck="true"
      />
    </div>
  );
}

function RelatedDays({ related, onJump }) {
  if (!related || related.length === 0) return null;
  return (
    <div className="related-block">
      <div className="related-label">Builds on / connects to</div>
      <div className="related-row">
        {related.map(({ day, terms }) => (
          <button key={day.id} className="related-chip" onClick={() => onJump(day)}>
            <span className="related-day">Day {day.day}</span>
            <span className="related-topics">{day.topics.join(" · ")}</span>
            {terms && terms.length > 0 && (
              <span className="related-terms">shares: {terms.join(", ")}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function useDomainColor(domain) {
  const { domainColors } = useContext(ThemeCtx);
  return domainColors[domain] || domainColors["systems-eng"];
}

function DomainDot({ domain }) {
  const color = useDomainColor(domain);
  return <span className="domain-dot" style={{ background: color }} />;
}

function DomainTag({ domain }) {
  const color = useDomainColor(domain);
  const meta = DOMAIN_META[domain] || DOMAIN_META["systems-eng"];
  return (
    <span className="domain-tag" style={{ color, borderColor: hexToRgba(color, 0.4), background: hexToRgba(color, 0.09) }}>
      {meta.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <Icon.Search size={28} />
      <div className="empty-state-title">No matching transmissions</div>
      <div className="empty-state-sub">Try a different search term or clear the domain filter.</div>
    </div>
  );
}

/* ============================== GRID VIEW (heatmap / signature element) ============================== */
function GridView({ campaign, days, progress, isDayComplete, topicsDoneCount, notes, onOpenDay }) {
  return (
    <div className="grid-view">
      <div className="grid-view-caption">
        Each cell is one day · color = completion · corner mark = has notes · click to open
      </div>
      <div className="heatmap">
        {days.map((day) => {
          const done = topicsDoneCount(day);
          const complete = isDayComplete(day);
          const level = done === 0 ? 0 : done === day.topics.length ? 2 : 1;
          return (
            <button
              key={day.id}
              className={classNames("heat-cell", `heat-level-${level}`)}
              style={{ "--accent": campaign.accent }}
              onClick={() => onOpenDay(day)}
              title={`Day ${day.day}: ${day.topics.join(" · ")}${notes[day.id] ? " — has notes" : ""}`}
            >
              <span className="heat-cell-num">{day.day}</span>
              {complete && <span className="heat-cell-check"><Icon.Check size={9} /></span>}
              {notes[day.id] && <span className="heat-cell-note" />}
            </button>
          );
        })}
      </div>
      <div className="heat-legend">
        <span>Less</span>
        <span className="heat-cell heat-level-0 heat-legend-swatch" style={{ "--accent": campaign.accent }} />
        <span className="heat-cell heat-level-1 heat-legend-swatch" style={{ "--accent": campaign.accent }} />
        <span className="heat-cell heat-level-2 heat-legend-swatch" style={{ "--accent": campaign.accent }} />
        <span>More</span>
      </div>
    </div>
  );
}

/* ============================== REVIEW VIEW (spaced repetition) ============================== */
function ReviewView({ queue, srs, notes, scheduledCount, onGrade, onOpenDay }) {
  const [revealed, setRevealed] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => { setRevealed(false); }, [cursor, queue.length]);

  if (queue.length === 0) {
    const upcoming = Object.entries(srs)
      .filter(([, e]) => e && !e.graduated && e.due)
      .sort((a, b) => a[1].due - b[1].due)[0];
    const graduated = Object.values(srs).filter((e) => e && e.graduated).length;
    return (
      <div className="review-view">
        <div className="review-empty">
          <Icon.Check size={26} />
          <div className="review-empty-title">Nothing due right now</div>
          <div className="review-empty-sub">
            {scheduledCount > 0
              ? `${scheduledCount} ${scheduledCount === 1 ? "day is" : "days are"} scheduled. Next one ${upcoming ? relativeDue(upcoming[1].due, Date.now()) : "soon"}.`
              : "Complete a day in the console and it enters the review queue after 7 days."}
          </div>
          {graduated > 0 && <div className="review-empty-sub">{graduated} fully retained.</div>}
        </div>
      </div>
    );
  }

  const idx = Math.min(cursor, queue.length - 1);
  const { day, entry } = queue[idx];
  const note = notes[day.id];

  const grade = (outcome) => {
    onGrade(day.id, outcome);
    setRevealed(false);
    setCursor((c) => (c >= queue.length - 1 ? 0 : c));
  };

  return (
    <div className="review-view">
      <div className="review-head">
        <span className="review-count">{queue.length} due</span>
        <span className="review-meta">
          Day {day.day} · reviewed {entry.reps} {entry.reps === 1 ? "time" : "times"} · interval {SRS_INTERVALS[entry.idx]}d
        </span>
      </div>

      <div className="review-card">
        <div className="review-prompt">Can you still explain these without looking?</div>
        <ul className="review-topics">
          {day.topics.map((t, i) => <li key={i}>{t}</li>)}
        </ul>

        {!revealed ? (
          <button className="reveal-btn" onClick={() => setRevealed(true)}>
            {note ? "Show my notes" : "I have thought it through"}
          </button>
        ) : (
          <div className="review-note">
            {note
              ? <pre className="review-note-text">{note}</pre>
              : <div className="review-note-empty">No notes saved for this day. Open it to add some.</div>}
            <button className="review-open-link" onClick={() => onOpenDay(day)}>Open Day {day.day} →</button>
          </div>
        )}
      </div>

      <div className="grade-row">
        <button className="grade-btn grade-forgot" onClick={() => grade("forgot")}>
          Forgot <span className="grade-sub">back in 3d</span>
        </button>
        <button className="grade-btn grade-shaky" onClick={() => grade("shaky")}>
          Shaky <span className="grade-sub">repeat {SRS_INTERVALS[entry.idx]}d</span>
        </button>
        <button className="grade-btn grade-solid" onClick={() => grade("solid")}>
          Solid <span className="grade-sub">
            {entry.idx + 1 >= SRS_INTERVALS.length ? "retained" : `next ${SRS_INTERVALS[entry.idx + 1]}d`}
          </span>
        </button>
      </div>

      {queue.length > 1 && (
        <button className="skip-btn" onClick={() => setCursor((c) => (c + 1) % queue.length)}>
          Skip for now
        </button>
      )}
    </div>
  );
}

/* ============================== WEEKLY REVIEW VIEW ============================== */
function WeeklyView({ log, notes, progress, srs, campaigns, activeCampaign, onOpenDay, onExport }) {
  const { domainColors } = useContext(ThemeCtx);
  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;

  const allDays = useMemo(
    () => [...CAMPAIGNS.main.days, ...CAMPAIGNS.sprint.days],
    []
  );
  const dayById = useMemo(() => {
    const m = {};
    allDays.forEach((d) => { m[d.id] = d; });
    return m;
  }, [allDays]);

  const weekEvents = useMemo(() => log.filter((e) => e.at >= weekAgo), [log, weekAgo]);

  const domainTally = useMemo(() => {
    const t = {};
    weekEvents.forEach((e) => {
      const d = dayById[e.d];
      if (!d) return;
      const dom = d.domains[e.i];
      t[dom] = (t[dom] || 0) + 1;
    });
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [weekEvents, dayById]);

  const activeDayStreak = useMemo(() => {
    if (log.length === 0) return 0;
    const days = new Set(log.map((e) => new Date(e.at).toDateString()));
    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date(now - i * DAY_MS).toDateString();
      if (days.has(d)) streak += 1;
      else if (i > 0) break;
    }
    return streak;
  }, [log, now]);

  const openQuestions = useMemo(() => {
    const out = [];
    Object.entries(notes).forEach(([id, text]) => {
      if (!text) return;
      text.split("\n").forEach((line) => {
        const l = line.trim();
        if (!l) return;
        if (l.includes("?") || /\bTODO\b/i.test(l) || /\bFIXME\b/i.test(l)) {
          out.push({ id, line: l });
        }
      });
    });
    return out.slice(0, 12);
  }, [notes]);

  const campaign = campaigns[activeCampaign];
  const upcoming = useMemo(() => {
    const done = (d) => {
      const p = progress[d.id];
      return p && d.topics.every((_, i) => p[i]);
    };
    return campaign.days.filter((d) => !done(d)).slice(0, 5);
  }, [campaign, progress]);

  const dueNow = useMemo(() => dueList(srs, allDays, now).length, [srs, allDays, now]);

  const byDay = useMemo(() => {
    const buckets = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now - i * DAY_MS);
      const key = start.toDateString();
      const label = start.toLocaleDateString(undefined, { weekday: "short" });
      buckets.push({ key, label, count: weekEvents.filter((e) => new Date(e.at).toDateString() === key).length });
    }
    return buckets;
  }, [weekEvents, now]);

  const maxCount = Math.max(1, ...byDay.map((b) => b.count));

  return (
    <div className="weekly-view">
      <div className="weekly-strip">
        <SummaryCard label="Topics This Week" value={weekEvents.length} sub="last 7 days" accent={campaign.accent} />
        <SummaryCard label="Active Day Streak" value={activeDayStreak} sub={activeDayStreak === 1 ? "day" : "days"} accent={campaign.accent} />
        <SummaryCard label="Due For Review" value={dueNow} sub="in the queue" accent={campaign.accent} />
        <SummaryCard label="Open Questions" value={openQuestions.length} sub="flagged in notes" accent={campaign.accent} />
      </div>

      <div className="weekly-grid">
        <div className="log-panel">
          <div className="log-panel-title">LAST 7 DAYS</div>
          <div className="week-bars">
            {byDay.map((b) => (
              <div key={b.key} className="week-bar-col">
                <div className="week-bar-wrap">
                  <div
                    className="week-bar"
                    style={{ height: Math.round((b.count / maxCount) * 100) + "%", background: campaign.accent, opacity: b.count ? 1 : 0.18 }}
                  />
                </div>
                <div className="week-bar-num">{b.count}</div>
                <div className="week-bar-label">{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="log-panel">
          <div className="log-panel-title">DOMAINS TOUCHED</div>
          <div className="log-panel-body">
            {domainTally.length === 0 && <div className="weekly-empty">Nothing completed in the last 7 days.</div>}
            {domainTally.map(([dom, count]) => {
              const meta = DOMAIN_META[dom] || DOMAIN_META["systems-eng"];
              const color = domainColors[dom] || domainColors["systems-eng"];
              const pct = Math.round((count / weekEvents.length) * 100);
              return (
                <div key={dom} className="log-bar-row">
                  <span className="log-bar-label" style={{ color }}>{meta.label}</span>
                  <div className="log-bar-track">
                    <div className="log-bar-fill" style={{ width: pct + "%", background: color }} />
                  </div>
                  <span className="log-bar-val">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="weekly-grid">
        <div className="log-panel">
          <div className="log-panel-title">OPEN QUESTIONS IN YOUR NOTES</div>
          <div className="log-panel-body">
            {openQuestions.length === 0 && (
              <div className="weekly-empty">Nothing flagged. Lines with a question mark or TODO show up here.</div>
            )}
            {openQuestions.map((q, i) => (
              <button key={i} className="question-row" onClick={() => dayById[q.id] && onOpenDay(dayById[q.id])}>
                <span className="question-day">Day {dayById[q.id] ? dayById[q.id].day : "?"}</span>
                <span className="question-text">{q.line}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="log-panel">
          <div className="log-panel-title">NEXT UP IN {campaign.name}</div>
          <div className="log-panel-body">
            {upcoming.length === 0 && <div className="weekly-empty">Campaign complete.</div>}
            {upcoming.map((d) => (
              <button key={d.id} className="question-row" onClick={() => onOpenDay(d)}>
                <span className="question-day">Day {d.day}</span>
                <span className="question-text">{d.topics.join(" · ")}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="weekly-footer">
        <button className="tool-btn" onClick={onExport}><Icon.Download size={12} /> Export notes and backup</button>
      </div>
    </div>
  );
}

/* ============================== LOG / ANALYTICS VIEW ============================== */
function LogView({ campaign, stats, progress, notes }) {
  const { domainColors } = useContext(ThemeCtx);
  const domainRows = Object.entries(stats.domainTally)
    .sort((a, b) => b[1].total - a[1].total);

  // Bucket by the roadmap's real section boundaries
  const isMain = campaign.key === "main";
  const buckets = useMemo(() => {
    const defs = isMain ? MONTHS_365 : WEEKS_45;
    return defs.map((def) => {
      let total = 0, done = 0;
      for (const d of campaign.days) {
        if (d.day < def.start || d.day > def.end) continue;
        const p = progress[d.id];
        total += d.topics.length;
        d.topics.forEach((_, i) => { if (p && p[i]) done += 1; });
      }
      return { label: def.label, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    });
  }, [campaign, progress, isMain]);

  return (
    <div className="log-view">
      <div className="log-grid">
        <div className="log-panel">
          <div className="log-panel-title">DOMAIN COVERAGE</div>
          <div className="log-panel-body">
            {domainRows.map(([dom, t]) => {
              const meta = DOMAIN_META[dom] || DOMAIN_META["systems-eng"];
              const color = domainColors[dom] || domainColors["systems-eng"];
              const pct = Math.round((t.done / t.total) * 100);
              return (
                <div key={dom} className="log-bar-row">
                  <span className="log-bar-label" style={{ color }}>{meta.label}</span>
                  <div className="log-bar-track">
                    <div className="log-bar-fill" style={{ width: pct + "%", background: color }} />
                  </div>
                  <span className="log-bar-val">{t.done}/{t.total}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="log-panel">
          <div className="log-panel-title">{isMain ? "MONTHLY VELOCITY" : "WEEKLY VELOCITY"}</div>
          <div className="log-panel-body">
            {buckets.map((b) => (
              <div key={b.label} className="log-bar-row">
                <span className="log-bar-label log-bar-label-mono">{b.label}</span>
                <div className="log-bar-track">
                  <div className="log-bar-fill" style={{ width: b.pct + "%", background: campaign.accent }} />
                </div>
                <span className="log-bar-val">{b.done}/{b.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="log-summary-strip">
        <SummaryCard label="Topics Mastered" value={stats.doneTopics} sub={`of ${stats.totalTopics}`} accent={campaign.accent} />
        <SummaryCard label="Days Fully Cleared" value={stats.daysComplete} sub={`of ${stats.totalDays}`} accent={campaign.accent} />
        <SummaryCard label="Completion" value={`${stats.pct}%`} sub="overall" accent={campaign.accent} />
        <SummaryCard label="Days With Notes" value={campaign.days.filter((d) => notes[d.id]).length} sub={`streak ${stats.streak}`} accent={campaign.accent} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className="summary-card" style={{ "--accent": accent }}>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-sub">{sub}</div>
    </div>
  );
}

/* ============================== MARKDOWN EXPORT ============================== */
function buildMarkdown(progress, notes, srs, refs) {
  const now = new Date();
  const lines = [];
  lines.push("# DualTrack export");
  lines.push("");
  lines.push(`Exported ${now.toISOString().slice(0, 10)}`);
  lines.push("");

  Object.values(CAMPAIGNS).forEach((c) => {
    let done = 0, total = 0, noteDays = 0;
    c.days.forEach((d) => {
      const p = progress[d.id];
      total += d.topics.length;
      d.topics.forEach((_, i) => { if (p && p[i]) done += 1; });
      if (notes[d.id]) noteDays += 1;
    });
    lines.push(`## ${c.name}`);
    lines.push("");
    lines.push(`${c.subtitle}`);
    lines.push("");
    lines.push(`Progress: ${done}/${total} topics · ${noteDays} days with notes`);
    lines.push("");

    c.days.forEach((d) => {
      const p = progress[d.id] || {};
      const note = notes[d.id];
      const anyDone = d.topics.some((_, i) => p[i]);
      if (!anyDone && !note) return;
      const allDone = d.topics.every((_, i) => p[i]);
      lines.push(`### Day ${d.day}${allDone ? " ✓" : ""}`);
      d.topics.forEach((t, i) => lines.push(`- [${p[i] ? "x" : " "}] ${t}`));
      const e = srs[d.id];
      if (e) {
        lines.push("");
        lines.push(e.graduated
          ? "_Review: retained_"
          : `_Review: ${e.reps} ${e.reps === 1 ? "pass" : "passes"}, next ${relativeDue(e.due, Date.now())}_`);
      }
      if (note) {
        lines.push("");
        lines.push(note.trim());
      }
      const ref = refs && refs[d.id];
      if (ref) {
        lines.push("");
        lines.push(`<details><summary>Reference notes on ${ref.topic}</summary>`);
        lines.push("");
        lines.push(ref.text.trim());
        lines.push("");
        lines.push("</details>");
      }
      lines.push("");
    });
  });
  return lines.join("\n");
}

/* ============================== MODALS ============================== */
function ModalHost({ modal, onClose, notes, refs, setRef, appendNote, progress, srs, log, themeKey, onImport, fireToast }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const titles = { quiz: "Recall check", linkedin: "Draft a post", export: "Data", notes: "Generate study notes" };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <span className="modal-title">
            {titles[modal.kind]}
            {modal.day ? ` · Day ${modal.day.day}` : ""}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon.X size={15} /></button>
        </div>
        <div className="modal-body">
          {modal.kind === "notes" && (
            <NotesGenPanel
              day={modal.day}
              existing={refs[modal.day.id]}
              onSaveRef={(payload) => setRef(modal.day.id, payload)}
              onAppendNote={(text) => appendNote(modal.day.id, text)}
              fireToast={fireToast}
            />
          )}
          {modal.kind === "quiz" && <QuizPanel day={modal.day} note={notes[modal.day.id]} />}
          {modal.kind === "linkedin" && <LinkedInPanel day={modal.day} note={notes[modal.day.id]} fireToast={fireToast} />}
          {modal.kind === "export" && (
            <DataPanel progress={progress} notes={notes} refs={refs} srs={srs} log={log} themeKey={themeKey} onImport={onImport} fireToast={fireToast} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- minimal markdown renderer (headings, lists, code, inline) ---------- */
function inlineFormat(text, keyBase) {
  const parts = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) parts.push(<code key={keyBase + "-c" + i}>{tok.slice(1, -1)}</code>);
    else parts.push(<strong key={keyBase + "-b" + i}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MiniMarkdown({ text }) {
  const blocks = useMemo(() => {
    const out = [];
    const re = /```(\w*)\n([\s\S]*?)```/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ type: "text", body: text.slice(last, m.index) });
      out.push({ type: "code", lang: m[1], body: m[2] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ type: "text", body: text.slice(last) });
    return out;
  }, [text]);

  return (
    <div className="md">
      {blocks.map((b, bi) => {
        if (b.type === "code") {
          return (
            <pre key={bi} className="md-pre">
              {b.lang && <span className="md-lang">{b.lang}</span>}
              <code>{b.body.replace(/\n$/, "")}</code>
            </pre>
          );
        }
        const lines = b.body.split("\n");
        const nodes = [];
        let list = [];
        const flush = (k) => {
          if (list.length) {
            nodes.push(<ul key={"ul" + k} className="md-ul">{list}</ul>);
            list = [];
          }
        };
        lines.forEach((raw, li) => {
          const line = raw.trimEnd();
          const key = bi + "-" + li;
          if (!line.trim()) { flush(key); return; }
          const h = line.match(/^(#{1,4})\s+(.*)$/);
          if (h) {
            flush(key);
            const lvl = Math.min(h[1].length, 4);
            nodes.push(<div key={key} className={"md-h md-h" + lvl}>{inlineFormat(h[2], key)}</div>);
            return;
          }
          const li2 = line.match(/^\s*[-*]\s+(.*)$/);
          if (li2) { list.push(<li key={key}>{inlineFormat(li2[1], key)}</li>); return; }
          const num = line.match(/^\s*\d+\.\s+(.*)$/);
          if (num) { list.push(<li key={key}>{inlineFormat(num[1], key)}</li>); return; }
          flush(key);
          nodes.push(<p key={key} className="md-p">{inlineFormat(line, key)}</p>);
        });
        flush("end" + bi);
        return <div key={bi}>{nodes}</div>;
      })}
    </div>
  );
}

/* ---------- notes generator ---------- */
const NOTE_STYLES = [
  { key: "explainer", label: "Explainer", hint: "Concepts plus one worked example" },
  { key: "code", label: "Code first", hint: "Heavy on annotated code" },
  { key: "failure", label: "Failure modes", hint: "What breaks in production" },
];

function NotesGenPanel({ day, existing, onSaveRef, onAppendNote, fireToast }) {
  const [topicIdx, setTopicIdx] = useState(0);
  const [style, setStyle] = useState("explainer");
  const [state, setState] = useState(existing ? "ready" : "idle");
  const [text, setText] = useState(existing ? existing.text : "");
  const [err, setErr] = useState("");

  const styleBrief = {
    explainer: "Lead with the mental model, then one worked example, then the gotchas that bite people. Balance prose and example.",
    code: "Minimise prose. Centre the notes on annotated, realistic code the reader could actually run or adapt. Comment the lines that carry the insight.",
    failure: "Centre the notes on production failure modes: what goes wrong, the symptoms you would actually observe, how to diagnose it, and how to prevent it.",
  };

  const generate = async () => {
    setState("loading");
    setErr("");
    try {
      const topic = day.topics[topicIdx];
      const prompt = `Write compact study notes on this topic for an experienced full stack engineer who works in TypeScript, Node.js and NestJS on AWS, with React on the front end. They already know the fundamentals, so skip introductory definitions and go straight to the substance.

Topic: ${topic}

Style: ${styleBrief[style]}

Requirements:
- Use concrete examples. Where the topic is code-shaped, give real code in a fenced block with the language tag, using their stack (TypeScript, Node, NestJS, React, AWS SDK v3) whenever it fits naturally. Do not invent APIs.
- Where the topic is not code-shaped, such as a consensus protocol or an architectural trade-off, use a concrete worked scenario with real numbers, a short trace of events, or a plain-text diagram instead of forcing code.
- Include at least one specific gotcha or misconception that trips up competent engineers.
- Use markdown with short section headings and bullet lists. Keep the whole thing under 700 words so it reads in about ten minutes.
- No preamble, no restating the topic name as a title, no closing summary. Start directly with the first section.`;
      const raw = await callClaude(prompt, 2000);
      setText(raw);
      setState("ready");
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setState("error");
    }
  };

  const save = () => {
    onSaveRef({ text, topic: day.topics[topicIdx], style, at: Date.now() });
    fireToast("Saved as reference material", "xp");
  };

  const doCopy = async () => {
    const ok = await copyText(text);
    fireToast(ok ? "Notes copied" : "Could not copy, select the text instead", "xp");
  };

  const toNotes = () => {
    onAppendNote(text);
    fireToast("Appended to your notes", "day");
  };

  return (
    <div className="notesgen">
      <div className="gen-field">
        <div className="gen-label">Topic</div>
        <div className="seg-row">
          {day.topics.map((t, i) => (
            <button
              key={i}
              className={classNames("seg-btn", topicIdx === i && "seg-btn-active")}
              onClick={() => setTopicIdx(i)}
              title={t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="gen-field">
        <div className="gen-label">Angle</div>
        <div className="seg-row">
          {NOTE_STYLES.map((sty) => (
            <button
              key={sty.key}
              className={classNames("seg-btn", style === sty.key && "seg-btn-active")}
              onClick={() => setStyle(sty.key)}
              title={sty.hint}
            >
              {sty.label}
            </button>
          ))}
        </div>
        <div className="gen-hint">{NOTE_STYLES.find((x) => x.key === style).hint}</div>
      </div>

      {state === "loading" && <div className="panel-loading">Writing notes with examples…</div>}
      {state === "error" && <div className="panel-error">Could not generate notes. {err}</div>}

      {(state === "idle" || state === "error") && (
        <button className="primary-btn" onClick={generate}>Generate notes</button>
      )}

      {state === "ready" && (
        <>
          <div className="gen-output"><MiniMarkdown text={text} /></div>
          <div className="panel-actions">
            <button className="primary-btn" onClick={save}>Save as reference</button>
            <button className="secondary-btn" onClick={toNotes}>Append to my notes</button>
            <button className="secondary-btn" onClick={doCopy}>Copy</button>
            <button className="secondary-btn" onClick={generate}>Regenerate</button>
          </div>
          <p className="gen-footnote">
            Saving keeps this separate from your own notes, so the review queue still tests what you wrote yourself.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- reference block shown inside a day ---------- */
function ReferenceBlock({ data, onClear, onRegenerate }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <div className="ref-block">
      <button className="ref-head" onClick={() => setOpen((v) => !v)}>
        <Icon.Book size={12} />
        <span className="ref-title">Reference notes</span>
        <span className="ref-topic">{data.topic}</span>
        <Icon.Chevron size={13} className={classNames("chev", open && "chev-open")} />
      </button>
      {open && (
        <div className="ref-body">
          <MiniMarkdown text={data.text} />
          <div className="ref-actions">
            <button className="secondary-btn" onClick={onRegenerate}>Regenerate</button>
            <button className="secondary-btn" onClick={onClear}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizPanel({ day, note }) {
  const [state, setState] = useState("idle"); // idle | loading | ready | error
  const [questions, setQuestions] = useState([]);
  const [shown, setShown] = useState({});
  const [err, setErr] = useState("");

  const generate = async () => {
    setState("loading");
    setErr("");
    try {
      const prompt = `You are helping a senior software engineer test their recall.

Topics studied:
1. ${day.topics[0]}
${day.topics[1] ? "2. " + day.topics[1] : ""}

${note ? "Their own notes:\n" + note.slice(0, 2500) : "They did not save notes."}

Write exactly 5 short recall questions that test genuine understanding of these topics at a senior engineer level. Favour "why" and "when would you" and trade-off questions over definitions. For each, give a concise 2-4 sentence model answer.

Respond with ONLY a JSON array, no preamble and no markdown fences:
[{"q":"question","a":"model answer"}]`;
      const raw = await callClaude(prompt, 1400);
      const parsed = JSON.parse(stripFences(raw));
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Unexpected format");
      setQuestions(parsed);
      setShown({});
      setState("ready");
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setState("error");
    }
  };

  if (state === "idle" || state === "error") {
    return (
      <div className="panel-intro">
        <p className="panel-copy">
          Answer out loud or on paper first, then reveal. Retrieval beats rereading.
        </p>
        {state === "error" && <div className="panel-error">Could not generate questions. {err}</div>}
        <button className="primary-btn" onClick={generate}>Generate 5 questions</button>
      </div>
    );
  }
  if (state === "loading") return <div className="panel-loading">Writing questions…</div>;

  return (
    <div className="quiz-list">
      {questions.map((q, i) => (
        <div key={i} className="quiz-item">
          <div className="quiz-q"><span className="quiz-num">{i + 1}</span>{q.q}</div>
          {shown[i]
            ? <div className="quiz-a">{q.a}</div>
            : <button className="quiz-reveal" onClick={() => setShown((s) => ({ ...s, [i]: true }))}>Reveal answer</button>}
        </div>
      ))}
      <button className="secondary-btn" onClick={generate}>New set</button>
    </div>
  );
}

function LinkedInPanel({ day, note, fireToast }) {
  const [state, setState] = useState("idle");
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  const generate = async () => {
    setState("loading");
    setErr("");
    try {
      const prompt = `Write a LinkedIn post for a software engineer who publishes educational technical content.

Topic studied today:
1. ${day.topics[0]}
${day.topics[1] ? "2. " + day.topics[1] : ""}

${note ? "Their own notes to draw from (use these as the substance):\n" + note.slice(0, 3000) : "No notes saved. Write from the topic titles at a senior engineer level."}

House style rules, follow all of them:
- Reads in 45 to 60 seconds. Short paragraphs, plenty of line breaks.
- Open with a strong hook line that creates curiosity or states a counter-intuitive truth.
- Use emojis sparingly as visual anchors for structure, not decoration.
- Never use em dashes anywhere in the post.
- Teach one concrete idea well rather than listing everything.
- End with a question that invites replies.
- Finish with exactly 3 targeted hashtags on their own line.
- Do not include any external links in the body. If a link would help, end with a line noting the link goes in the first comment.

Pick whichever of the two topics makes the better standalone post. Return only the post text, no commentary.`;
      const raw = await callClaude(prompt, 1200);
      setDraft(raw.replace(/—/g, ",").replace(/–/g, "-"));
      setState("ready");
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setState("error");
    }
  };

  const doCopy = async () => {
    const ok = await copyText(draft);
    fireToast(ok ? "Draft copied" : "Could not copy, select the text instead", "xp");
  };

  if (state === "idle" || state === "error") {
    return (
      <div className="panel-intro">
        <p className="panel-copy">
          {note
            ? "Turns this day's notes into a post in your usual format."
            : "No notes on this day yet. The draft will come from the topic titles, so it will be thinner than usual."}
        </p>
        {state === "error" && <div className="panel-error">Could not write a draft. {err}</div>}
        <button className="primary-btn" onClick={generate}>Write draft</button>
      </div>
    );
  }
  if (state === "loading") return <div className="panel-loading">Drafting…</div>;

  return (
    <div className="draft-wrap">
      <textarea className="draft-text" value={draft} onChange={(e) => setDraft(e.target.value)} rows={16} />
      <div className="panel-actions">
        <button className="primary-btn" onClick={doCopy}>Copy</button>
        <button className="secondary-btn" onClick={generate}>Rewrite</button>
      </div>
    </div>
  );
}

function DataPanel({ progress, notes, refs, srs, log, themeKey, onImport, fireToast, onClose }) {
  const [importErr, setImportErr] = useState("");
  const fileRef = useRef(null);

  const backup = () => JSON.stringify({ app: "dualtrack", version: 2, exportedAt: new Date().toISOString(), progress, notes, refs, srs, log, themeKey }, null, 2);

  const noteCount = Object.keys(notes).length;
  const doneCount = Object.values(progress).reduce((n, v) => n + Object.values(v).filter(Boolean).length, 0);

  const saveMd = async () => {
    const md = buildMarkdown(progress, notes, srs, refs);
    if (!downloadText("dualtrack-notes.md", md, "text/markdown")) {
      const ok = await copyText(md);
      fireToast(ok ? "Markdown copied to clipboard" : "Export failed", "xp");
    } else fireToast("Markdown exported", "xp");
  };

  const saveJson = async () => {
    const js = backup();
    if (!downloadText("dualtrack-backup.json", js, "application/json")) {
      const ok = await copyText(js);
      fireToast(ok ? "Backup copied to clipboard" : "Export failed", "xp");
    } else fireToast("Backup exported", "xp");
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(JSON.parse(String(reader.result)));
        fireToast("Backup restored", "day");
        onClose();
      } catch (err) {
        setImportErr(err.message || "That file could not be read");
      }
    };
    reader.onerror = () => setImportErr("That file could not be read");
    reader.readAsText(f);
  };

  return (
    <div className="data-panel">
      <div className="data-stat">{doneCount} topics complete · {noteCount} days with notes</div>

      <div className="data-section">
        <div className="data-section-title">Export</div>
        <p className="panel-copy">Markdown gives you a readable copy of every note. JSON is a full backup you can restore later.</p>
        <div className="panel-actions">
          <button className="primary-btn" onClick={saveMd}>Notes as markdown</button>
          <button className="secondary-btn" onClick={saveJson}>Full backup (JSON)</button>
        </div>
      </div>

      <div className="data-section">
        <div className="data-section-title">Restore</div>
        <p className="panel-copy">Loading a backup replaces everything currently in the app.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
        <button className="secondary-btn" onClick={() => fileRef.current && fileRef.current.click()}>Choose backup file</button>
        {importErr && <div className="panel-error">{importErr}</div>}
      </div>
    </div>
  );
}

/* ============================== TOAST + CONFETTI ============================== */
function ToastLayer({ toast }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className={classNames("toast", toast.kind === "day" && "toast-day")}>
      {toast.kind === "day" ? <Icon.Trophy size={14} /> : <Icon.Bolt size={14} />}
      <span>{toast.msg}</span>
    </div>
  );
}

function ConfettiBurst({ color }) {
  // Deterministic layout (avoids impure Math.random during render)
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const n = (i * 17 + 7) % 100;
        return {
          id: i,
          left: n,
          delay: ((i * 13) % 15) / 100,
          rot: (i * 47) % 360,
          drift: ((i % 2 === 0 ? 1 : -1) * (20 + (i * 11) % 80)),
        };
      }),
    [],
  );
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left + "%",
            background: color,
            animationDelay: p.delay + "s",
            "--drift": p.drift + "px",
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/* ============================== FOOTER ============================== */
function Footer() {
  return (
    <footer className="app-footer">
      <span>DUALTRACK · two campaigns, one operator · progress and notes save automatically</span>
    </footer>
  );
}

