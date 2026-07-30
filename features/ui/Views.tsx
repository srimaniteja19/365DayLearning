// @ts-nocheck
"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect, useContext } from "react";
import { useSession } from "next-auth/react";
import DOMAIN_META from "@/data/domains.json";
import { Icon } from "@/components/Icon";
import { Tip } from "@/components/Tip";
import { PricingUsageSkeleton } from "@/components/Skeleton";
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
import { safeHref } from "@/lib/safeHref";
import {
  SUBSCRIPTION_TIERS,
  TIER_ORDER,
  fetchSubscriptionStatus,
  openBillingPortal,
  requestUpgrade,
} from "@/lib/subscriptions";
import { parseJsonText } from "@/lib/stripFences";
import { downloadText, copyText } from "@/lib/fileIo";
import { buildMarkdown } from "@/lib/markdown";
import { relativeDue, SRS_INTERVALS, DAY_MS, dueList } from "@/lib/srs";
import { seedBuiltinPlans } from "@/data/builtinPlans";
import { HomeView } from "@/features/landing/HomeView";
export { HomeView };
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
  loading: "Loading saved progress from your account",
  idle: "Progress saved to your account automatically",
  saving: "Saving to your account",
  saved: "Saved to your account",
  error: "Cloud save failed — click to retry",
  off: "Sign in to sync progress across devices",
};

function SaveIndicator({ status, compact = false, onRetry }) {
  const label = status === "saving" ? "Saving…"
    : status === "saved" ? "Saved"
    : status === "error" ? "Not saved"
    : status === "loading" ? "Loading…"
    : status === "off" ? "Session only"
    : "Autosaved";
  const tip = SAVE_COPY[status] || SAVE_COPY.idle;
  const body = (
    <>
      <span className="save-dot" />
      {!compact && <span className="stat-chip-val">{label}</span>}
    </>
  );
  const className = classNames(
    "stat-chip",
    "save-chip",
    `save-${status}`,
    compact && "save-chip-compact",
  );
  if (status === "error" && typeof onRetry === "function") {
    return (
      <Tip content={tip} stamp="SYNC" tone="coral" side="bottom">
        <button
          type="button"
          className={className}
          aria-label={`${tip}. Retry sync.`}
          onClick={onRetry}
        >
          {body}
        </button>
      </Tip>
    );
  }
  return (
    <Tip content={tip} stamp="SYNC" tone={status === "saved" ? "mint" : "lemon"} side="bottom">
      <div className={className} aria-label={tip} tabIndex={0}>
        {body}
      </div>
    </Tip>
  );
}

function ThemePicker({ themeKey, setThemeKey }) {
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
        aria-label="Swap Field Ops colorway"
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

function FontPicker({ fontKey, setFontKey }) {
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
        aria-label="Pick a type pack"
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
  onRetrySync,
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
  kitTab = null,
  learnedCount = 0,
  bookmarkCount = 0,
  onOpenKit,
  onOpenCampaign,
}) {
  const pct = stats.need ? Math.min(100, Math.round((stats.into / stats.need) * 100)) : 0;
  const [opsOpen, setOpsOpen] = useState(false);
  const opsRef = useRef(null);

  useEffect(() => {
    if (!opsOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpsOpen(false);
    };
    const onPointer = (e) => {
      if (opsRef.current && !opsRef.current.contains(e.target)) setOpsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [opsOpen]);

  const go = (fn) => () => {
    setOpsOpen(false);
    setConfirmReset(false);
    fn?.();
  };

  return (
    <header className={classNames("topbar", opsOpen && "topbar-ops-open")}>
      <div className="topbar-row">
        <div className="topbar-left">
          <button className="brand brand-btn" onClick={onGoHome} type="button" aria-label="Back to landing">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-stack">
              <span className="brand-kicker">Field ops</span>
              <span className="brand-text">REFRAIN<span className="brand-accent">LY</span></span>
            </span>
          </button>

          {onOpenKit && (
            <nav className="topbar-cluster topbar-cluster-kit" aria-label="Field kit">
              <span className="topbar-cluster-tag" aria-hidden="true">Kit</span>
              <Tip content="Off-plan notes — independent of any campaign." stamp="LOG" tone="mint" side="bottom">
                <button
                  type="button"
                  className={classNames("topbar-item", kitTab === "learned" && "topbar-item-active")}
                  aria-pressed={kitTab === "learned"}
                  onClick={() => onOpenKit("learned")}
                >
                  <Icon.Note size={13} />
                  <span className="topbar-item-label">Notes</span>
                  <span className="topbar-kit-count">{learnedCount}</span>
                </button>
              </Tip>
              <Tip content="Pinned bookmarks — videos, articles, docs outside the plan." stamp="BM" tone="violet" side="bottom">
                <button
                  type="button"
                  className={classNames(
                    "topbar-item",
                    kitTab === "bookmarks" && "topbar-item-active topbar-item-refs",
                  )}
                  aria-pressed={kitTab === "bookmarks"}
                  onClick={() => onOpenKit("bookmarks")}
                >
                  <Icon.Link size={13} />
                  <span className="topbar-item-label">Bookmarks</span>
                  <span className="topbar-kit-count">{bookmarkCount}</span>
                </button>
              </Tip>
            </nav>
          )}

          {kitTab && onOpenCampaign && (
            <button
              type="button"
              className="topbar-deck-btn"
              onClick={onOpenCampaign}
            >
              <Icon.LayoutDashboard size={13} />
              <span>Deck</span>
            </button>
          )}
        </div>

        <div className="topbar-right">
          <div className="topbar-cluster topbar-cluster-look" aria-label="Appearance">
            <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
            <FontPicker fontKey={fontKey} setFontKey={setFontKey} />
          </div>

          <div className="topbar-cluster topbar-cluster-status" aria-label="Progress">
            <SaveIndicator status={saveStatus} compact onRetry={onRetrySync} />
            {noteCount > 0 && (
              <div
                className="topbar-item topbar-item-static topbar-day-notes"
                title={`${noteCount} campaign days with day notes (separate from Field Kit Notes)`}
              >
                <Icon.Note size={13} />
                <span className="topbar-item-label topbar-day-notes-label">Day notes</span>
                <span>{noteCount}</span>
              </div>
            )}
            <div
              className="topbar-item topbar-item-static topbar-progress"
              title={`${stats.rank} · Level ${stats.level} · ${stats.xp.toLocaleString()} XP`}
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
          </div>

          <div
            className="topbar-mobile-lv"
            title={`${stats.rank} · Level ${stats.level} · ${stats.xp.toLocaleString()} XP`}
          >
            <span className="level-badge">LV {stats.level}</span>
            <div className="xp-bar-mini" aria-hidden="true">
              <div className="xp-bar-mini-fill" style={{ width: pct + "%" }} />
            </div>
          </div>

          <div className="topbar-ops" ref={opsRef}>
            {opsOpen && (
              <button
                type="button"
                className="topbar-ops-scrim"
                aria-label="Close ops menu"
                onClick={() => setOpsOpen(false)}
              />
            )}
            <button
              type="button"
              className={classNames("topbar-ops-trigger", opsOpen && "is-on")}
              aria-expanded={opsOpen}
              aria-controls="topbar-ops-panel"
              onClick={() => setOpsOpen((v) => !v)}
            >
              {opsOpen ? <Icon.X size={16} /> : <Icon.Menu size={16} />}
              <span className="topbar-ops-trigger-label">Ops</span>
            </button>

            {opsOpen && (
              <div id="topbar-ops-panel" className="topbar-ops-panel" role="menu">
                <div className="topbar-ops-head">
                  <span className="topbar-ops-stamp">Ops manual</span>
                  <span className="topbar-ops-head-meta">Station · notes · bookmarks</span>
                </div>

                <div className="topbar-ops-section">
                  <div className="topbar-ops-label">Navigate</div>
                  {onOpenCampaign && (
                    <button type="button" role="menuitem" className="topbar-ops-item" onClick={go(onOpenCampaign)}>
                      <Icon.LayoutDashboard size={14} />
                      <span>Campaign deck</span>
                    </button>
                  )}
                  {onOpenKit && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className={classNames("topbar-ops-item", kitTab === "learned" && "is-on")}
                        onClick={go(() => onOpenKit("learned"))}
                      >
                        <Icon.Note size={14} />
                        <span>Notes</span>
                        <span className="topbar-ops-meta">{learnedCount}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={classNames("topbar-ops-item", kitTab === "bookmarks" && "is-on")}
                        onClick={go(() => onOpenKit("bookmarks"))}
                      >
                        <Icon.Link size={14} />
                        <span>Bookmarks</span>
                        <span className="topbar-ops-meta">{bookmarkCount}</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="topbar-ops-section">
                  <div className="topbar-ops-label">Station</div>
                  <button type="button" role="menuitem" className="topbar-ops-item" onClick={go(onNewPlan)}>
                    <Icon.Target size={14} />
                    <span>New plan</span>
                  </button>
                  <button type="button" role="menuitem" className="topbar-ops-item" onClick={go(onOpenSettings)}>
                    <Icon.Cloud size={14} />
                    <span>AI settings</span>
                  </button>
                  <button type="button" role="menuitem" className="topbar-ops-item" onClick={go(onOpenPricing)}>
                    <Icon.Sparkle size={14} />
                    <span>Pricing plans</span>
                  </button>
                  <button type="button" role="menuitem" className="topbar-ops-item" onClick={go(onOpenData)}>
                    <Icon.Download size={14} />
                    <span>Data & export</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={classNames("topbar-ops-item", accountLabel && "is-on")}
                    onClick={go(onOpenAccount)}
                  >
                    <Icon.User size={14} />
                    <span>{accountLabel ? "Account" : "Sign in"}</span>
                  </button>
                </div>

                <div className="topbar-ops-section">
                  <div className="topbar-ops-label">Awards</div>
                  <button type="button" role="menuitem" className="topbar-ops-item" onClick={go(onOpenBadges)}>
                    <Icon.Medal size={14} />
                    <span>Badges</span>
                    <span className="topbar-ops-meta">{badgeCount}/{badgeTotal}</span>
                  </button>
                </div>

                <div className="topbar-ops-section topbar-ops-look-mobile" aria-label="Appearance">
                  <div className="topbar-ops-label">Look</div>
                  <div className="topbar-ops-look-row">
                    <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
                    <FontPicker fontKey={fontKey} setFontKey={setFontKey} />
                  </div>
                </div>

                <div className="topbar-ops-section topbar-ops-danger">
                  <div className="topbar-ops-label">Danger</div>
                  {confirmReset ? (
                    <div className="topbar-ops-confirm">
                      <span>Erase all local data?</span>
                      <button type="button" className="topbar-ops-confirm-yes" onClick={go(onReset)}>
                        Erase
                      </button>
                      <button type="button" className="topbar-ops-confirm-no" onClick={() => setConfirmReset(false)}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className="topbar-ops-item topbar-ops-item-danger"
                      onClick={() => setConfirmReset(true)}
                    >
                      <Icon.Rotate size={14} />
                      <span>Reset device data</span>
                    </button>
                  )}
                </div>
              </div>
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
                  style={{ "--accent": c.accent, "--glow": c.glow }}
                  onClick={() => setActive(planId)}
                >
                  <span className="switcher-dot" style={{ background: c.accent }} />
                  <span className="switcher-name">{c.name}</span>
                  {pct > 0 && <span className="switcher-pct">{pct}%</span>}
                </button>
                <button
                  type="button"
                  className="switcher-delete"
                  aria-label={c.builtin ? "Hide built-in plan" : "Delete plan"}
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
      >
        <span className="switcher-plus">＋</span>
        <span className="switcher-name">New</span>
      </button>
    </div>
  );
}

/* ============================== LANDING (re-exported from features/landing) ============================== */

export function CampaignHero({
  campaign,
  stats,
  progress,
  onToggle,
  onGenerateTopicResources,
  generatingTopicKey,
}) {
  const activeDay = stats.activeDay;
  const dayProgress = activeDay && progress ? progress[activeDay.id] : null;
  const doneCount = activeDay
    ? activeDay.topics.filter((_, i) => dayProgress && dayProgress[i]).length
    : 0;
  return (
    <header className="hero" style={{ "--accent": campaign.accent, "--glow": campaign.glow }}>
      <div className="hero-mast">
        <div className="hero-mast-head">
          <div className="hero-kicker">
            <span className="hero-kicker-mark" aria-hidden="true" />
            <span>Field log · active campaign</span>
          </div>
          <span className="hero-live-stamp">Live</span>
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
          <Metric label="Days" value={`${stats.daysComplete}/${stats.totalDays}`} tone="mint" />
          <Metric label="Topics" value={`${stats.doneTopics}/${stats.totalTopics}`} tone="sky" />
          <Metric
            label="Streak"
            value={`${stats.streak}d`}
            tone="coral"
            icon={stats.streak > 0 ? <Icon.Flame size={13} /> : null}
          />
        </div>
      </div>
      {activeDay && (
        <aside className="hero-dispatch">
          <div className="hero-dispatch-frame" aria-hidden="true" />
          <div className="next-mission-label">
            <span className="next-mission-kicker">
              <Icon.Target size={13} />
              <span>Next dispatch</span>
            </span>
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
                    <span className="next-mission-idx">{i + 1}</span>
                    <span className="topic-text">{t}</span>
                    <TopicResourceControls
                      resourceSlot={activeDay.resources?.[i]}
                      compact
                      generating={generatingTopicKey === `${activeDay.id}:${i}`}
                      onGenerate={
                        onGenerateTopicResources
                          ? () => onGenerateTopicResources(activeDay, i)
                          : undefined
                      }
                    />
                  </label>
                </li>
              );
            })}
          </ol>
          <div className="next-mission-foot" aria-live="polite">
            <span className="next-mission-foot-stamp">{doneCount}/{activeDay.topics.length}</span>
            <span>marked</span>
          </div>
        </aside>
      )}
    </header>
  );
}

function Metric({ label, value, icon, tone = "mint" }) {
  return (
    <div className={classNames("metric", `metric-tone-${tone}`)} role="listitem">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{icon}{value}</div>
    </div>
  );
}

/** Segmented progress — readable without color alone (waffle / bullet chart). */
function BulletTrack({ pct, segments = 20 }) {
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

export function OnThisDayCard({ memory, onDismiss, onOpen }) {
  if (!memory) return null;
  const canOpen = typeof onOpen === "function";
  const open = () => onOpen?.(memory);
  return (
    <div className={classNames("today-widget on-this-day-card", canOpen && "on-this-day-card-openable")}>
      <div className="today-widget-icon" aria-hidden="true"><Icon.Calendar size={15} /></div>
      {canOpen ? (
        <button type="button" className="today-widget-body today-widget-body-btn" onClick={open}>
          <div className="today-widget-eyebrow">
            <span className="today-widget-stamp">On this day</span>
            <span>{agoLabel(memory.daysAgo)}</span>
          </div>
          {memory.kind === "journal" ? (
            <>
              <div className="today-widget-title">{memory.title}</div>
              {memory.snippet && <p className="today-widget-copy">{memory.snippet}</p>}
              <span className="today-widget-cta">Open in Notes →</span>
            </>
          ) : (
            <>
              <div className="today-widget-title">{memory.dayLabel} · {memory.planName}</div>
              <p className="today-widget-copy">{memory.topics.join(" · ")}</p>
            </>
          )}
        </button>
      ) : (
        <div className="today-widget-body">
          <div className="today-widget-eyebrow">
            <span className="today-widget-stamp">On this day</span>
            <span>{agoLabel(memory.daysAgo)}</span>
          </div>
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
      )}
      <Tip content="Hide until tomorrow — another memory may surface next visit." stamp="DISMISS" tone="ink" side="left">
        <button type="button" className="today-widget-dismiss" onClick={onDismiss} aria-label="Dismiss">
          <Icon.X size={12} />
        </button>
      </Tip>
    </div>
  );
}

/* ============================== BADGES ============================== */
function BadgesPanel({ statuses, onClose }) {
  const unlockedCount = statuses.filter((s) => s.unlocked).length;
  return (
    <div className="settings-panel badges-panel">
      <p className="panel-copy">
        {unlockedCount} of {statuses.length} unlocked — earned automatically from your progress,
        streaks, reviews, and journal. No extra steps needed.
      </p>
      <div className="badges-grid">
        {statuses.map((s) => (
          <Tip
            key={s.badge.id}
            content={
              s.unlocked
                ? `${s.badge.description} · Unlocked.`
                : `${s.badge.description}${s.target > 1 ? ` · ${s.current}/${s.target}` : ""}`
            }
            stamp={String(s.badge.tier).toUpperCase()}
            tone={s.unlocked ? "mint" : s.badge.tier === "gold" ? "lemon" : s.badge.tier === "silver" ? "sky" : "coral"}
            side="top"
            maxWidth={260}
          >
            <div
              className={classNames(
                "badge-card",
                `badge-tier-${s.badge.tier}`,
                s.unlocked && "badge-card-unlocked",
              )}
              tabIndex={0}
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
          </Tip>
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

function PricingPanel({ onClose, onOpenAccount, refreshToken = 0 }) {
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
  }, [session?.user, refreshToken]);

  const currentTier = usage?.tier || (session?.user ? "free" : null);
  const liveSub = usage?.status === "active" || usage?.status === "trialing" || usage?.status === "past_due";
  const pastDue = usage?.status === "past_due";

  const handleUpgrade = async (tierId) => {
    if (!session?.user) {
      onOpenAccount?.();
      return;
    }
    setPendingTier(tierId);
    setNotice(null);
    const result = await requestUpgrade(tierId);
    setPendingTier(null);
    if (result.ok && result.url) {
      window.location.href = result.url;
      return;
    }
    setNotice(result.error || "Could not start checkout.");
  };

  const handlePortal = async () => {
    setNotice(null);
    const result = await openBillingPortal();
    if (result.ok && result.url) {
      window.location.href = result.url;
      return;
    }
    setNotice(result.error || "Could not open billing portal.");
  };

  return (
    <div className="pricing-panel">
      <div className="pricing-intro">
        <p className="pricing-intro-lead">
          Recruit is free with your OpenRouter key. Operator and Architect unlock managed AI
          with monthly quotas — checkout via Stripe, invoices included.
        </p>
      </div>

      {pastDue && (
        <div className="pricing-notice" role="status">
          Payment failed — update your card to keep managed AI. Your plan stays active while
          Stripe retries.
        </div>
      )}

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
              {isCurrent && <div className="pricing-card-badge">{pastDue ? "Past due" : "Current"}</div>}
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
              ) : pastDue && isCurrent ? (
                <button type="button" className="pricing-card-btn" onClick={handlePortal}>
                  Update payment method
                </button>
              ) : (
                <button
                  type="button"
                  className="pricing-card-btn"
                  disabled={(isCurrent && !pastDue) || pendingTier === id}
                  onClick={() => handleUpgrade(id)}
                >
                  {isCurrent
                    ? "Active"
                    : pendingTier === id
                      ? "Working…"
                      : !session?.user
                        ? `Sign in to get ${tier.rankLabel}`
                        : liveSub
                          ? `Change to ${tier.rankLabel}`
                          : `Upgrade to ${tier.rankLabel}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {session?.user && loadingUsage && <PricingUsageSkeleton />}

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
          {usage.hasBillingAccount && (
            <button type="button" className="pricing-card-btn" onClick={handlePortal}>
              Manage billing &amp; invoices
            </button>
          )}
        </div>
      )}

      {notice && <div className="pricing-notice" role="status">{notice}</div>}
    </div>
  );
}

/* ============================== VIEW TABS ============================== */
export function ViewTabs({ view, setView, dueCount }) {
  const primary = [
    { key: "console", label: "Console", icon: Icon.Terminal, stamp: "LIST", tone: "ink", tip: "Day-by-day mission list — check topics, jot notes, run tools." },
    { key: "review", label: "Review", icon: Icon.Rotate, badge: dueCount, stamp: "SRS", tone: "coral", tip: dueCount > 0 ? `${dueCount} topic${dueCount === 1 ? "" : "s"} due for spaced recall.` : "Spaced-repetition queue — nothing due right now." },
    { key: "grid", label: "Grid", icon: Icon.Grid, stamp: "MAP", tone: "sky", tip: "Heatmap of every day. Spot gaps and jump straight to a cell." },
  ];
  const secondary = [
    { key: "weekly", label: "Weekly", icon: Icon.Calendar, stamp: "7D", tone: "lemon", tip: "Last seven days of clears, notes, and open questions." },
    { key: "log", label: "Analytics", icon: Icon.List, stamp: "STATS", tone: "ink", tip: "Completion, streaks, and domain coverage for this plan." },
  ];
  const renderTab = (t, secondaryTone = false) => (
    <Tip key={t.key} content={t.tip} stamp={t.stamp} tone={t.tone} side="bottom">
      <button
        className={classNames(
          "view-tab",
          view === t.key && "view-tab-active",
          secondaryTone && "view-tab-secondary",
        )}
        onClick={() => setView(t.key)}
      >
        <t.icon size={13} /> {t.label}
        {view === t.key && <span className="view-tab-stamp">{t.stamp}</span>}
        {t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
      </button>
    </Tip>
  );
  return (
    <div className="view-tabs">
      {primary.map((t) => renderTab(t))}
      <span className="view-tabs-divider" aria-hidden="true" />
      {secondary.map((t) => renderTab(t, true))}
    </div>
  );
}

/* ============================== FIELD KIT ============================== */
export function FieldKitChrome({
  tab,
  setTab,
  learnedCount,
  bookmarkCount,
  hasCampaign,
  onBackToCampaign,
  accent,
  lensQuery = "",
  setLensQuery,
}) {
  return (
    <section className="field-kit" style={{ "--accent": accent }} aria-label="Field kit">
      <div className="field-kit-glow" aria-hidden="true" />
      <div className="field-kit-mast">
        <div className="field-kit-copy">
          <span className="field-kit-stamp">Field kit</span>
          <h2 className="field-kit-title">
            Off-plan
            <span className="field-kit-title-accent"> inventory</span>
          </h2>
          <p className="field-kit-lead">
            Notes and bookmarks live outside every campaign — rabbit holes, talks, and links that
            don&apos;t belong on a day card.
          </p>
        </div>
        <div className="field-kit-meter" aria-hidden="true">
          <div className="field-kit-meter-cell">
            <span className="field-kit-meter-val">{String(learnedCount).padStart(2, "0")}</span>
            <span className="field-kit-meter-label">Notes</span>
          </div>
          <div className="field-kit-meter-cell field-kit-meter-cell-accent">
            <span className="field-kit-meter-val">{String(bookmarkCount).padStart(2, "0")}</span>
            <span className="field-kit-meter-label">Bookmarks</span>
          </div>
        </div>
      </div>

      <div className="field-kit-rail">
        <div className="field-kit-tabs" role="tablist" aria-label="Field kit sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "learned"}
            className={classNames("field-kit-tab", tab === "learned" && "is-on")}
            onClick={() => setTab("learned")}
          >
            <span className="field-kit-tab-stamp">LOG</span>
            <span className="field-kit-tab-label">Notes</span>
            <span className="field-kit-tab-count">{learnedCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "bookmarks"}
            className={classNames("field-kit-tab field-kit-tab-refs", tab === "bookmarks" && "is-on")}
            onClick={() => setTab("bookmarks")}
          >
            <span className="field-kit-tab-stamp">BM</span>
            <span className="field-kit-tab-label">Bookmarks</span>
            <span className="field-kit-tab-count">{bookmarkCount}</span>
          </button>
        </div>
        {typeof setLensQuery === "function" && (
          <label className="field-kit-lens">
            <span className="field-kit-lens-label">Lens</span>
            <Icon.Search size={13} />
            <input
              className="field-kit-lens-input"
              placeholder="Search notes & bookmarks…"
              value={lensQuery}
              onChange={(e) => setLensQuery(e.target.value)}
              aria-label="Search Field Kit"
            />
            {String(lensQuery || "").trim() && (
              <button
                type="button"
                className="field-kit-lens-clear"
                onClick={() => setLensQuery("")}
                aria-label="Clear kit search"
              >
                <Icon.X size={11} />
              </button>
            )}
          </label>
        )}
        {hasCampaign && (
          <button type="button" className="field-kit-back" onClick={onBackToCampaign}>
            <Icon.Chevron size={14} style={{ transform: "rotate(180deg)" }} />
            Campaign deck
          </button>
        )}
      </div>
    </section>
  );
}

export function KitWeekDigestCard({ digest, onOpenKit, onOpenSlip }) {
  if (!digest) return null;
  const { slipCount, bookmarkCount, topTags, recentSlips } = digest;
  return (
    <section className="kit-digest" aria-label="Field kit this week">
      <div className="kit-digest-head">
        <span className="kit-digest-stamp">7D kit</span>
        <h3 className="kit-digest-title">Field kit this week</h3>
        <button type="button" className="kit-digest-open" onClick={onOpenKit}>
          Open kit
        </button>
      </div>
      <div className="kit-digest-meters">
        <div className="kit-digest-meter">
          <span className="kit-digest-val">{slipCount}</span>
          <span className="kit-digest-label">Notes</span>
        </div>
        <div className="kit-digest-meter">
          <span className="kit-digest-val">{bookmarkCount}</span>
          <span className="kit-digest-label">Pins</span>
        </div>
      </div>
      {topTags?.length > 0 && (
        <div className="kit-digest-tags">
          {topTags.map(({ tag, n }) => (
            <span key={tag} className="kit-digest-tag">
              {tag} · {n}
            </span>
          ))}
        </div>
      )}
      {recentSlips?.length > 0 && (
        <ul className="kit-digest-list">
          {recentSlips.map((s) => (
            <li key={s.id}>
              <button type="button" className="kit-digest-link" onClick={() => onOpenSlip?.(s.date)}>
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
            <Tip
              key={sc.key}
              content={
                sc.key === "all"
                  ? "Show the full campaign timeline."
                  : `Slice the plan into ${sc.label.toLowerCase()} buckets for focused ops.`
              }
              stamp="SLICE"
              tone="sky"
              side="bottom"
            >
              <button
                type="button"
                className={classNames("scope-btn", scope === sc.key && "scope-btn-active")}
                onClick={() => setScope(sc.key)}
              >
                {sc.label}
              </button>
            </Tip>
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
              <Tip
                key={p.label + p.start}
                content={
                  <>
                    <strong>{p.label}</strong> · days {p.start}–{p.end}
                    {p.sub ? ` · ${p.sub}` : ""}. {p.done}/{p.total} topics ({p.pct}%).
                    {holdsCurrent ? " You are here." : ""}
                    {complete ? " Cleared." : ""}
                  </>
                }
                stamp={complete ? "DONE" : holdsCurrent ? "HERE" : "BLOCK"}
                tone={complete ? "mint" : holdsCurrent ? "coral" : "lemon"}
                side="bottom"
              >
                <button
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
              </Tip>
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
            <Tip
              key={k}
              content={
                isActive
                  ? `Showing only ${meta.label}. Click again to clear the sector filter.`
                  : `${meta.label}: ${t.done}/${t.total} topics complete (${pct}%). Filter the console to this sector.`
              }
              stamp="SECTOR"
              tone={isActive ? "mint" : "ink"}
              side="top"
            >
              <button
                type="button"
                className={classNames("domain-meter", isActive && "domain-meter-active")}
                style={{ "--dot": color }}
                onClick={() => setActive(isActive ? null : k)}
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
            </Tip>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== CONSOLE VIEW ============================== */
const CONSOLE_LAYOUTS = [
  { key: "list", label: "List", hint: "Dense day rows", Icon: Icon.List },
  { key: "bento", label: "Index", hint: "Asymmetric day cards", Icon: Icon.LayoutDashboard },
  { key: "timeline", label: "Spine", hint: "Alternating mission spine", Icon: Icon.Path },
];

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
  onCaptureToKit,
  refs,
  setRef,
  onGenerateTopicResources,
  generatingTopicKey,
}) {
  return (
    <>
      {day.topics.map((t, i) => {
        const isDone = !!(progress[day.id] && progress[day.id][i]);
        return (
          <div key={i} className={classNames("topic-line", isDone && "topic-line-done")}>
            <label className="topic-line-main">
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
            <TopicResourceControls
              resourceSlot={day.resources?.[i]}
              generating={generatingTopicKey === `${day.id}:${i}`}
              onGenerate={
                onGenerateTopicResources
                  ? () => onGenerateTopicResources(day, i)
                  : undefined
              }
            />
          </div>
        );
      })}
      <NoteEditor
        value={notes[day.id] || ""}
        onChange={(v) => setNote(day.id, v)}
        dayNum={day.day}
      />
      <div className="day-tools">
        <Tip content="Generate a short quiz from this day's topics and your notes." stamp="QUIZ" tone="coral" side="top">
          <button type="button" className="tool-btn" onClick={() => onOpenTool("quiz", day)}>
            <Icon.Target size={12} /> Quiz me
          </button>
        </Tip>
        <Tip content="Draft study notes / references with AI, then pin them to this day." stamp="NOTES" tone="sky" side="top">
          <button type="button" className="tool-btn" onClick={() => onOpenTool("notes", day)}>
            <Icon.Book size={12} /> Generate notes
          </button>
        </Tip>
        <Tip content="Turn today's win into a LinkedIn-ready post you can copy." stamp="POST" tone="violet" side="top">
          <button type="button" className="tool-btn" onClick={() => onOpenTool("linkedin", day)}>
            <Icon.Send size={12} /> Draft post
          </button>
        </Tip>
        {onCaptureToKit && (
          <Tip
            content="Send this day's topics and notes into Field Kit as a draft slip — off-plan rabbit hole."
            stamp="KIT"
            tone="mint"
            side="top"
          >
            <button type="button" className="tool-btn" onClick={() => onCaptureToKit(day)}>
              <Icon.Link size={12} /> To Field Kit
            </button>
          </Tip>
        )}
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

export function ConsoleView({
  campaign,
  days,
  progress,
  onToggle,
  expandedDay,
  setExpandedDay,
  topicsDoneCount,
  isDayComplete,
  jumpTarget,
  notes,
  setNote,
  getRelated,
  onJumpDay,
  onOpenTool,
  onCaptureToKit,
  query,
  refs,
  setRef,
  onGenerateTopicResources,
  generatingTopicKey,
}) {
  const listRef = useRef(null);
  const [layout, setLayout] = useState("bento");

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
    onCaptureToKit,
    query,
    refs,
    setRef,
    onGenerateTopicResources,
    generatingTopicKey,
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
              <Tip key={opt.key} content={opt.hint} stamp="VIEW" tone={active ? "mint" : "ink"} side="bottom">
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={classNames("console-layout-btn", `console-layout-btn-${opt.key}`, active && "console-layout-btn-active")}
                  onClick={() => setLayout(opt.key)}
                >
                  <span>
                    <LayoutIcon size={13} />
                    {opt.label}
                  </span>
                </button>
              </Tip>
            );
          })}
        </div>
      </div>

      <div
        className={classNames(
          "console-view",
          "ops-view-enter",
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
  onCaptureToKit,
  query,
  refs,
  setRef,
  onGenerateTopicResources,
  generatingTopicKey,
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
            onCaptureToKit={onCaptureToKit}
            refs={refs}
            setRef={setRef}
            onGenerateTopicResources={onGenerateTopicResources}
            generatingTopicKey={generatingTopicKey}
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
  onCaptureToKit,
  query,
  refs,
  setRef,
  onGenerateTopicResources,
  generatingTopicKey,
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
            onCaptureToKit={onCaptureToKit}
            refs={refs}
            setRef={setRef}
            onGenerateTopicResources={onGenerateTopicResources}
            generatingTopicKey={generatingTopicKey}
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
  onCaptureToKit,
  query,
  refs,
  setRef,
  onGenerateTopicResources,
  generatingTopicKey,
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
              onCaptureToKit={onCaptureToKit}
              refs={refs}
              setRef={setRef}
              onGenerateTopicResources={onGenerateTopicResources}
              generatingTopicKey={generatingTopicKey}
            />
          </div>
        )}
      </article>
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
        placeholder="What clicked, what didn't. Links, gotchas, examples to revisit, open questions…"
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

function TopicResourceLink({ resource, stamp = "RES", icon = "link" }) {
  const href = resource?.url ? safeHref(resource.url) : null;
  if (!href || !/^https?:\/\//i.test(href)) return null;
  const label = resource.title || "Resource";
  const tip = resource.snippet
    ? `${label}\n\n${resource.snippet}`
    : label;
  return (
    <Tip content={tip} stamp={stamp} tone="sky" side="top">
      <a
        className={classNames("topic-resource-link", icon === "video" && "topic-resource-link-video")}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={`Open ${icon === "video" ? "video" : "article"}: ${label}`}
      >
        {icon === "video" ? <Icon.Play size={11} /> : <Icon.Link size={11} />}
      </a>
    </Tip>
  );
}

function TopicResourceControls({
  resourceSlot,
  generating = false,
  onGenerate,
  compact = false,
}) {
  const pair = (() => {
    if (!resourceSlot || typeof resourceSlot !== "object") return null;
    if ("url" in resourceSlot && !("article" in resourceSlot) && !("video" in resourceSlot)) {
      return { article: resourceSlot, video: null };
    }
    return resourceSlot;
  })();
  const hasArticle = !!pair?.article?.url;
  const hasVideo = !!pair?.video?.url;

  return (
    <span className={classNames("topic-resource-controls", compact && "topic-resource-controls-compact")}>
      {hasArticle && (
        <TopicResourceLink resource={pair.article} stamp="DOC" icon="link" />
      )}
      {hasVideo && (
        <TopicResourceLink resource={pair.video} stamp="VID" icon="video" />
      )}
      {onGenerate && (
        <Tip
          content={
            hasArticle || hasVideo
              ? "Find a fresh article + video for this topic"
              : "Generate 1 article and 1 video for this topic"
          }
          stamp="GEN"
          tone="mint"
          side="top"
        >
          <button
            type="button"
            className="topic-resource-gen"
            disabled={generating}
            aria-label="Generate article and video resources"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onGenerate();
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {generating ? (
              <span className="topic-resource-gen-spin" aria-hidden="true" />
            ) : (
              <Icon.Sparkle size={11} />
            )}
            {!compact && <span>{generating ? "…" : "Generate"}</span>}
          </button>
        </Tip>
      )}
    </span>
  );
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

function OpsEmpty({
  title,
  copy,
  stamp,
  inline = false,
  className,
}: {
  title: string;
  copy: string;
  stamp?: string;
  inline?: boolean;
  className?: string;
}) {
  return (
    <div className={classNames("ops-empty", inline && "ops-empty-inline", className)}>
      <span className="ops-empty-mark" aria-hidden="true" />
      <div className="ops-empty-title">{title}</div>
      <p className="ops-empty-copy">{copy}</p>
      {stamp ? <span className="ops-empty-stamp">{stamp}</span> : null}
    </div>
  );
}

function EmptyState() {
  return (
    <OpsEmpty
      stamp="SCAN"
      title="No matching transmissions"
      copy="Try a different search term or clear the domain filter."
    />
  );
}

/* ============================== GRID VIEW (heatmap / signature element) ============================== */
export function GridView({ campaign, days, progress, isDayComplete, topicsDoneCount, notes, onOpenDay }) {
  const completeCount = days.filter((d) => isDayComplete(d)).length;
  const notedCount = days.filter((d) => notes[d.id]).length;
  return (
    <div className="grid-view ops-view-enter">
      <section className="grid-ops" style={{ "--accent": campaign.accent }} aria-label="Day completion grid">
        <div className="grid-ops-mast">
          <div className="grid-ops-mast-text">
            <span className="grid-ops-title">Day grid</span>
            <span className="grid-ops-sub">
              Each cell is one day · fill = completion · corner mark = notes · click to open
            </span>
          </div>
          <div className="grid-ops-stats" aria-hidden="true">
            <span className="grid-ops-stat">
              <em>{completeCount}</em> cleared
            </span>
            <span className="grid-ops-stat">
              <em>{notedCount}</em> noted
            </span>
            <span className="grid-ops-stat">
              <em>{days.length}</em> shown
            </span>
          </div>
        </div>
        {days.length === 0 ? (
          <OpsEmpty
            stamp="MAP"
            title="No days in range"
            copy="Widen the time slice or clear filters to populate the grid."
          />
        ) : (
          <>
            <div className="heatmap">
              {days.map((day) => {
                const done = topicsDoneCount(day);
                const complete = isDayComplete(day);
                const level = done === 0 ? 0 : done === day.topics.length ? 2 : 1;
                return (
                  <Tip
                    key={day.id}
                    content={
                      <>
                        <strong>Day {day.day}</strong> · {done}/{day.topics.length} topics
                        {complete ? " · cleared" : ""}
                        {notes[day.id] ? " · has notes" : ""}
                        <br />
                        {day.topics.join(" · ")}
                      </>
                    }
                    stamp={complete ? "DONE" : done ? "WIP" : "DAY"}
                    tone={complete ? "mint" : done ? "lemon" : "ink"}
                    side="top"
                    maxWidth={280}
                    delay={180}
                  >
                    <button
                      type="button"
                      className={classNames("heat-cell", `heat-level-${level}`)}
                      onClick={() => onOpenDay(day)}
                    >
                      <span className="heat-cell-num">{day.day}</span>
                      {complete && <span className="heat-cell-check"><Icon.Check size={9} /></span>}
                      {notes[day.id] && <span className="heat-cell-note" />}
                    </button>
                  </Tip>
                );
              })}
            </div>
            <div className="heat-legend">
              <span className="heat-legend-label">Less</span>
              <span className="heat-cell heat-level-0 heat-legend-swatch" />
              <span className="heat-cell heat-level-1 heat-legend-swatch" />
              <span className="heat-cell heat-level-2 heat-legend-swatch" />
              <span className="heat-legend-label">More</span>
              <span className="heat-legend-key">
                <span className="heat-cell-note heat-legend-note" /> notes
              </span>
            </div>
          </>
        )}
      </section>
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
      <div className="review-view ops-view-enter">
        <div className="review-ops">
          <div className="review-ops-mast">
            <span className="review-ops-title">Review queue</span>
            <span className="review-ops-sub">Spaced recall · nothing due</span>
          </div>
          <div className="review-empty">
            <span className="review-empty-icon" aria-hidden="true"><Icon.Check size={22} /></span>
            <div className="review-empty-title">Nothing due right now</div>
            <div className="review-empty-sub">
              {scheduledCount > 0
                ? `${scheduledCount} ${scheduledCount === 1 ? "day is" : "days are"} scheduled. Next one ${upcoming ? relativeDue(upcoming[1].due, Date.now()) : "soon"}.`
                : "Complete a day in the console and it enters the review queue after 7 days."}
            </div>
            {graduated > 0 && (
              <div className="review-empty-stamp">{graduated} fully retained</div>
            )}
          </div>
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
    <div className="review-view ops-view-enter">
      <div className="review-ops">
        <div className="review-ops-mast">
          <div className="review-ops-mast-text">
            <span className="review-ops-title">Review queue</span>
            <span className="review-ops-sub">
              Day {day.day} · reviewed {entry.reps} {entry.reps === 1 ? "time" : "times"} · interval {SRS_INTERVALS[entry.idx]}d
            </span>
          </div>
          <span className="review-count">{queue.length} due</span>
        </div>

        <div className="review-card">
          <div className="review-day-stamp" aria-hidden="true">
            <span className="review-day-stamp-num">{String(day.day).padStart(2, "0")}</span>
            <span className="review-day-stamp-label">Day</span>
          </div>
          <div className="review-prompt">
            <span className="field-ops-kicker" aria-hidden="true">
              <span className="field-ops-kicker-mark" />
              <span>Prompt</span>
            </span>
            <span>Can you still explain these without looking?</span>
          </div>
          <ul className="review-topics">
            {day.topics.map((t, i) => (
              <li key={i}>
                <span className="review-topic-idx">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          {!revealed ? (
            <button type="button" className="reveal-btn" onClick={() => setRevealed(true)}>
              {note ? "Show my notes" : "I have thought it through"}
            </button>
          ) : (
            <div className="review-note">
              {note
                ? <pre className="review-note-text">{note}</pre>
                : <div className="review-note-empty">No notes saved for this day. Open it to add some.</div>}
              <button type="button" className="review-open-link" onClick={() => onOpenDay(day)}>
                Open Day {day.day} →
              </button>
            </div>
          )}
        </div>

        <div className="grade-row">
          <Tip content="Blanked on it — reset the interval and see it again in 3 days." stamp="LAPSE" tone="coral" side="top">
            <button type="button" className="grade-btn grade-forgot" onClick={() => grade("forgot")}>
              <span className="grade-label">Forgot</span>
              <span className="grade-sub">back in 3d</span>
            </button>
          </Tip>
          <Tip content="Kinda got it — keep the same interval and drill again soon." stamp="HOLD" tone="lemon" side="top">
            <button type="button" className="grade-btn grade-shaky" onClick={() => grade("shaky")}>
              <span className="grade-label">Shaky</span>
              <span className="grade-sub">repeat {SRS_INTERVALS[entry.idx]}d</span>
            </button>
          </Tip>
          <Tip content="Locked in — advance the spaced interval toward long-term retention." stamp="LOCK" tone="mint" side="top">
            <button type="button" className="grade-btn grade-solid" onClick={() => grade("solid")}>
              <span className="grade-label">Solid</span>
              <span className="grade-sub">
                {entry.idx + 1 >= SRS_INTERVALS.length ? "retained" : `next ${SRS_INTERVALS[entry.idx + 1]}d`}
              </span>
            </button>
          </Tip>
        </div>

        {queue.length > 1 && (
          <button type="button" className="skip-btn" onClick={() => setCursor((c) => (c + 1) % queue.length)}>
            Skip for now
          </button>
        )}
      </div>
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
    <div className="weekly-view ops-view-enter">
      <div className="log-ops-mast">
        <span className="log-ops-title">Weekly</span>
        <span className="log-ops-sub">Last 7 days · pulse · open questions</span>
      </div>
      <div className="weekly-strip">
        <SummaryCard label="Topics This Week" value={weekEvents.length} sub="last 7 days" accent={campaign.accent} tone="mint" />
        <SummaryCard label="Active Day Streak" value={activeDayStreak} sub={activeDayStreak === 1 ? "day" : "days"} accent={campaign.accent} tone="sky" />
        <SummaryCard label="Due For Review" value={dueNow} sub="in the queue" accent={campaign.accent} tone="lemon" />
        <SummaryCard label="Open Questions" value={openQuestions.length} sub="flagged in notes" accent={campaign.accent} tone="coral" />
      </div>

      <div className="weekly-grid">
        <div className="log-panel">
          <div className="log-panel-head">
            <span className="field-ops-kicker" aria-hidden="true">
              <span className="field-ops-kicker-mark" />
              <span>Pulse</span>
            </span>
            <div className="log-panel-title">Last 7 days</div>
          </div>
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
          <div className="log-panel-head">
            <span className="field-ops-kicker" aria-hidden="true">
              <span className="field-ops-kicker-mark" />
              <span>Sectors</span>
            </span>
            <div className="log-panel-title">Domains touched</div>
          </div>
          <div className="log-panel-body">
            {domainTally.length === 0 && (
              <OpsEmpty
                inline
                stamp="IDLE"
                title="No sectors yet"
                copy="Nothing completed in the last 7 days."
              />
            )}
            {domainTally.map(([dom, count]) => {
              const meta = DOMAIN_META[dom] || DOMAIN_META["systems-eng"];
              const color = domainColors[dom] || domainColors["systems-eng"];
              const pct = Math.round((count / weekEvents.length) * 100);
              return (
                <div key={dom} className="log-bar-row">
                  <span className="log-bar-dot" style={{ background: color }} aria-hidden="true" />
                  <span className="log-bar-label">{meta.label}</span>
                  <div className="log-bar-track">
                    <div className="log-bar-fill" style={{ width: pct + "%", background: color }} />
                  </div>
                  <span className="log-bar-val">{count}</span>
                  <span className="log-bar-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="weekly-grid">
        <div className="log-panel">
          <div className="log-panel-head">
            <span className="field-ops-kicker" aria-hidden="true">
              <span className="field-ops-kicker-mark" />
              <span>Flags</span>
            </span>
            <div className="log-panel-title">Open questions in your notes</div>
          </div>
          <div className="log-panel-body">
            {openQuestions.length === 0 && (
              <OpsEmpty
                inline
                stamp="CLEAR"
                title="No open flags"
                copy="Lines with a question mark or TODO in your notes show up here."
              />
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
          <div className="log-panel-head">
            <span className="field-ops-kicker" aria-hidden="true">
              <span className="field-ops-kicker-mark" />
              <span>Next</span>
            </span>
            <div className="log-panel-title">Next up in {campaign.name}</div>
          </div>
          <div className="log-panel-body">
            {upcoming.length === 0 && (
              <OpsEmpty
                inline
                stamp="DONE"
                title="Campaign complete"
                copy="Every day in this plan is cleared. Start a new mission when you're ready."
              />
            )}
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
      ? "Monthly velocity"
      : velocityScope?.key === "week"
        ? "Weekly velocity"
        : "Period velocity";

  return (
    <div className="log-view ops-view-enter" style={{ "--accent": campaign.accent }}>
      <div className="log-ops-mast">
        <span className="log-ops-title">Analytics</span>
        <span className="log-ops-sub">Domain coverage · velocity · campaign readout</span>
      </div>
      <div className="log-summary-strip">
        <SummaryCard label="Topics Mastered" value={stats.doneTopics} sub={`of ${stats.totalTopics}`} accent={campaign.accent} tone="mint" />
        <SummaryCard label="Days Fully Cleared" value={stats.daysComplete} sub={`of ${stats.totalDays}`} accent={campaign.accent} tone="sky" />
        <SummaryCard label="Completion" value={`${stats.pct}%`} sub="overall" accent={campaign.accent} tone="lemon" />
        <SummaryCard label="Days With Notes" value={campaign.days.filter((d) => notes[d.id]).length} sub={`streak ${stats.streak}`} accent={campaign.accent} tone="coral" />
      </div>
      <div className="log-grid">
        <div className="log-panel">
          <div className="log-panel-head">
            <span className="field-ops-kicker" aria-hidden="true">
              <span className="field-ops-kicker-mark" />
              <span>Sectors</span>
            </span>
            <div className="log-panel-title">Domain coverage</div>
          </div>
          <div className="log-panel-body">
            {domainRows.length === 0 && (
              <OpsEmpty
                inline
                stamp="VOID"
                title="No domain data"
                copy="Complete topics to build coverage bars for each sector."
              />
            )}
            {domainRows.map(([dom, t]) => {
              const meta = DOMAIN_META[dom] || DOMAIN_META["systems-eng"];
              const color = domainColors[dom] || domainColors["systems-eng"];
              const pct = Math.round((t.done / t.total) * 100);
              return (
                <div key={dom} className="log-bar-row">
                  <span className="log-bar-dot" style={{ background: color }} aria-hidden="true" />
                  <span className="log-bar-label">{meta.label}</span>
                  <div className="log-bar-track">
                    <div className="log-bar-fill" style={{ width: pct + "%", background: color }} />
                  </div>
                  <span className="log-bar-val">{t.done}/{t.total}</span>
                  <span className="log-bar-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="log-panel">
          <div className="log-panel-head">
            <span className="field-ops-kicker" aria-hidden="true">
              <span className="field-ops-kicker-mark" />
              <span>Tempo</span>
            </span>
            <div className="log-panel-title">{velocityTitle}</div>
          </div>
          <div className="log-panel-body">
            {buckets.length === 0 && (
              <OpsEmpty
                inline
                stamp="TEMPO"
                title="No period buckets"
                copy="This plan has no month or week scopes to chart velocity against."
              />
            )}
            {buckets.map((b) => (
              <div key={b.label} className="log-bar-row">
                <span className="log-bar-label log-bar-label-mono">{b.label}</span>
                <div className="log-bar-track">
                  <div className="log-bar-fill" style={{ width: b.pct + "%", background: campaign.accent }} />
                </div>
                <span className="log-bar-val">{b.done}/{b.total}</span>
                <span className="log-bar-pct">{b.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent, tone = "mint" }) {
  return (
    <div className={classNames("summary-card", `summary-card-tone-${tone}`)} style={{ "--accent": accent }}>
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-sub">{sub}</div>
    </div>
  );
}

/* ============================== MODALS ============================== */
export function ModalHost({ modal, onClose, notes, refs, setRef, appendNote, progress, srs, log, learned, bookmarks, themeKey, onImport, fireToast, plans, activePlanId, onPlanCreated, badgeStatuses, onAccountAuthenticated, onOpenPricing, onOpenAccount }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  const titleText =
    (modal.kind === "account" && modal.gated ? "Sign in to continue" : titles[modal.kind]) +
    (modal.day ? ` · Day ${modal.day.day}` : "");

  // Only re-bind focus trap when the modal *identity* changes — not when parent
  // re-renders with a new onClose closure (e.g. plan resource enrichment).
  const modalKey = `${modal.kind}:${modal.day?.id || ""}:${modal.gated ? "1" : "0"}:${modal.refreshToken || 0}`;

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(dialog.querySelectorAll(focusableSelector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const focusable = getFocusable();
    const initial =
      dialog.querySelector("[data-modal-initial-focus]") ||
      focusable.find((el) => !el.classList?.contains("modal-close")) ||
      focusable[0];
    initial?.focus?.();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // PlanBuilder handles Escape itself while generating / dirty.
        if (modal.kind === "builder") return;
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === "function") {
        try {
          prev.focus();
        } catch {
          /* element may be gone */
        }
      }
    };
  }, [modalKey, modal.kind]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className={classNames(
          "modal",
          (modal.kind === "builder" || modal.kind === "pricing") && "modal-wide",
          modal.kind === "pricing" && "modal-pricing",
          modal.kind === "account" && "modal-account",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <span className="modal-title" id="modal-title">
            {titleText}
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
              onAuthenticated={modal.gated ? onAccountAuthenticated : undefined}
              onViewPricing={onOpenPricing}
              defaultMode={modal.gated ? "signup" : "signin"}
            />
          )}
          {modal.kind === "badges" && <BadgesPanel statuses={badgeStatuses} onClose={onClose} />}
          {modal.kind === "pricing" && (
            <PricingPanel
              onClose={onClose}
              onOpenAccount={onOpenAccount}
              refreshToken={modal.refreshToken || 0}
            />
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
    const href = safeHref(m[0]);
    if (href) {
      parts.push(
        <a key={keyBase + "-u" + i} href={href} className="md-a" target="_blank" rel="noopener noreferrer">
          {m[0]}
        </a>,
      );
    } else {
      parts.push(m[0]);
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function inlineFormat(text, keyBase) {
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
        const href = safeHref(link[2]);
        if (href) {
          parts.push(
            <a
              key={keyBase + "-a" + i}
              href={href}
              className="md-a"
              target="_blank"
              rel="noopener noreferrer"
            >
              {link[1]}
            </a>,
          );
        } else {
          parts.push(link[1]);
        }
      } else {
        parts.push(tok);
      }
    } else if (tok.startsWith("`")) {
      parts.push(<code key={keyBase + "-c" + i}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      parts.push(<strong key={keyBase + "-b" + i}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("http")) {
      const href = safeHref(tok);
      if (href) {
        parts.push(
          <a key={keyBase + "-u" + i} href={href} className="md-a" target="_blank" rel="noopener noreferrer">
            {tok}
          </a>,
        );
      } else {
        parts.push(tok);
      }
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
  { key: "worked", label: "Worked example", hint: "Heavy on a concrete walkthrough or sample" },
  { key: "pitfalls", label: "Pitfalls", hint: "Common mistakes and what goes wrong" },
];

function NotesGenPanel({ day, existing, onSaveRef, onAppendNote, fireToast }) {
  const [topicIdx, setTopicIdx] = useState(0);
  const [style, setStyle] = useState("explainer");
  const [state, setState] = useState(existing ? "ready" : "idle");
  const [text, setText] = useState(existing ? existing.text : "");
  const [err, setErr] = useState("");

  const styleBrief = {
    explainer:
      "Lead with the mental model, then one worked example, then the gotchas that trip people up. Balance prose and example.",
    worked:
      "Minimise preamble. Centre the notes on one concrete walkthrough — a worked problem, annotated sample, short case, timeline, or code block if the topic is code-shaped. Comment the moves that carry the insight.",
    pitfalls:
      "Centre the notes on failure modes and misconceptions: what goes wrong, the symptoms you would notice, how to diagnose it, and how to avoid it.",
    // Legacy keys from older saves
    code: "Minimise preamble. Centre the notes on one concrete walkthrough — a worked problem, annotated sample, or code if it fits.",
    failure:
      "Centre the notes on failure modes and misconceptions: what goes wrong, how to spot it, and how to avoid it.",
  };

  const generate = async () => {
    setState("loading");
    setErr("");
    try {
      const topic = day.topics[topicIdx];
      const angle = styleBrief[style] || styleBrief.explainer;
      const prompt = `Write compact study notes on this topic for a motivated adult learner who already knows the basics of the subject. Skip introductory definitions and go straight to substance. Match the domain of the topic — it could be psychology, economics, history, languages, science, arts, trades, technology, or anything else. Do not assume a software-engineering audience unless the topic itself is clearly about software.

Topic: ${topic}

Style: ${angle}

Requirements:
- Use concrete examples grounded in the topic's real domain (cases, numbers, short scenarios, quotes, diagrams in plain text, or code only when the topic is code-shaped). Do not invent fake citations or APIs.
- Include at least one specific gotcha or misconception that trips up competent learners in this field.
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
      const prompt = `You are helping a motivated adult learner test their recall on whatever subject they are studying (it may be psychology, economics, history, languages, science, arts, tech, or anything else — infer from the topics).

Topics studied:
1. ${day.topics[0]}
${day.topics[1] ? "2. " + day.topics[1] : ""}

${note ? "Their own notes:\n" + note.slice(0, 2500) : "They did not save notes."}

Write exactly 5 short recall questions that test genuine understanding — not trivia. Favour "why", "when would you", compare/contrast, and trade-off questions over definitions. For each, give a concise 2-4 sentence model answer in the same domain as the topics.

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

function LinkedInPanel({ day, note, fireToast }) {
  const [state, setState] = useState("idle");
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  const generate = async () => {
    setState("loading");
    setErr("");
    try {
      const prompt = `Write a LinkedIn post for someone who shares what they are learning. Infer the field from the topics — it might be psychology, economics, history, languages, science, arts, tech, or anything else. Do not assume they are a software engineer unless the topics clearly are about software.

Topic studied today:
1. ${day.topics[0]}
${day.topics[1] ? "2. " + day.topics[1] : ""}

${note ? "Their own notes to draw from (use these as the substance):\n" + note.slice(0, 3000) : "No notes saved. Write from the topic titles at a thoughtful intermediate level for that subject."}

House style rules, follow all of them:
- Reads in 45 to 60 seconds. Short paragraphs, plenty of line breaks.
- Open with a strong hook line that creates curiosity or states a counter-intuitive truth.
- Use emojis sparingly as visual anchors for structure, not decoration.
- Never use em dashes anywhere in the post.
- Teach one concrete idea well rather than listing everything.
- End with a question that invites replies.
- Finish with exactly 3 targeted hashtags on their own line (relevant to the subject).
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

function DataPanel({
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
    <div
      key={toast.id}
      className={classNames(
        "toast",
        toast.kind === "day" && "toast-day",
        toast.kind === "xp" && "toast-xp",
      )}
    >
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



