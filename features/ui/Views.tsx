// @ts-nocheck
"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect, useContext } from "react";
import { useSession } from "next-auth/react";
import DOMAIN_META from "@/data/domains.json";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { ThemeCtx, useDomainColor } from "@/theme/ThemeContext";
import { THEMES, THEME_ORDER, hexToRgba, resolveThemeKey } from "@/theme/themes";
import {
  DEFAULT_FONT_KEY,
  FONT_ORDER,
  FONT_PACKS,
  resolveFontKey,
} from "@/theme/fonts";
import { callClaude } from "@/lib/claude-client";
import {
  SUBSCRIPTION_TIERS,
  TIER_ORDER,
  fetchSubscriptionStatus,
  requestUpgrade,
} from "@/lib/subscriptions";
import { parseJsonText } from "@/lib/stripFences";
import { downloadText, copyText } from "@/lib/fileIo";
import { buildMarkdown } from "@/lib/markdown";
import { relativeDue, SRS_INTERVALS, DAY_MS, dueList } from "@/lib/srs";
import { seedBuiltinPlans } from "@/data/builtinPlans";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { AccountPanel } from "@/features/account/AccountPanel";
import { PlanBuilder } from "@/features/planBuilder/PlanBuilder";
import { formatAiError } from "@/lib/providers/errors";
import {
  applyFullImport,
  applyPlanImport,
  detectImport,
  exportAll,
  exportPlan,
  serializeExport,
} from "@/lib/exportImport";

/* ============================== BACKGROUND FX ============================== */
export function BackgroundFX({ accent, effects }) {
  return (
    <div className="bg-fx" aria-hidden="true">
      <div className="bg-grid" />
      <div
        className="bg-glow"
        style={{ background: `radial-gradient(480px circle at 16% 0%, ${hexToRgba(accent, effects ? 0.05 : 0.02)}, transparent 55%)` }}
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

export function SaveIndicator({ status, compact = false }) {
  const label = status === "saving" ? "Saving…"
    : status === "saved" ? "Saved"
    : status === "error" ? "Not saved"
    : status === "loading" ? "Loading…"
    : status === "off" ? "Session only"
    : "Autosaved";
  return (
    <div
      className={classNames(
        "stat-chip",
        "save-chip",
        `save-${status}`,
        compact && "save-chip-compact",
      )}
      title={SAVE_COPY[status]}
      aria-label={SAVE_COPY[status]}
    >
      <span className="save-dot" />
      {!compact && <span className="stat-chip-val">{label}</span>}
    </div>
  );
}

export function ThemePicker({ themeKey, setThemeKey }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const resolved = resolveThemeKey(themeKey);
  const current = THEMES[resolved];

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
            const isOn = k === resolved;
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

export function FontPicker({ fontKey, setFontKey }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const resolved = resolveFontKey(fontKey);
  const current = FONT_PACKS[resolved];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="theme-wrap font-wrap" ref={wrapRef}>
      <button
        className="stat-chip theme-btn font-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change typeface"
      >
        <span className="font-sample" style={{ fontFamily: current.display }}>
          {current.sample}
        </span>
        <span className="stat-chip-val">{current.name}</span>
        <Icon.Chevron size={12} className={classNames("theme-chev", open && "theme-chev-open")} />
      </button>
      {open && (
        <div className="theme-menu font-menu" role="listbox">
          {FONT_ORDER.map((k) => {
            const pack = FONT_PACKS[k];
            const isOn = k === resolved;
            return (
              <button
                key={k}
                role="option"
                aria-selected={isOn}
                className={classNames("theme-item font-item", isOn && "theme-item-active")}
                onClick={() => {
                  setFontKey(k);
                  setOpen(false);
                }}
              >
                <span className="font-sample" style={{ fontFamily: pack.display }}>
                  {pack.sample}
                </span>
                <span className="font-item-copy">
                  <span className="theme-item-name" style={{ fontFamily: pack.display }}>
                    {pack.name}
                  </span>
                  <span className="font-item-hint">{pack.hint}</span>
                </span>
                {isOn && <Icon.Check size={12} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TopBar({
  stats,
  themeKey,
  setThemeKey,
  fontKey,
  setFontKey,
  saveStatus,
  noteCount,
  confirmReset,
  setConfirmReset,
  onReset,
  onOpenData,
  onOpenSettings,
  onOpenAccount,
  accountLabel,
  onNewPlan,
  onOpenBadges,
  badgeCount,
  badgeTotal,
  onGoHome,
  onOpenPricing,
}) {
  const pct = stats.need ? Math.min(100, Math.round((stats.into / stats.need) * 100)) : 0;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 861px)").matches) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  const runAndClose = (fn) => () => {
    setMenuOpen(false);
    fn?.();
  };

  return (
    <header className={classNames("topbar", menuOpen && "topbar-menu-open")}>
      <div className="topbar-row">
        <div className="topbar-left">
          <button className="brand brand-btn" onClick={onGoHome} title="Back to home" type="button">
            <span className="brand-mark">◈</span>
            <span className="brand-text">REFRAIN<span className="brand-accent">LY</span></span>
          </button>
        </div>

        <div className="topbar-mobile-tray" aria-hidden={false}>
          <SaveIndicator status={saveStatus} compact />
          <div
            className="topbar-mobile-level"
            title={`${stats.rank} · Level ${stats.level} · ${stats.xp.toLocaleString()} XP`}
          >
            <span className="level-badge">LV {stats.level}</span>
            <div className="xp-bar-mini" aria-hidden="true">
              <div className="xp-bar-mini-fill" style={{ width: pct + "%" }} />
            </div>
          </div>
          <button
            type="button"
            className="topbar-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="topbar-panel"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <Icon.X size={18} /> : <Icon.Menu size={18} />}
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>

        <div
          id="topbar-panel"
          className={classNames("topbar-right", menuOpen && "topbar-right-open")}
        >
          <nav className="topbar-cluster" aria-label="Workspace">
            <button className="topbar-item" type="button" onClick={runAndClose(onNewPlan)} title="Create a custom plan">
              <Icon.Target size={13} />
              <span className="topbar-item-label">New</span>
            </button>
            <button className="topbar-item" type="button" onClick={runAndClose(onOpenSettings)} title="AI provider and API key">
              <Icon.Cloud size={13} />
              <span className="topbar-item-label">AI</span>
            </button>
            <button className="topbar-item" type="button" onClick={runAndClose(onOpenPricing)} title="Plans, pricing, and usage">
              <Icon.Sparkle size={13} />
              <span className="topbar-item-label">Plans</span>
            </button>
            <button className="topbar-item" type="button" onClick={runAndClose(onOpenData)} title="Export or import your data">
              <Icon.Download size={13} />
              <span className="topbar-item-label">Data</span>
            </button>
            <button
              className={classNames("topbar-item", accountLabel && "topbar-item-active")}
              type="button"
              onClick={runAndClose(onOpenAccount)}
              title={accountLabel ? `Signed in as ${accountLabel}` : "Sign in to sync across devices"}
            >
              <Icon.User size={13} />
              <span className="topbar-item-label">{accountLabel ? "Account" : "Sign in"}</span>
            </button>
            <button
              className="topbar-item"
              type="button"
              onClick={runAndClose(onOpenBadges)}
              title={`${badgeCount} of ${badgeTotal} badges unlocked`}
            >
              <Icon.Medal size={13} />
              <span>{badgeCount}/{badgeTotal}</span>
            </button>
          </nav>

          <div className="topbar-cluster topbar-cluster-look" aria-label="Appearance">
            <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
            <FontPicker fontKey={fontKey} setFontKey={setFontKey} />
          </div>

          <div className="topbar-cluster topbar-cluster-status" aria-label="Progress">
            <SaveIndicator status={saveStatus} compact />
            {noteCount > 0 && (
              <div
                className="topbar-item topbar-item-static"
                title={`${noteCount} ${noteCount === 1 ? "day has" : "days have"} notes`}
              >
                <Icon.Note size={13} />
                <span>{noteCount}</span>
              </div>
            )}
            <div
              className="topbar-item topbar-item-static topbar-progress"
              title={`${stats.rank} · Level ${stats.level} · ${stats.xp.toLocaleString()} total XP`}
            >
              <Icon.Trophy size={13} />
              <span className="topbar-rank">{stats.rank}</span>
              <span className="level-badge">LV {stats.level}</span>
              <div className="xp-bar-mini" aria-hidden="true">
                <div className="xp-bar-mini-fill" style={{ width: pct + "%" }} />
              </div>
              <span className="topbar-xp">{stats.into}/{stats.need}</span>
              <span className="topbar-xp-total">{stats.xp.toLocaleString()} XP</span>
            </div>
            {confirmReset ? (
              <div className="reset-confirm">
                <span>Erase all?</span>
                <button className="reset-yes" type="button" onClick={runAndClose(onReset)}>Erase</button>
                <button className="reset-no" type="button" onClick={() => setConfirmReset(false)}>Keep</button>
              </div>
            ) : (
              <button
                className="topbar-item topbar-item-icon reset-btn"
                type="button"
                onClick={() => setConfirmReset(true)}
                title="Reset all progress and notes"
              >
                <Icon.Rotate size={13} />
                <span className="topbar-reset-label">Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ============================== PLAN SWITCHER ============================== */
export function PlanSwitcher({
  active,
  setActive,
  campaignStats,
  campaigns,
  confirmDeletePlanId,
  setConfirmDeletePlanId,
  onDeletePlan,
  onNewPlan,
}) {
  return (
    <div className="switcher switcher-scroll" role="tablist" aria-label="Plans">
      {Object.values(campaigns).map((c) => {
        const st = campaignStats[c.id] || campaignStats[c.key];
        const isActive = active === c.id || active === c.key;
        const planId = c.id || c.key;
        const pct = st?.pct || 0;
        return (
          <div
            key={planId}
            className={classNames(
              "switcher-tab-wrap",
              isActive && "switcher-tab-wrap-active",
              confirmDeletePlanId === planId && "switcher-tab-wrap-confirm",
            )}
          >
            {confirmDeletePlanId === planId ? (
              <div className="switcher-confirm">
                <span className="switcher-confirm-label">
                  {c.builtin ? "Hide?" : "Delete?"}
                </span>
                <button
                  type="button"
                  className="switcher-confirm-btn"
                  onClick={() => setConfirmDeletePlanId(null)}
                >
                  No
                </button>
                <button
                  type="button"
                  className="switcher-confirm-btn switcher-confirm-danger"
                  onClick={() => onDeletePlan(planId)}
                >
                  {c.builtin ? "Hide" : "Yes"}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={classNames("switcher-tab", isActive && "switcher-tab-active")}
                  style={isActive ? { "--accent": c.accent, "--glow": c.glow } : undefined}
                  onClick={() => setActive(planId)}
                  title={c.subtitle || c.name}
                >
                  <span className="switcher-dot" style={{ background: c.accent }} />
                  <span className="switcher-name">{c.name}</span>
                  {pct > 0 && <span className="switcher-pct">{pct}%</span>}
                </button>
                <button
                  type="button"
                  className="switcher-delete"
                  title={c.builtin ? "Hide built-in plan" : "Delete plan"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeletePlanId(planId);
                  }}
                >
                  <Icon.X size={11} />
                </button>
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="switcher-tab switcher-new"
        onClick={onNewPlan}
        title="Build a custom roadmap"
      >
        <span className="switcher-plus">＋</span>
        <span className="switcher-name">New</span>
      </button>
    </div>
  );
}

/** @deprecated Use PlanSwitcher */
export function CampaignSwitcher(props) {
  return <PlanSwitcher {...props} onNewPlan={props.onNewPlan || (() => {})} />;
}

/* ============================== LANDING PAGE ============================== */
const LANDING_FEATURES = [
  {
    id: "roadmaps",
    tone: "blue",
    icon: Icon.Target,
    title: "Day-by-day roadmaps",
    copy: "Start from example campaigns or generate a custom plan with outline, periods, and edit-before-save.",
  },
  {
    id: "multiplan",
    tone: "ink",
    icon: Icon.LayoutDashboard,
    title: "Multi-plan campaigns",
    copy: "Run several learning plans at once and switch between them without losing progress.",
  },
  {
    id: "xp",
    tone: "pink",
    icon: Icon.Bolt,
    title: "XP, levels & ranks",
    copy: "Earn XP for completed topics, level up, and climb from Recruit toward Architect.",
  },
  {
    id: "streaks",
    tone: "blue",
    icon: Icon.Flame,
    title: "Daily streaks",
    copy: "Keep a calendar streak alive by showing up and completing today's mission.",
  },
  {
    id: "srs",
    tone: "ink",
    icon: Icon.Rotate,
    title: "Spaced repetition",
    copy: "Reviews resurface topics on a schedule so you remember them instead of cramming once.",
  },
  {
    id: "quiz",
    tone: "pink",
    icon: Icon.Book,
    title: "AI quiz & study notes",
    copy: "Generate recall checks and study notes for any day — bring your own key or use a paid plan.",
  },
  {
    id: "linkedin",
    tone: "blue",
    icon: Icon.Send,
    title: "LinkedIn drafts",
    copy: "Turn a completed day into a shareable post draft without leaving the campaign.",
  },
  {
    id: "journal",
    tone: "ink",
    icon: Icon.Note,
    title: "Other things I learned",
    copy: "Field notes for tangents — an evidence board of slips, markdown, and AI summaries.",
  },
  {
    id: "clips",
    tone: "blue",
    icon: Icon.Link,
    title: "Bookmarks",
    copy: "Save articles, videos, and docs — compact link previews when metadata is available.",
  },
  {
    id: "onthisday",
    tone: "blue",
    icon: Icon.Calendar,
    title: "On this day",
    copy: "Resurface completed days and journal entries from weeks or months ago.",
  },
  {
    id: "badges",
    tone: "ink",
    icon: Icon.Medal,
    title: "Badges & milestones",
    copy: "Achievements unlock automatically from progress, streaks, reviews, and journal activity.",
  },
  {
    id: "themes",
    tone: "pink",
    icon: Icon.Grid,
    title: "Themes & type voices",
    copy: "Ten visual themes and ten type voices — Space Grotesk, Literata, JetBrains Mono, Archivo, and more.",
  },
  {
    id: "sync",
    tone: "blue",
    icon: Icon.Cloud,
    title: "Accounts & cloud sync",
    copy: "Sign in to sync plans, progress, notes, and journal across devices — or continue as a guest.",
  },
  {
    id: "byok",
    tone: "ink",
    icon: Icon.Terminal,
    title: "Bring your own OpenRouter key",
    copy: "Paste an OpenRouter key and pick any model — free forever on your own credits.",
  },
  {
    id: "plans",
    tone: "pink",
    icon: Icon.Trophy,
    title: "Subscription tiers",
    copy: "Recruit is free OpenRouter BYOK today. Operator and Architect managed AI is planned — checkout not live yet.",
  },
  {
    id: "export",
    tone: "blue",
    icon: Icon.Download,
    title: "Export & import",
    copy: "Backup everything, share a plan-only file, or merge another backup without starting over.",
  },
];

export function HomeView({
  hasCampaign,
  summary,
  examples,
  onAddExample,
  onOpenBuilder,
  onOpenAccount,
  accountLabel,
  onRequireAuth,
  onGoDashboard,
  onOpenPricing,
}) {
  const [started, setStarted] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (started && pickerRef.current) {
      pickerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [started]);

  const handleGetStarted = () => onRequireAuth(() => setStarted(true));
  const handleBuildCustom = () => onRequireAuth(onOpenBuilder);

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand" aria-label="Refrainly">
          <span className="landing-brand-mark" aria-hidden="true" />
          <span className="landing-brand-text">REFRAINLY</span>
        </div>
        <div className="landing-nav-actions">
          {hasCampaign && (
            <button type="button" className="landing-nav-link landing-nav-dash" onClick={onGoDashboard}>
              Dashboard
            </button>
          )}
          <button type="button" className="landing-nav-link" onClick={onOpenPricing}>
            Plans
          </button>
          <button type="button" className="landing-nav-cta" onClick={onOpenAccount}>
            {accountLabel ? "Account" : "Sign in"}
          </button>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero-stage" aria-hidden="true">
          <span className="landing-shape landing-shape-a" />
          <span className="landing-shape landing-shape-b" />
          <span className="landing-shape landing-shape-c" />
          <span className="landing-shape landing-shape-d" />
        </div>
        <div className="landing-hero-copy">
          <p className="landing-brand-hero">REFRAINLY</p>
          {hasCampaign ? (
            <>
              <h1 id="landing-hero-title" className="landing-hero-title">
                Ready for today&apos;s mission?
              </h1>
              <p className="landing-hero-lead">
                Continue <strong>{summary.name}</strong> — {summary.daysComplete} of{" "}
                {summary.totalDays} days done.
              </p>
              <div className="landing-hero-actions">
                <button type="button" className="landing-cta" onClick={onGoDashboard}>
                  Go to dashboard
                </button>
                <button type="button" className="landing-cta-ghost" onClick={handleGetStarted}>
                  Add another plan
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 id="landing-hero-title" className="landing-hero-title">
                Learn something new.
                <span className="landing-hero-line">Every single day.</span>
              </h1>
              <p className="landing-hero-lead">
                Day-by-day roadmaps, streaks, spaced review, and a journal for the tangents —
                in one place.
              </p>
              <div className="landing-hero-actions">
                <button type="button" className="landing-cta" onClick={handleGetStarted}>
                  Get started
                </button>
                <button type="button" className="landing-cta-ghost" onClick={handleBuildCustom}>
                  Build a custom plan
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {hasCampaign && summary && (
        <section className="landing-stats" aria-label="Your progress">
          <div className="landing-stat">
            <span className="landing-stat-val">{summary.streak}</span>
            <span className="landing-stat-label">day streak</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-val">{summary.xp.toLocaleString()}</span>
            <span className="landing-stat-label">XP</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-val">LV {summary.level}</span>
            <span className="landing-stat-label">{summary.rank}</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-val">
              {summary.daysComplete}/{summary.totalDays}
            </span>
            <span className="landing-stat-label">days</span>
          </div>
        </section>
      )}

      <section className="landing-features" aria-label="Everything included">
        <div className="landing-features-head">
          <h2 className="landing-features-title">Everything in Refrainly</h2>
          <p className="landing-features-lead">
            Campaigns, memory, AI tools, sync, and themes — one daily learning console.
          </p>
        </div>
        <div className="landing-features-grid">
          {LANDING_FEATURES.map((f, i) => (
            <div
              key={f.id}
              className={classNames("landing-feature", `landing-feature-${f.tone}`)}
              style={{ "--i": i }}
            >
              <div className="landing-feature-icon" aria-hidden="true">
                <f.icon size={20} />
              </div>
              <div className="landing-feature-body">
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-copy">{f.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!started && !hasCampaign && (
        <section className="landing-band">
          <div className="landing-band-copy">
            <h2 className="landing-band-title">Start your first campaign</h2>
            <p className="landing-band-lead">Sign in, or continue as a guest — your progress saves either way.</p>
          </div>
          <button type="button" className="landing-cta landing-cta-band" onClick={handleGetStarted}>
            Get started
          </button>
        </section>
      )}

      {started && (
        <section className="landing-picker" ref={pickerRef}>
          <div className="landing-picker-head">
            <h2 className="landing-picker-title">
              {hasCampaign ? "Start a new campaign" : "Pick a starting plan"}
            </h2>
            <p className="landing-picker-lead">
              Add an example plan as-is, or build a custom roadmap around what you want to learn.
            </p>
          </div>
          <div className="landing-picker-grid">
            {examples.map((p, i) => (
              <div
                key={p.id}
                className={classNames("landing-plan", i % 2 === 0 ? "landing-plan-a" : "landing-plan-b")}
              >
                <div className="landing-plan-meta">{p.totalDays} days · example</div>
                <h3 className="landing-plan-name">{p.name}</h3>
                <p className="landing-plan-sub">{p.subtitle}</p>
                {p.blurb && <p className="landing-plan-blurb">{p.blurb}</p>}
                <button type="button" className="landing-plan-btn" onClick={() => onAddExample(p.id)}>
                  Add this plan
                </button>
              </div>
            ))}
          </div>
          <div className="landing-picker-or">
            <span>or</span>
          </div>
          <button type="button" className="landing-cta-ghost landing-picker-custom" onClick={handleBuildCustom}>
            Build your own custom plan
          </button>
        </section>
      )}

      <footer className="landing-footer">
        <span>REFRAINLY</span>
        <span className="landing-footer-dot" aria-hidden="true" />
        <span>progress saves automatically</span>
      </footer>
    </div>
  );
}

export function CampaignHero({ campaign, stats, progress, onToggle }) {
  const activeDay = stats.activeDay;
  const dayProgress = activeDay && progress ? progress[activeDay.id] : null;
  const doneCount = activeDay
    ? activeDay.topics.filter((_, i) => dayProgress && dayProgress[i]).length
    : 0;
  return (
    <header className="hero" style={{ "--accent": campaign.accent, "--glow": campaign.glow }}>
      <div className="hero-mast">
        <div className="hero-kicker">
          <span className="hero-kicker-mark" aria-hidden="true" />
          <span>Field log · active campaign</span>
        </div>
        <div className="hero-mast-row">
          <div className="hero-identity">
            <h1 className="hero-title">{campaign.name}</h1>
            <p className="hero-sub">{campaign.subtitle}</p>
          </div>
          <div className="hero-pct-block" aria-label={`${stats.pct} percent complete`}>
            <span className="hero-pct-num">{stats.pct}</span>
            <span className="hero-pct-unit">%</span>
          </div>
        </div>
        <BulletTrack pct={stats.pct} />
        <div className="hero-statstrip" role="list">
          <Metric label="Days" value={`${stats.daysComplete}/${stats.totalDays}`} />
          <Metric label="Topics" value={`${stats.doneTopics}/${stats.totalTopics}`} />
          <Metric
            label="Streak"
            value={`${stats.streak}d`}
            icon={stats.streak > 0 ? <Icon.Flame size={13} /> : null}
          />
        </div>
      </div>
      {activeDay && (
        <aside className="hero-dispatch">
          <div className="hero-dispatch-frame" aria-hidden="true" />
          <div className="next-mission-label">
            <Icon.Target size={13} />
            <span>Next dispatch</span>
            <span className="next-mission-day">Day {String(activeDay.day).padStart(3, "0")}</span>
          </div>
          <ol className="next-mission-topics">
            {activeDay.topics.map((t, i) => {
              const isDone = !!(dayProgress && dayProgress[i]);
              return (
                <li key={i}>
                  <label className={classNames("topic-line next-mission-topic", isDone && "topic-line-done")}>
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => onToggle?.(activeDay, i, campaign)}
                    />
                    <span className="topic-checkbox">
                      {isDone && <Icon.Check size={11} />}
                    </span>
                    <span className="topic-text">{t}</span>
                  </label>
                </li>
              );
            })}
          </ol>
          <div className="next-mission-foot" aria-live="polite">
            <span>{doneCount}/{activeDay.topics.length} marked</span>
          </div>
        </aside>
      )}
    </header>
  );
}

export function Metric({ label, value, icon }) {
  return (
    <div className="metric" role="listitem">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{icon}{value}</div>
    </div>
  );
}

/** Segmented progress — readable without color alone (waffle / bullet chart). */
export function BulletTrack({ pct, segments = 20 }) {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * segments);
  return (
    <div
      className="bullet-track"
      role="img"
      aria-label={`${pct}% complete`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={classNames("bullet-seg", i < filled && "bullet-seg-on")}
        />
      ))}
    </div>
  );
}

export function ProgressRing({ pct, accent }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="progress-ring-wrap">
      <svg width="96" height="96" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--track)" strokeWidth="7" />
        <circle
          cx="52" cy="52" r={r} fill="none" stroke={accent} strokeWidth="7"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="square"
          transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dashoffset 0.35s ease-out" }}
        />
      </svg>
      <div className="progress-ring-label">{pct}%</div>
    </div>
  );
}

/* ============================== TODAY WIDGETS ============================== */
function agoLabel(daysAgo) {
  if (daysAgo >= 365) {
    const years = Math.round(daysAgo / 365);
    return `${years} year${years > 1 ? "s" : ""} ago`;
  }
  if (daysAgo >= 30) {
    const months = Math.round(daysAgo / 30);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  }
  return `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
}

export function OnThisDayCard({ memory, onDismiss }) {
  if (!memory) return null;
  return (
    <div className="today-widget on-this-day-card">
      <div className="today-widget-icon"><Icon.Calendar size={15} /></div>
      <div className="today-widget-body">
        <div className="today-widget-eyebrow">ON THIS DAY · {agoLabel(memory.daysAgo)}</div>
        {memory.kind === "journal" ? (
          <>
            <div className="today-widget-title">{memory.title}</div>
            {memory.snippet && <p className="today-widget-copy">{memory.snippet}</p>}
          </>
        ) : (
          <>
            <div className="today-widget-title">{memory.dayLabel} · {memory.planName}</div>
            <p className="today-widget-copy">{memory.topics.join(" · ")}</p>
          </>
        )}
      </div>
      <button type="button" className="today-widget-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <Icon.X size={12} />
      </button>
    </div>
  );
}

/* ============================== BADGES ============================== */
export function BadgesPanel({ statuses, onClose }) {
  const unlockedCount = statuses.filter((s) => s.unlocked).length;
  return (
    <div className="settings-panel badges-panel">
      <p className="panel-copy">
        {unlockedCount} of {statuses.length} unlocked — earned automatically from your progress,
        streaks, reviews, and journal. No extra steps needed.
      </p>
      <div className="badges-grid">
        {statuses.map((s) => (
          <div
            key={s.badge.id}
            className={classNames(
              "badge-card",
              `badge-tier-${s.badge.tier}`,
              s.unlocked && "badge-card-unlocked",
            )}
            title={s.badge.description}
          >
            <div className="badge-card-icon"><Icon.Medal size={20} /></div>
            <div className="badge-card-label">{s.badge.label}</div>
            <div className="badge-card-desc">{s.badge.description}</div>
            {!s.unlocked && s.target > 1 && (
              <>
                <div className="badge-card-progress">
                  <div
                    className="badge-card-progress-fill"
                    style={{ width: `${Math.round((s.current / s.target) * 100)}%` }}
                  />
                </div>
                <div className="badge-card-progress-label">{s.current}/{s.target}</div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="panel-actions">
        <button className="secondary-btn" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ============================== PRICING ============================== */
function UsageBar({ label, used, limit }) {
  if (limit == null) return null;
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="pricing-usage-row">
      <div className="pricing-usage-label">
        <span>{label}</span>
        <span>{used}/{limit}</span>
      </div>
      <div className="pricing-usage-track">
        <div
          className={classNames("pricing-usage-fill", pct >= 100 && "pricing-usage-fill-full")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PricingPanel({ onClose, onOpenAccount }) {
  const { data: session } = useSession();
  const [usage, setUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [pendingTier, setPendingTier] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!session?.user) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    setLoadingUsage(true);
    fetchSubscriptionStatus().then((res) => {
      if (cancelled) return;
      setLoadingUsage(false);
      if (res.ok) setUsage(res.usage);
    });
    return () => { cancelled = true; };
  }, [session?.user]);

  const currentTier = usage?.tier || (session?.user ? "free" : null);

  const handleUpgrade = async (tierId) => {
    if (!session?.user) {
      onOpenAccount?.();
      return;
    }
    setPendingTier(tierId);
    setNotice(null);
    const result = await requestUpgrade(tierId);
    setPendingTier(null);
    setNotice(result.error || "Upgraded!");
  };

  return (
    <div className="pricing-panel">
      <div className="pricing-intro">
        <p className="pricing-intro-lead">
          AI runs on your OpenRouter key today — unlimited on Recruit. Operator and Architect
          will add managed AI with monthly quotas once checkout ships.
        </p>
      </div>

      <div className="pricing-grid">
        {TIER_ORDER.map((id) => {
          const tier = SUBSCRIPTION_TIERS[id];
          const isCurrent = currentTier === id;
          return (
            <div
              key={id}
              className={classNames(
                "pricing-card",
                `pricing-card-${id}`,
                isCurrent && "pricing-card-current",
                tier.comingSoon && "pricing-card-soon",
              )}
            >
              {isCurrent && <div className="pricing-card-badge">Current</div>}
              {tier.comingSoon && !isCurrent && (
                <div className="pricing-card-badge pricing-card-badge-soon">Coming soon</div>
              )}
              <div className="pricing-card-rank">{tier.rankLabel}</div>
              <div className="pricing-card-price">
                {tier.priceMonthlyUsd === 0 ? (
                  <>Free</>
                ) : (
                  <>
                    <span className="pricing-card-amount">${tier.priceMonthlyUsd}</span>
                    <span className="pricing-card-period">/mo</span>
                  </>
                )}
              </div>
              <p className="pricing-card-tagline">{tier.tagline}</p>
              <ul className="pricing-card-features">
                {tier.features.map((f) => (
                  <li key={f}>
                    <Icon.Check size={13} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {id === "free" ? (
                <div className="pricing-card-static">
                  {isCurrent ? "Your plan" : "Always available"}
                </div>
              ) : tier.comingSoon ? (
                <div className="pricing-card-static">Coming soon</div>
              ) : (
                <button
                  type="button"
                  className="pricing-card-btn"
                  disabled={isCurrent || pendingTier === id}
                  onClick={() => handleUpgrade(id)}
                >
                  {isCurrent
                    ? "Active"
                    : pendingTier === id
                      ? "Working…"
                      : session?.user
                        ? `Upgrade to ${tier.rankLabel}`
                        : `Sign in to get ${tier.rankLabel}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {session?.user && usage && !loadingUsage && (
        <div className="pricing-usage">
          <div className="pricing-usage-title">This period</div>
          <UsageBar
            label="AI-generated plans"
            used={usage.planGenerationsUsed}
            limit={usage.planGenerationsLimit}
          />
          <UsageBar
            label="AI actions"
            used={usage.aiActionsUsed}
            limit={usage.aiActionsLimit}
          />
          {(usage.planGenerationsLimit != null || usage.aiActionsLimit != null) && (
            <div className="pricing-usage-reset">
              Resets {new Date(usage.periodResetAt).toLocaleDateString()}
            </div>
          )}
          {usage.planGenerationsLimit == null && usage.aiActionsLimit == null && (
            <div className="pricing-usage-reset">
              Recruit · unlimited on your OpenRouter key
            </div>
          )}
        </div>
      )}

      {notice && <div className="pricing-notice" role="status">{notice}</div>}

      <div className="pricing-actions">
        <button className="pricing-close" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/* ============================== VIEW TABS ============================== */
export function ViewTabs({ view, setView, dueCount }) {
  const tabs = [
    { key: "console", label: "Console", icon: Icon.Terminal },
    { key: "grid", label: "Grid", icon: Icon.Grid },
    { key: "review", label: "Review", icon: Icon.Rotate, badge: dueCount },
    { key: "weekly", label: "Weekly", icon: Icon.Calendar },
    { key: "learned", label: "Learned", icon: Icon.Note },
    { key: "bookmarks", label: "Bookmarks", icon: Icon.Link },
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
export function PeriodNav({ scopes, scope, setScope, periods, periodIdx, setPeriodIdx, accent, activeDayNum }) {
  const stripRef = useRef(null);
  const activePeriod = periods ? periods[Math.min(periodIdx, periods.length - 1)] : null;

  useEffect(() => {
    if (!stripRef.current) return;
    const el = stripRef.current.querySelector('[data-period-active="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [periodIdx, scope]);

  return (
    <div className="period-nav" style={{ "--accent": accent }}>
      <div className="scope-row">
        <div className="field-ops-kicker" aria-hidden="true">
          <span className="field-ops-kicker-mark" />
          <span>Time slice</span>
        </div>
        <div className="scope-btns" role="group" aria-label="Time range">
          {scopes.map((sc) => (
            <button
              key={sc.key}
              type="button"
              className={classNames("scope-btn", scope === sc.key && "scope-btn-active")}
              onClick={() => setScope(sc.key)}
            >
              {sc.label}
            </button>
          ))}
        </div>
        {activePeriod && (
          <div className="period-summary" aria-live="polite">
            <span className="period-summary-stamp">{activePeriod.label}</span>
            <span className="period-summary-stat">
              {activePeriod.done}/{activePeriod.total}
            </span>
            <span className="period-summary-sep">topics</span>
            <span className="period-summary-pct">{activePeriod.pct}%</span>
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
                type="button"
                data-period-active={isActive ? "true" : "false"}
                className={classNames(
                  "period-chip",
                  isActive && "period-chip-active",
                  complete && "period-chip-complete",
                  holdsCurrent && "period-chip-here",
                )}
                onClick={() => setPeriodIdx(i)}
              >
                <div className="period-chip-top">
                  <span className="period-chip-label">{p.label}</span>
                  {holdsCurrent && <span className="period-here">YOU</span>}
                  {complete && !holdsCurrent && <span className="period-done-mark">✓</span>}
                </div>
                <div className="period-chip-sub">{p.sub}</div>
                <div className="period-chip-track" aria-hidden="true">
                  <div className="period-chip-fill" style={{ width: p.pct + "%" }} />
                </div>
                <div className="period-chip-meta">
                  <span>D{p.start}–{p.end}</span>
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
export function DomainLegend({ tally, active, setActive }) {
  const { domainColors } = useContext(ThemeCtx);
  const domains = Object.keys(DOMAIN_META).filter((k) => tally[k]);
  const activeMeta = active && DOMAIN_META[active] ? DOMAIN_META[active] : null;
  return (
    <div className="domain-legend" role="group" aria-label="Filter by domain">
      <div className="domain-legend-head">
        <span className="field-ops-kicker" aria-hidden="true">
          <span className="field-ops-kicker-mark" />
          <span>Sectors</span>
        </span>
        {activeMeta && (
          <button
            type="button"
            className="domain-legend-clear"
            onClick={() => setActive(null)}
          >
            Clear · {activeMeta.label}
          </button>
        )}
      </div>
      <div className="domain-legend-grid">
        {domains.map((k) => {
          const meta = DOMAIN_META[k];
          const color = domainColors[k];
          const t = tally[k];
          const pct = t ? Math.round((t.done / t.total) * 100) : 0;
          const isActive = active === k;
          return (
            <button
              key={k}
              type="button"
              className={classNames("domain-meter", isActive && "domain-meter-active")}
              style={{ "--dot": color }}
              onClick={() => setActive(isActive ? null : k)}
              title={`${meta.label}: ${t.done}/${t.total} complete`}
              aria-pressed={isActive}
            >
              <span className="domain-meter-top">
                <span className="domain-meter-dot" />
                <span className="domain-meter-pct">{pct}%</span>
              </span>
              <span className="domain-meter-track" aria-hidden="true">
                <span className="domain-meter-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="domain-meter-label">{meta.label}</span>
              <span className="domain-meter-count">{t.done}/{t.total}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== CONSOLE VIEW ============================== */
const CONSOLE_LAYOUT_KEY = "dualtrack:console-layout";
const CONSOLE_LAYOUTS = [
  { key: "list", label: "List", hint: "Dense day rows", Icon: Icon.List },
  { key: "bento", label: "Index", hint: "Asymmetric day cards", Icon: Icon.LayoutDashboard },
  { key: "timeline", label: "Spine", hint: "Alternating mission spine", Icon: Icon.Path },
];

function readConsoleLayout() {
  if (typeof window === "undefined") return "bento";
  try {
    const raw = window.localStorage.getItem(CONSOLE_LAYOUT_KEY);
    if (raw === "list" || raw === "bento" || raw === "timeline") return raw;
  } catch {
    // best-effort only
  }
  return "bento";
}

function DayDetailBody({
  day,
  campaign,
  progress,
  onToggle,
  notes,
  setNote,
  getRelated,
  onJumpDay,
  onOpenTool,
  refs,
  setRef,
}) {
  return (
    <>
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
        <button type="button" className="tool-btn" onClick={() => onOpenTool("quiz", day)}>
          <Icon.Target size={12} /> Quiz me
        </button>
        <button type="button" className="tool-btn" onClick={() => onOpenTool("notes", day)}>
          <Icon.Book size={12} /> Generate notes
        </button>
        <button type="button" className="tool-btn" onClick={() => onOpenTool("linkedin", day)}>
          <Icon.Send size={12} /> Draft post
        </button>
      </div>
      <ReferenceBlock
        data={refs[day.id]}
        onClear={() => setRef(day.id, null)}
        onRegenerate={() => onOpenTool("notes", day)}
      />
      <RelatedDays related={getRelated(day)} onJump={onJumpDay} />
    </>
  );
}

export function ConsoleView({ campaign, days, progress, onToggle, expandedDay, setExpandedDay, topicsDoneCount, isDayComplete, jumpTarget, notes, setNote, getRelated, onJumpDay, onOpenTool, query, refs, setRef }) {
  const listRef = useRef(null);
  const [layout, setLayoutState] = useState(readConsoleLayout);

  const setLayout = useCallback((next) => {
    setLayoutState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CONSOLE_LAYOUT_KEY, next);
    } catch {
      // best-effort only
    }
  }, []);

  useEffect(() => {
    if (jumpTarget && listRef.current) {
      const el = listRef.current.querySelector(`[data-day-id="${jumpTarget.id}"]`);
      if (el) el.scrollIntoView({ block: "center" });
    }
  }, []);

  const dayProps = {
    campaign,
    progress,
    onToggle,
    notes,
    setNote,
    getRelated,
    onJumpDay,
    onOpenTool,
    query,
    refs,
    setRef,
  };

  return (
    <div className="console-shell">
      <div className="console-layout-bar" role="tablist" aria-label="Console layout">
        <span className="field-ops-kicker console-layout-kicker" aria-hidden="true">
          <span className="field-ops-kicker-mark" />
          <span>View</span>
        </span>
        <div className="console-layout-btns">
          {CONSOLE_LAYOUTS.map((opt) => {
            const LayoutIcon = opt.Icon;
            const active = layout === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                aria-selected={active}
                title={opt.hint}
                className={classNames("console-layout-btn", `console-layout-btn-${opt.key}`, active && "console-layout-btn-active")}
                onClick={() => setLayout(opt.key)}
              >
                <span>
                  <LayoutIcon size={13} />
                  {opt.label}
                </span>
                <em>{opt.hint}</em>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={classNames(
          "console-view",
          layout === "list" && "console-list",
          layout === "bento" && "console-bento",
          layout === "timeline" && "console-timeline",
        )}
        ref={listRef}
      >
        {days.length === 0 && <EmptyState />}
        {days.map((day, idx) => {
          const shared = {
            day,
            done: topicsDoneCount(day),
            complete: isDayComplete(day),
            isExpanded: expandedDay === day.id,
            onToggleExpand: () => setExpandedDay(expandedDay === day.id ? null : day.id),
            isCurrent: !!(jumpTarget && jumpTarget.id === day.id),
            ...dayProps,
          };
          if (layout === "list") return <DayRow key={day.id} {...shared} />;
          if (layout === "timeline") return <DayMission key={day.id} {...shared} side={idx % 2 === 0 ? "left" : "right"} />;
          return <DayTile key={day.id} {...shared} />;
        })}
      </div>
    </div>
  );
}

function DayRow({
  day,
  campaign,
  progress,
  onToggle,
  isExpanded,
  onToggleExpand,
  done,
  complete,
  isCurrent,
  notes,
  setNote,
  getRelated,
  onJumpDay,
  onOpenTool,
  query,
  refs,
  setRef,
}) {
  const noteMatch =
    query &&
    query.trim() &&
    (notes[day.id] || "").toLowerCase().includes(query.trim().toLowerCase());
  const rowTone = stickerTone(day.domains?.[0] || "systems-eng", day.day);

  return (
    <div
      data-day-id={day.id}
      className={classNames(
        "day-row",
        `day-row-tone-${rowTone}`,
        complete && "day-row-complete",
        isExpanded && "day-row-expanded",
        isCurrent && !complete && "day-row-current",
      )}
      style={{ "--accent": campaign.accent }}
    >
      <button
        type="button"
        className="day-row-header"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
      >
        <span className={classNames("day-num", complete && "day-num-done")}>
          {complete ? <Icon.Check size={13} /> : <span className="day-num-text">{String(day.day).padStart(3, "0")}</span>}
        </span>
        <span className="day-row-topics-preview">
          {day.topics.map((t, i) => (
            <span
              key={i}
              className={classNames(
                "topic-chip-mini",
                progress[day.id] && progress[day.id][i] && "topic-chip-mini-done",
              )}
              title={t}
            >
              {progress[day.id] && progress[day.id][i] && <Icon.Check size={11} />}
              <span className="topic-chip-mini-label">{t}</span>
            </span>
          ))}
        </span>
        <span className="day-row-right">
          {noteMatch && (
            <span className="note-match" title="Matched inside your notes">note</span>
          )}
          {notes[day.id] && (
            <span className="note-flag" title="This day has notes"><Icon.Note size={12} /></span>
          )}
          {isCurrent && !complete && <span className="current-pill">Now</span>}
          <span className="day-row-frac">{done}/{day.topics.length}</span>
          <Icon.Chevron size={14} className={classNames("chev", isExpanded && "chev-open")} />
        </span>
      </button>
      {isExpanded && (
        <div className="day-row-body">
          <DayDetailBody
            day={day}
            campaign={campaign}
            progress={progress}
            onToggle={onToggle}
            notes={notes}
            setNote={setNote}
            getRelated={getRelated}
            onJumpDay={onJumpDay}
            onOpenTool={onOpenTool}
            refs={refs}
            setRef={setRef}
          />
        </div>
      )}
    </div>
  );
}

function DayTile({
  day,
  campaign,
  progress,
  onToggle,
  isExpanded,
  onToggleExpand,
  done,
  complete,
  isCurrent,
  notes,
  setNote,
  getRelated,
  onJumpDay,
  onOpenTool,
  query,
  refs,
  setRef,
}) {
  const total = day.topics.length || 1;
  const pct = Math.round((done / total) * 100);
  const previewTopics = day.topics.slice(0, 4);
  const extraCount = Math.max(0, day.topics.length - 4);
  const noteMatch =
    query &&
    query.trim() &&
    (notes[day.id] || "").toLowerCase().includes(query.trim().toLowerCase());

  return (
    <article
      data-day-id={day.id}
      className={classNames(
        "day-tile",
        complete && "day-tile-complete",
        isExpanded && "day-tile-expanded",
        isCurrent && !complete && "day-tile-current",
      )}
      style={{ "--accent": campaign.accent }}
    >
      <button
        type="button"
        className="day-tile-face"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
      >
        <div className="day-tile-top">
          <span className={classNames("day-tile-num", complete && "day-tile-num-done", isCurrent && !complete && "day-tile-num-current")}>
            {complete ? (
              <Icon.Check size={13} />
            ) : (
              <span className="day-num-text">{String(day.day).padStart(3, "0")}</span>
            )}
          </span>
          <div className="day-tile-meta">
            {isCurrent && !complete && <span className="current-pill">Now</span>}
            {noteMatch && (
              <span className="note-match" title="Matched inside your notes">
                note
              </span>
            )}
            {notes[day.id] && (
              <span className="note-flag day-tile-note" title="This day has notes">
                <Icon.Note size={12} />
              </span>
            )}
            <span className="day-tile-frac">
              {done}/{day.topics.length}
            </span>
          </div>
        </div>

        <ul className="day-tile-stickers">
          {previewTopics.map((t, i) => {
            const topicDone = !!(progress[day.id] && progress[day.id][i]);
            const tone = stickerTone(day.domains[i] || "systems-eng", i + day.day);
            return (
              <li
                key={i}
                className={classNames(
                  "topic-sticker",
                  `topic-sticker-${tone}`,
                  topicDone && "topic-sticker-done",
                )}
                title={t}
              >
                {topicDone && <Icon.Check size={11} />}
                <span className="topic-sticker-label">{t}</span>
              </li>
            );
          })}
          {extraCount > 0 && <li className="day-tile-more">+{extraCount}</li>}
        </ul>

        <div className="day-tile-progress" aria-hidden="true" title={`${pct}%`}>
          <div className="day-tile-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </button>

      {isExpanded && (
        <div className="day-tile-body">
          <DayDetailBody
            day={day}
            campaign={campaign}
            progress={progress}
            onToggle={onToggle}
            notes={notes}
            setNote={setNote}
            getRelated={getRelated}
            onJumpDay={onJumpDay}
            onOpenTool={onOpenTool}
            refs={refs}
            setRef={setRef}
          />
        </div>
      )}
    </article>
  );
}

/** Neo-brutal pastel tones for Index topic stickers. */
const STICKER_TONES = [
  "mint", "lemon", "coral", "sky", "lilac", "butter", "seafoam", "peach",
  "rose", "lime", "indigo", "amber", "cyan", "magenta", "olive", "slate",
];

function stickerTone(domain, index) {
  const s = String(domain || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return STICKER_TONES[Math.abs(h + index * 5) % STICKER_TONES.length];
}

function DayMission({
  day,
  campaign,
  progress,
  onToggle,
  isExpanded,
  onToggleExpand,
  done,
  complete,
  isCurrent,
  notes,
  setNote,
  getRelated,
  onJumpDay,
  onOpenTool,
  query,
  refs,
  setRef,
  side,
}) {
  const total = day.topics.length || 1;
  const pct = Math.round((done / total) * 100);
  const noteMatch =
    query &&
    query.trim() &&
    (notes[day.id] || "").toLowerCase().includes(query.trim().toLowerCase());

  return (
    <div
      data-day-id={day.id}
      className={classNames(
        "mission-node",
        `mission-node-${side}`,
        complete && "mission-node-complete",
        isExpanded && "mission-node-expanded",
        isCurrent && !complete && "mission-node-current",
      )}
      style={{ "--accent": campaign.accent }}
    >
      <div className="mission-rail" aria-hidden="true">
        <span className={classNames("mission-dot", complete && "mission-dot-done", isCurrent && !complete && "mission-dot-live")}>
          {complete ? <Icon.Check size={11} /> : String(day.day)}
        </span>
      </div>

      <article className="mission-card">
        <button
          type="button"
          className="mission-card-face"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          <div className="mission-card-top">
            <span className="mission-card-label">Day {String(day.day).padStart(3, "0")}</span>
            <div className="mission-card-meta">
              {isCurrent && !complete && <span className="current-pill">Now</span>}
              {noteMatch && <span className="note-match">note</span>}
              {notes[day.id] && (
                <span className="note-flag" title="This day has notes"><Icon.Note size={12} /></span>
              )}
              <span className="mission-card-frac">{done}/{day.topics.length}</span>
            </div>
          </div>
          <ul className="mission-card-stickers">
            {day.topics.map((t, i) => {
              const topicDone = !!(progress[day.id] && progress[day.id][i]);
              const tone = stickerTone(day.domains[i] || "systems-eng", i + day.day);
              return (
                <li
                  key={i}
                  className={classNames(
                    "topic-sticker",
                    `topic-sticker-${tone}`,
                    topicDone && "topic-sticker-done",
                  )}
                  title={t}
                >
                  {topicDone && <Icon.Check size={11} />}
                  <span className="topic-sticker-label">{t}</span>
                </li>
              );
            })}
          </ul>
          <div className="mission-card-progress" aria-hidden="true">
            <div className="mission-card-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </button>

        {isExpanded && (
          <div className="mission-card-body">
            <DayDetailBody
              day={day}
              campaign={campaign}
              progress={progress}
              onToggle={onToggle}
              notes={notes}
              setNote={setNote}
              getRelated={getRelated}
              onJumpDay={onJumpDay}
              onOpenTool={onOpenTool}
              refs={refs}
              setRef={setRef}
            />
          </div>
        )}
      </article>
    </div>
  );
}

export function NoteEditor({ value, onChange, dayNum }) {
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

export function RelatedDays({ related, onJump }) {
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

export function DomainDot({ domain }) {
  const color = useDomainColor(domain);
  return <span className="domain-dot" style={{ background: color }} />;
}

export function DomainTag({ domain }) {
  const color = useDomainColor(domain);
  const meta = DOMAIN_META[domain] || DOMAIN_META["systems-eng"];
  return (
    <span className="domain-tag" style={{ color, borderColor: hexToRgba(color, 0.4), background: hexToRgba(color, 0.09) }}>
      {meta.label}
    </span>
  );
}

export function EmptyState() {
  return (
    <div className="empty-state">
      <Icon.Search size={28} />
      <div className="empty-state-title">No matching transmissions</div>
      <div className="empty-state-sub">Try a different search term or clear the domain filter.</div>
    </div>
  );
}

/* ============================== GRID VIEW (heatmap / signature element) ============================== */
export function GridView({ campaign, days, progress, isDayComplete, topicsDoneCount, notes, onOpenDay }) {
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
export function ReviewView({ queue, srs, notes, scheduledCount, onGrade, onOpenDay }) {
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
export function WeeklyView({ log, notes, progress, srs, campaigns, activeCampaign, onOpenDay, onExport }) {
  const { domainColors } = useContext(ThemeCtx);
  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;

  const allDays = useMemo(
    () => Object.values(campaigns).flatMap((c) => c.days || []),
    [campaigns],
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

  const campaign = campaigns[activeCampaign] || Object.values(campaigns)[0];
  const upcoming = useMemo(() => {
    if (!campaign) return [];
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
export function LogView({ campaign, stats, progress, notes }) {
  const { domainColors } = useContext(ThemeCtx);
  const domainRows = Object.entries(stats.domainTally)
    .sort((a, b) => b[1].total - a[1].total);

  // Bucket by the plan's real section boundaries (month or week scopes)
  const velocityScope = useMemo(() => {
    const scopes = campaign.periodScopes || [];
    return (
      scopes.find((s) => s.key === "month" && s.periods?.length) ||
      scopes.find((s) => s.key === "week" && s.periods?.length) ||
      scopes.find((s) => s.periods?.length) ||
      null
    );
  }, [campaign]);

  const buckets = useMemo(() => {
    const defs = velocityScope?.periods || [];
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
  }, [campaign, progress, velocityScope]);

  const velocityTitle =
    velocityScope?.key === "month"
      ? "MONTHLY VELOCITY"
      : velocityScope?.key === "week"
        ? "WEEKLY VELOCITY"
        : "PERIOD VELOCITY";

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
          <div className="log-panel-title">{velocityTitle}</div>
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

export function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className="summary-card" style={{ "--accent": accent }}>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-sub">{sub}</div>
    </div>
  );
}

/* ============================== MODALS ============================== */
export function ModalHost({ modal, onClose, notes, refs, setRef, appendNote, progress, srs, log, learned, bookmarks, themeKey, onImport, fireToast, plans, activePlanId, onPlanCreated, badgeStatuses, onAccountAuthenticated, onAccountGuest, onOpenPricing, onOpenAccount }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const titles = {
    quiz: "Recall check",
    linkedin: "Draft a post",
    export: "Data",
    notes: "Generate study notes",
    settings: "AI provider",
    builder: "New plan",
    account: "Account & sync",
    badges: "Badges",
    pricing: "Plans & pricing",
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className={classNames(
          "modal",
          (modal.kind === "builder" || modal.kind === "pricing") && "modal-wide",
          modal.kind === "pricing" && "modal-pricing",
          modal.kind === "account" && "modal-account",
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <span className="modal-title">
            {modal.kind === "account" && modal.gated ? "Sign in to continue" : titles[modal.kind]}
            {modal.day ? ` · Day ${modal.day.day}` : ""}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon.X size={15} /></button>
        </div>
        <div className="modal-body">
          {modal.kind === "builder" && (
            <PlanBuilder
              onClose={onClose}
              onSaveDraft={(meta) => {
                if (typeof window !== "undefined") {
                  try {
                    window.sessionStorage.setItem(
                      "dualtrack:builder-draft",
                      JSON.stringify({ meta, at: Date.now() }),
                    );
                  } catch { /* ignore */ }
                }
              }}
              onComplete={(plan) => {
                onPlanCreated?.(plan);
                onClose();
              }}
            />
          )}
          {modal.kind === "settings" && <SettingsPanel onClose={onClose} />}
          {modal.kind === "account" && (
            <AccountPanel
              onClose={onClose}
              showGuestOption={!!modal.gated}
              onAuthenticated={modal.gated ? onAccountAuthenticated : undefined}
              onGuest={modal.gated ? onAccountGuest : undefined}
              onViewPricing={onOpenPricing}
            />
          )}
          {modal.kind === "badges" && <BadgesPanel statuses={badgeStatuses} onClose={onClose} />}
          {modal.kind === "pricing" && (
            <PricingPanel onClose={onClose} onOpenAccount={onOpenAccount} />
          )}
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
            <DataPanel
              progress={progress}
              notes={notes}
              refs={refs}
              srs={srs}
              log={log}
              learned={learned}
              bookmarks={bookmarks}
              themeKey={themeKey}
              onImport={onImport}
              fireToast={fireToast}
              onClose={onClose}
              plans={plans}
              activePlanId={activePlanId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- minimal markdown renderer (headings, lists, code, inline, links) ---------- */
const MD_INLINE_RE = /(\[[^\]]+\]\([^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function linkifyPlain(text, keyBase, startKey) {
  const parts = [];
  const re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
  let last = 0;
  let m;
  let i = startKey;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const href = m[0];
    parts.push(
      <a key={keyBase + "-u" + i} href={href} className="md-a" target="_blank" rel="noopener noreferrer">
        {href}
      </a>,
    );
    last = m.index + href.length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

export function inlineFormat(text, keyBase) {
  const parts = [];
  let last = 0;
  let m;
  let i = 0;
  MD_INLINE_RE.lastIndex = 0;
  while ((m = MD_INLINE_RE.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(...linkifyPlain(text.slice(last, m.index), keyBase, i * 10));
    }
    const tok = m[0];
    if (tok.startsWith("[")) {
      const link = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) {
        parts.push(
          <a
            key={keyBase + "-a" + i}
            href={link[2]}
            className="md-a"
            target="_blank"
            rel="noopener noreferrer"
          >
            {link[1]}
          </a>,
        );
      } else {
        parts.push(tok);
      }
    } else if (tok.startsWith("`")) {
      parts.push(<code key={keyBase + "-c" + i}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      parts.push(<strong key={keyBase + "-b" + i}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("http")) {
      parts.push(
        <a key={keyBase + "-u" + i} href={tok} className="md-a" target="_blank" rel="noopener noreferrer">
          {tok}
        </a>,
      );
    } else {
      parts.push(tok);
    }
    last = m.index + tok.length;
    i += 1;
  }
  if (last < text.length) parts.push(...linkifyPlain(text.slice(last), keyBase, i * 10));
  return parts;
}

export function MiniMarkdown({ text }) {
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

export function NotesGenPanel({ day, existing, onSaveRef, onAppendNote, fireToast }) {
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
      setErr(formatAiError(e));
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
export function ReferenceBlock({ data, onClear, onRegenerate }) {
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

export function QuizPanel({ day, note }) {
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
      const parsed = parseJsonText(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Unexpected format");
      setQuestions(parsed);
      setShown({});
      setState("ready");
    } catch (e) {
      setErr(formatAiError(e));
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

export function LinkedInPanel({ day, note, fireToast }) {
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
      setErr(formatAiError(e));
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

export function DataPanel({
  progress,
  notes,
  refs,
  srs,
  log,
  learned,
  bookmarks,
  themeKey,
  onImport,
  fireToast,
  onClose,
  plans,
  activePlanId,
}) {
  const [importErr, setImportErr] = useState("");
  const [pendingFull, setPendingFull] = useState(null);
  const [sharePlanId, setSharePlanId] = useState(activePlanId || Object.keys(plans || {})[0] || "");
  const fileRef = useRef(null);

  const planList = Object.values(plans || {}).filter((p) => !p.hidden);

  const noteCount = Object.keys(notes).length;
  const doneCount = Object.values(progress).reduce(
    (n, v) => n + Object.values(v).filter(Boolean).length,
    0,
  );

  const saveMd = async () => {
    const md = buildMarkdown(progress, notes, srs, refs, plans, learned);
    if (!downloadText("refrainly-notes.md", md, "text/markdown")) {
      const ok = await copyText(md);
      fireToast(ok ? "Markdown copied to clipboard" : "Export failed", "xp");
    } else fireToast("Markdown exported", "xp");
  };

  const saveJson = async () => {
    try {
      const payload = exportAll({
        plans: plans || seedBuiltinPlans(),
        userdata: { progress, notes, refs, srs, log, learned: learned || {}, bookmarks: bookmarks || [] },
        themeKey,
        activePlanId,
      });
      const js = serializeExport(payload);
      if (!downloadText("refrainly-backup.json", js, "application/json")) {
        const ok = await copyText(js);
        fireToast(ok ? "Backup copied to clipboard" : "Export failed", "xp");
      } else fireToast("Backup exported", "xp");
    } catch (err) {
      fireToast(err.message || "Export failed", "xp");
    }
  };

  const savePlanShare = async () => {
    const plan = plans?.[sharePlanId];
    if (!plan) {
      fireToast("Pick a plan to share", "xp");
      return;
    }
    try {
      const payload = exportPlan(plan);
      const js = serializeExport(payload);
      const safeName = (plan.name || "plan").replace(/[^\w\-]+/g, "-").slice(0, 40);
      if (!downloadText(`refrainly-plan-${safeName}.json`, js, "application/json")) {
        const ok = await copyText(js);
        fireToast(ok ? "Plan copied to clipboard" : "Export failed", "xp");
      } else fireToast("Plan share exported", "xp");
    } catch (err) {
      fireToast(err.message || "Export failed", "xp");
    }
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setImportErr("");
    setPendingFull(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const detected = detectImport(raw);
        if (detected.kind === "dualtrack-plan") {
          const { plans: nextPlans, plan } = applyPlanImport(plans || {}, detected.plan);
          onImport({ kind: "plan", plans: nextPlans, plan });
          fireToast(`Plan imported · ${plan.name}`, "day");
          onClose();
          return;
        }
        setPendingFull(detected.backup);
      } catch (err) {
        setImportErr(err.message || "That file could not be read");
      }
    };
    reader.onerror = () => setImportErr("That file could not be read");
    reader.readAsText(f);
  };

  const confirmFullImport = (mode) => {
    if (!pendingFull) return;
    try {
      const slice = applyFullImport(
        {
          plans: plans || seedBuiltinPlans(),
          progress,
          notes,
          refs,
          srs,
          log,
          learned: learned || {},
          bookmarks: bookmarks || [],
          themeKey,
          activePlanId,
        },
        pendingFull,
        mode,
      );
      onImport({ kind: "full", slice });
      fireToast(mode === "merge" ? "Backup merged" : "Backup restored", "day");
      setPendingFull(null);
      onClose();
    } catch (err) {
      setImportErr(err.message || "Import failed");
    }
  };

  return (
    <div className="data-panel">
      <div className="data-stat">
        {doneCount} topics complete · {noteCount} days with notes
      </div>

      <div className="data-section">
        <div className="data-section-title">Export</div>
        <p className="panel-copy">
          Markdown for readable notes. Full backup restores everything later.
          Plan share is definition-only — safe to send without progress or keys.
        </p>
        <div className="panel-actions">
          <button className="primary-btn" onClick={saveMd}>
            Notes as markdown
          </button>
          <button className="secondary-btn" onClick={saveJson}>
            Full backup (JSON)
          </button>
        </div>
        <div className="data-share-row">
          <select
            className="settings-input"
            value={sharePlanId}
            onChange={(e) => setSharePlanId(e.target.value)}
            aria-label="Plan to share"
          >
            {planList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="secondary-btn" onClick={savePlanShare} disabled={!sharePlanId}>
            Share plan (JSON)
          </button>
        </div>
      </div>

      <div className="data-section">
        <div className="data-section-title">Import</div>
        <p className="panel-copy">
          Plan shares are added alongside your plans. Full backups ask merge or replace.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          style={{ display: "none" }}
        />
        {!pendingFull ? (
          <button
            className="secondary-btn"
            onClick={() => fileRef.current && fileRef.current.click()}
          >
            Choose JSON file
          </button>
        ) : (
          <div className="builder-confirm">
            <p className="panel-copy">
              Full backup from {pendingFull.exportedAt?.slice?.(0, 10) || "unknown date"}.
              Merge keeps your data and overlays the file. Replace wipes local progress/notes.
            </p>
            <div className="panel-actions">
              <button className="secondary-btn" onClick={() => setPendingFull(null)}>
                Cancel
              </button>
              <button className="secondary-btn" onClick={() => confirmFullImport("merge")}>
                Merge
              </button>
              <button className="primary-btn" onClick={() => confirmFullImport("replace")}>
                Replace
              </button>
            </div>
          </div>
        )}
        {importErr && <div className="panel-error">{importErr}</div>}
      </div>
    </div>
  );
}

/* ============================== TOAST + CONFETTI ============================== */
export function ToastLayer({ toast }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className={classNames("toast", toast.kind === "day" && "toast-day")}>
      {toast.kind === "day" ? <Icon.Trophy size={14} /> : <Icon.Bolt size={14} />}
      <span>{toast.msg}</span>
    </div>
  );
}

export function ConfettiBurst({ color }) {
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
export function Footer() {
  return (
    <footer className="app-footer">
      <span>REFRAINLY · chart the arc · progress and notes save automatically</span>
    </footer>
  );
}



