// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { callClaude } from "@/lib/claude-client";
import { ProviderError } from "@/lib/providers/errors";
import {
  createLearnedId,
  dateKey,
  formatLearnedDate,
  sortedLearnedDays,
} from "@/lib/learned";
import { MiniMarkdown } from "@/features/ui/Views";

function formatAiError(e) {
  if (e instanceof ProviderError) {
    if (e.code === "auth") return `${e.message} Open AI settings to fix your key.`;
    if (e.code === "rate_limit") return `${e.message} Wait a moment and retry.`;
    if (e.code === "quota") return `${e.message} Check billing for this provider.`;
    if (e.code === "network") return e.message;
  }
  return e?.message || "Something went wrong";
}

async function generateInsight(title, body) {
  const prompt = `You help a learner capture what stuck from something they learned outside their main curriculum.

Title: ${title || "(untitled)"}

Notes (markdown):
${body}

Write a short insight in 2–4 sentences. Capture the core idea, why it matters, and one practical takeaway. Plain prose only — no headings, no bullets, no preamble.`;
  return callClaude(prompt, 400);
}

export function LearnedView({ learned, onAdd, onUpdate, onRemove, accent, fireToast }) {
  const today = dateKey();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(today);
  const [preview, setPreview] = useState(false);
  const [autoInsight, setAutoInsight] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [insightBusy, setInsightBusy] = useState(null);
  const taRef = useRef(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el || preview) return;
    el.style.height = "auto";
    el.style.height = Math.max(120, el.scrollHeight) + "px";
  }, [body, preview]);

  const days = useMemo(() => {
    const all = sortedLearnedDays(learned);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all
      .map(({ date: d, items }) => ({
        date: d,
        items: items.filter(
          (it) =>
            it.title.toLowerCase().includes(q) ||
            it.body.toLowerCase().includes(q) ||
            (it.insight || "").toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [learned, query]);

  const todayCount = (learned[today] || []).length;
  const totalCount = Object.values(learned || {}).reduce((n, items) => n + (items?.length || 0), 0);

  const submit = async () => {
    if (!title.trim() && !body.trim()) {
      setErr("Add a title or some notes first.");
      return;
    }
    setSaving(true);
    setErr("");
    const item = {
      id: createLearnedId(),
      title: title.trim() || "Untitled",
      body: body.trim(),
      createdAt: Date.now(),
    };
    try {
      if (autoInsight && (title.trim() || body.trim())) {
        try {
          item.insight = (await generateInsight(item.title, item.body)).trim();
        } catch (e) {
          fireToast?.(`Saved without insight — ${formatAiError(e)}`, "xp");
        }
      }
      onAdd(date, item);
      setTitle("");
      setBody("");
      setPreview(false);
      setExpandedId(item.id);
      fireToast?.(item.insight ? "Logged · insight ready" : "Logged what you learned", "day");
    } finally {
      setSaving(false);
    }
  };

  const refreshInsight = async (dateKeyStr, item) => {
    setInsightBusy(item.id);
    try {
      const insight = (await generateInsight(item.title, item.body)).trim();
      onUpdate(dateKeyStr, { ...item, insight });
      fireToast?.("Insight updated", "xp");
    } catch (e) {
      fireToast?.(formatAiError(e), "xp");
    } finally {
      setInsightBusy(null);
    }
  };

  return (
    <div className="learned-view" style={{ "--accent": accent }}>
      <div className="learned-hero">
        <div>
          <div className="learned-eyebrow">Outside the plan</div>
          <h2 className="learned-title">Other things I learned today</h2>
          <p className="learned-lead">
            Capture articles, talks, rabbit holes, and side lessons. Markdown and links welcome —
            generate a short insight when you log something.
          </p>
        </div>
        <div className="learned-stats">
          <div className="learned-stat">
            <span className="learned-stat-val">{todayCount}</span>
            <span className="learned-stat-label">today</span>
          </div>
          <div className="learned-stat">
            <span className="learned-stat-val">{totalCount}</span>
            <span className="learned-stat-label">total</span>
          </div>
        </div>
      </div>

      <div className="learned-composer">
        <div className="learned-composer-head">
          <span className="note-label"><Icon.Note size={12} /> New entry</span>
          <div className="learned-composer-tools">
            <label className="learned-date-label">
              Date
              <input
                type="date"
                className="learned-date-input"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value || today)}
              />
            </label>
            <button
              type="button"
              className={classNames("seg-btn", !preview && "seg-btn-active")}
              onClick={() => setPreview(false)}
            >
              Write
            </button>
            <button
              type="button"
              className={classNames("seg-btn", preview && "seg-btn-active")}
              onClick={() => setPreview(true)}
              disabled={!body.trim()}
            >
              Preview
            </button>
          </div>
        </div>

        <input
          className="learned-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What did you learn? (short title)"
          maxLength={120}
        />

        {preview ? (
          <div className="learned-preview">
            {body.trim() ? <MiniMarkdown text={body} /> : <p className="weekly-empty">Nothing to preview yet.</p>}
          </div>
        ) : (
          <textarea
            ref={taRef}
            className="note-input learned-body-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Notes in markdown…\n\n- Key idea\n- Paste a link: https://…\n- Or [named link](https://…)"}
            spellCheck="true"
          />
        )}

        <div className="learned-composer-foot">
          <label className="learned-auto">
            <input
              type="checkbox"
              checked={autoInsight}
              onChange={(e) => setAutoInsight(e.target.checked)}
            />
            Generate short insight on save
          </label>
          <div className="learned-composer-actions">
            {err && <span className="panel-error learned-inline-err">{err}</span>}
            <button
              className="primary-btn"
              onClick={submit}
              disabled={saving || (!title.trim() && !body.trim())}
            >
              {saving ? "Saving…" : "Add what I learned"}
            </button>
          </div>
        </div>
      </div>

      <div className="learned-toolbar">
        <div className="search-wrap learned-search">
          <Icon.Search size={15} />
          <input
            className="search-input"
            placeholder="Search titles, notes, insights…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {days.length === 0 && (
        <div className="learned-empty">
          {query.trim()
            ? "No matches in your journal."
            : "Nothing logged yet. Add the first rabbit hole of the day."}
        </div>
      )}

      <div className="learned-timeline">
        {days.map(({ date: d, items }) => (
          <section key={d} className="learned-day">
            <div className="learned-day-head">
              <h3 className="learned-day-label">{formatLearnedDate(d)}</h3>
              <span className="learned-day-count">
                {items.length} {items.length === 1 ? "item" : "items"}
                {d === today && <span className="learned-today-pill">Today</span>}
              </span>
            </div>
            <div className="learned-items">
              {items.map((item) => {
                const open = expandedId === item.id;
                return (
                  <article
                    key={item.id}
                    className={classNames("learned-card", open && "learned-card-open")}
                  >
                    <button
                      type="button"
                      className="learned-card-head"
                      onClick={() => setExpandedId(open ? null : item.id)}
                    >
                      <span className="learned-card-title">{item.title}</span>
                      <span className="learned-card-meta">
                        {item.insight && <span className="learned-insight-flag">insight</span>}
                        <Icon.Chevron size={14} className={classNames("chev", open && "chev-open")} />
                      </span>
                    </button>
                    {open && (
                      <div className="learned-card-body">
                        {item.body.trim() ? (
                          <MiniMarkdown text={item.body} />
                        ) : (
                          <p className="weekly-empty">No notes — title only.</p>
                        )}
                        {item.insight && (
                          <div className="learned-insight">
                            <div className="learned-insight-label">
                              <Icon.Bolt size={12} /> Insight
                            </div>
                            <p>{item.insight}</p>
                          </div>
                        )}
                        <div className="learned-card-actions">
                          <button
                            className="tool-btn"
                            disabled={insightBusy === item.id}
                            onClick={() => refreshInsight(d, item)}
                          >
                            <Icon.Bolt size={12} />
                            {insightBusy === item.id
                              ? "Generating…"
                              : item.insight
                                ? "Regenerate insight"
                                : "Generate insight"}
                          </button>
                          <button
                            className="tool-btn tool-btn-danger"
                            onClick={() => {
                              onRemove(d, item.id);
                              if (expandedId === item.id) setExpandedId(null);
                              fireToast?.("Removed", "xp");
                            }}
                          >
                            <Icon.X size={12} /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
