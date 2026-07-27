// @ts-nocheck
"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect, useContext } from "react";
import DOMAIN_META from "@/data/domains.json";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { ThemeCtx, useDomainColor } from "@/theme/ThemeContext";
import { THEMES, THEME_ORDER, hexToRgba } from "@/theme/themes";
import {
  DEFAULT_FONT_KEY,
  FONT_ORDER,
  FONT_PACKS,
} from "@/theme/fonts";
import { callClaude } from "@/lib/claude-client";
import { stripFences } from "@/lib/stripFences";
import { downloadText, copyText } from "@/lib/fileIo";
import { buildMarkdown } from "@/lib/markdown";
import { relativeDue, SRS_INTERVALS, DAY_MS, dueList } from "@/lib/srs";
import { seedBuiltinPlans } from "@/data/builtinPlans";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { AccountPanel } from "@/features/account/AccountPanel";
import { PlanBuilder } from "@/features/planBuilder/PlanBuilder";
import { ProviderError } from "@/lib/providers/errors";
import {
  applyFullImport,
  applyPlanImport,
  detectImport,
  exportAll,
  exportPlan,
  serializeExport,
} from "@/lib/exportImport";

function formatAiError(e) {
  if (e instanceof ProviderError) {
    if (e.code === "auth") return `${e.message} Open AI settings to fix your key.`;
    if (e.code === "rate_limit") return `${e.message} Wait a moment and retry.`;
    if (e.code === "quota") return `${e.message} Check billing for this provider.`;
    if (e.code === "network") return e.message;
  }
  return e?.message || "Something went wrong";
}

/* ============================== BACKGROUND FX ============================== */
export function BackgroundFX({ accent, effects }) {
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

export function SaveIndicator({ status }) {
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

export function ThemePicker({ themeKey, setThemeKey }) {
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

export function FontPicker({ fontKey, setFontKey }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = FONT_PACKS[fontKey] || FONT_PACKS[DEFAULT_FONT_KEY];

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
            const isOn = k === fontKey;
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
}) {
  const pct = stats.need ? Math.min(100, Math.round((stats.into / stats.need) * 100)) : 0;
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-text">MERI<span className="brand-accent">DIAN</span></span>
        </div>
        <span className="brand-sub">daily learning campaigns</span>
      </div>
      <div className="topbar-right">
        <button className="stat-chip data-btn" onClick={onNewPlan} title="Create a custom plan">
          <Icon.Target size={13} />
          <span className="stat-chip-val">New</span>
        </button>
        <button className="stat-chip data-btn" onClick={onOpenSettings} title="AI provider and API key">
          <Icon.Cloud size={13} />
          <span className="stat-chip-val">AI</span>
        </button>
        <button className="stat-chip data-btn" onClick={onOpenData} title="Export or import your data">
          <Icon.Download size={13} />
          <span className="stat-chip-val">Data</span>
        </button>
        <button
          className={classNames("stat-chip data-btn", accountLabel && "account-btn-active")}
          onClick={onOpenAccount}
          title={accountLabel ? `Signed in as ${accountLabel}` : "Sign in to sync across devices"}
        >
          <Icon.User size={13} />
          <span className="stat-chip-val">{accountLabel ? "Account" : "Sign in"}</span>
        </button>
        <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
        <FontPicker fontKey={fontKey} setFontKey={setFontKey} />
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

/* ============================== CAMPAIGN HERO ============================== */
export function CampaignHero({ campaign, stats }) {
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

export function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <div className="metric-value">{icon}{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

export function ProgressRing({ pct, accent }) {
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
export function ViewTabs({ view, setView, dueCount }) {
  const tabs = [
    { key: "console", label: "Console", icon: Icon.Terminal },
    { key: "grid", label: "Grid", icon: Icon.Grid },
    { key: "review", label: "Review", icon: Icon.Rotate, badge: dueCount },
    { key: "weekly", label: "Weekly", icon: Icon.Calendar },
    { key: "learned", label: "Learned", icon: Icon.Note },
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
export function DomainLegend({ tally, active, setActive, accent }) {
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
export function ConsoleView({ campaign, days, progress, onToggle, expandedDay, setExpandedDay, topicsDoneCount, isDayComplete, jumpTarget, notes, setNote, getRelated, onJumpDay, onOpenTool, query, refs, setRef }) {
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
export function ModalHost({ modal, onClose, notes, refs, setRef, appendNote, progress, srs, log, learned, themeKey, onImport, fireToast, plans, activePlanId, onPlanCreated }) {
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
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={classNames("modal", modal.kind === "builder" && "modal-wide")} role="dialog" aria-modal="true">
        <div className="modal-head">
          <span className="modal-title">
            {titles[modal.kind]}
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
          {modal.kind === "account" && <AccountPanel onClose={onClose} />}
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
      const parsed = JSON.parse(stripFences(raw));
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
    if (!downloadText("meridian-notes.md", md, "text/markdown")) {
      const ok = await copyText(md);
      fireToast(ok ? "Markdown copied to clipboard" : "Export failed", "xp");
    } else fireToast("Markdown exported", "xp");
  };

  const saveJson = async () => {
    try {
      const payload = exportAll({
        plans: plans || seedBuiltinPlans(),
        userdata: { progress, notes, refs, srs, log, learned: learned || {} },
        themeKey,
        activePlanId,
      });
      const js = serializeExport(payload);
      if (!downloadText("meridian-backup.json", js, "application/json")) {
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
      if (!downloadText(`meridian-plan-${safeName}.json`, js, "application/json")) {
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
      <span>MERIDIAN · chart the arc · progress and notes save automatically</span>
    </footer>
  );
}



