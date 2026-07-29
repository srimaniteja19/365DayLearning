// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { callClaude } from "@/lib/claude-client";
import { formatAiError } from "@/lib/providers/errors";
import {
  createLearnedId,
  dateKey,
  formatLearnedDate,
  sortedLearnedDays,
} from "@/lib/learned";
import { MiniMarkdown } from "@/features/ui/Views";

const SLIP_TONES = ["lemon", "coral", "mint", "sky", "blush", "butter", "lilac", "seafoam"];
const BENTO_SIZES = ["sm", "md", "wide", "tall", "lg"];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic tilt so the board feels collaged without layout thrash. */
function slipTilt(id) {
  const n = hashStr(id) % 7;
  const deg = [-2.2, -1.4, -0.6, 0, 0.7, 1.5, 2.1][n];
  return `${deg}deg`;
}

function bentoSize(item, index) {
  const len = (item.body || "").length + (item.title || "").length;
  if (item.insight && len > 220) return "lg";
  if (len > 280) return "wide";
  if (len > 140) return index % 3 === 0 ? "tall" : "md";
  if (index % 5 === 2) return "tall";
  if (index % 4 === 1) return "wide";
  return BENTO_SIZES[hashStr(item.id) % 3];
}

function snippet(text, max = 140) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

async function generateEnrichment(title, body) {
  const prompt = `You help clean up a learner's journal entry.

Current title: ${title || "(untitled)"}
Their notes (markdown):
${body || "(no notes — infer from the title alone)"}

Reply in EXACTLY this plain-text format, with no markdown fences, no extra labels, no commentary before or after:

TITLE: <a clear, specific title, 4-12 words, max 80 characters>
SUMMARY:
<a COMPLETE summary, 90-120 words, in flowing prose paragraphs>

Rules:
- title: fix grammar, capture what was learned, do not start with "Learned about" or "I learned", do not wrap it in quotes.
- summary: explain what this is, why it matters, and one practical takeaway. Plain prose only — no headings, no bullet lists. You may use a blank line between paragraphs if it reads better as two short paragraphs.
- Do not invent facts beyond what the title/notes imply. If notes are thin, stay high-level and practical.
- The summary MUST be complete — never stop mid-sentence.
- Do not repeat the word TITLE or SUMMARY anywhere except as the two labels above.`;

  const raw = await callClaude(prompt, 1400);
  return parseEnrichment(raw, title);
}

function parseEnrichment(raw, fallbackTitle) {
  const cleaned = String(raw || "")
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const match = /TITLE:\s*(.+?)\s*\n+\s*SUMMARY:\s*([\s\S]+)/i.exec(cleaned);
  if (!match) {
    const summary = cleaned.trim();
    if (!summary) throw new Error("Could not read AI summary");
    return { title: (fallbackTitle || "Untitled").slice(0, 120), summary: formatSummary(summary) };
  }

  const nextTitle = match[1].trim().replace(/^["'“”]|["'“”]$/g, "");
  const summary = formatSummary(match[2]);
  if (!summary) throw new Error("Could not read AI summary");

  return {
    title: (nextTitle || fallbackTitle || "Untitled").slice(0, 120),
    summary,
  };
}

/** Collapse ragged whitespace within paragraphs while preserving paragraph breaks. */
function formatSummary(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
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

  const dayColorOffsets = useMemo(
    () => days.map((_, i) => days.slice(0, i).reduce((n, day) => n + day.items.length, 0)),
    [days],
  );

  const todayCount = (learned[today] || []).length;
  const totalCount = Object.values(learned || {}).reduce((n, items) => n + (items?.length || 0), 0);
  const dayCount = Object.keys(learned || {}).length;

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
          const enriched = await generateEnrichment(item.title, item.body);
          item.title = enriched.title;
          item.insight = enriched.summary;
        } catch (e) {
          fireToast?.(`Saved without summary — ${formatAiError(e)}`, "xp");
        }
      }
      onAdd(date, item);
      setTitle("");
      setBody("");
      setPreview(false);
      setExpandedId(item.id);
      fireToast?.(item.insight ? "Logged · title & summary ready" : "Logged what you learned", "day");
    } finally {
      setSaving(false);
    }
  };

  const refreshInsight = async (dateKeyStr, item) => {
    setInsightBusy(item.id);
    try {
      const enriched = await generateEnrichment(item.title, item.body);
      onUpdate(dateKeyStr, {
        ...item,
        title: enriched.title,
        insight: enriched.summary,
      });
      fireToast?.("Title & summary updated", "xp");
    } catch (e) {
      fireToast?.(formatAiError(e), "xp");
    } finally {
      setInsightBusy(null);
    }
  };

  return (
    <div className="learned-view ops-view-enter" style={{ "--accent": accent }}>
      <header className="learned-mast">
        <div className="learned-mast-copy">
          <div className="learned-kicker">
            <span className="learned-kicker-mark" aria-hidden="true" />
            <span>Side channel · off-plan captures</span>
          </div>
          <h2 className="learned-title">
            Field
            <span className="learned-title-accent"> notes</span>
          </h2>
          <p className="learned-lead">
            Rabbit holes, talks, articles, hallway wisdom — pinned to the board outside the campaign.
            Markdown welcome. Optional AI polish writes a cleaner title and a short summary.
          </p>
        </div>
        <div className="learned-meter" aria-label="Journal totals">
          <div className="learned-meter-cell">
            <span className="learned-meter-val">{String(todayCount).padStart(2, "0")}</span>
            <span className="learned-meter-label">Today</span>
          </div>
          <div className="learned-meter-cell">
            <span className="learned-meter-val">{String(dayCount).padStart(2, "0")}</span>
            <span className="learned-meter-label">Days</span>
          </div>
          <div className="learned-meter-cell learned-meter-cell-accent">
            <span className="learned-meter-val">{String(totalCount).padStart(2, "0")}</span>
            <span className="learned-meter-label">Slips</span>
          </div>
        </div>
      </header>

      <section className="learned-dispatch" aria-label="Log a new learning">
        <div className="learned-dispatch-frame" aria-hidden="true" />
        <div className="learned-dispatch-head">
          <div className="learned-dispatch-stamp">Log entry</div>
          <div className="learned-dispatch-tools">
            <label className="learned-date-label">
              <Icon.Calendar size={12} />
              <span>Date</span>
              <input
                type="date"
                className="learned-date-input"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value || today)}
              />
            </label>
            <div className="learned-mode" role="group" aria-label="Editor mode">
              <button
                type="button"
                className={classNames("learned-mode-btn", !preview && "learned-mode-btn-on")}
                onClick={() => setPreview(false)}
              >
                Write
              </button>
              <button
                type="button"
                className={classNames("learned-mode-btn", preview && "learned-mode-btn-on")}
                onClick={() => setPreview(true)}
                disabled={!body.trim()}
              >
                Preview
              </button>
            </div>
          </div>
        </div>

        <label className="learned-field">
          <span className="learned-field-label">01 · Title</span>
          <input
            className="learned-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What clicked — short and specific"
            maxLength={120}
          />
        </label>

        <div className="learned-field">
          <span className="learned-field-label">02 · Notes</span>
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
              placeholder={"Markdown welcome…\n\n- Key idea\n- Link: https://…\n- Or [named link](https://…)"}
              spellCheck="true"
            />
          )}
        </div>

        <div className="learned-dispatch-foot">
          <label className="learned-auto">
            <input
              type="checkbox"
              checked={autoInsight}
              onChange={(e) => setAutoInsight(e.target.checked)}
            />
            <span>Polish title + write summary on save</span>
          </label>
          <div className="learned-composer-actions">
            {err && <span className="panel-error learned-inline-err" role="alert">{err}</span>}
            <button
              className="learned-submit"
              type="button"
              onClick={submit}
              disabled={saving || (!title.trim() && !body.trim())}
            >
              <Icon.Note size={13} />
              {saving ? "Filing…" : "Pin to board"}
            </button>
          </div>
        </div>
      </section>

      <div className="learned-toolbar">
        <div className="learned-search-wrap">
          <Icon.Search size={15} />
          <input
            className="search-input"
            placeholder="Search the board…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search journal"
          />
        </div>
        <div className="learned-board-label" aria-hidden="true">
          Evidence board
        </div>
      </div>

      {days.length === 0 && (
        <div className="learned-empty">
          <span className="learned-empty-mark" aria-hidden="true" />
          <div className="learned-empty-title">
            {query.trim() ? "No slips match that search" : "Board is clear"}
          </div>
          <p className="learned-empty-copy">
            {query.trim()
              ? "Try another term, or clear the search to see everything."
              : "Log the first rabbit hole — a talk, a doc, a hallway tip — and it lands here as a slip."}
          </p>
        </div>
      )}

      <div className="learned-timeline">
        {days.map(({ date: d, items }, dayIdx) => {
          const dayNum = d.slice(-2);
          const [yy, mm] = d.split("-").map(Number);
          const monthBit =
            yy && mm
              ? new Date(yy, mm - 1, 1).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })
              : d;
          return (
            <section key={d} className="learned-day">
              <div className="learned-day-rail" aria-hidden="true">
                <span className="learned-day-dot">{dayNum}</span>
              </div>
              <div className="learned-day-main">
                <div className="learned-day-head">
                  <h3 className="learned-day-label">
                    <span className="learned-day-month">{monthBit}</span>
                    <span className="learned-day-full">{formatLearnedDate(d)}</span>
                  </h3>
                  <span className="learned-day-count">
                    {items.length} {items.length === 1 ? "slip" : "slips"}
                    {d === today && <span className="learned-today-pill">Now</span>}
                  </span>
                </div>
                <div className="learned-bento">
                  {items.map((item, index) => {
                    const open = expandedId === item.id;
                    const tone = SLIP_TONES[(dayColorOffsets[dayIdx] + index) % SLIP_TONES.length];
                    const size = open ? "lg" : bentoSize(item, index);
                    return (
                      <article
                        key={item.id}
                        className={classNames(
                          "sticky-note",
                          `sticky-${tone}`,
                          `bento-${size}`,
                          open && "sticky-note-open",
                        )}
                        style={{ "--slip-tilt": open ? "0deg" : slipTilt(item.id) }}
                      >
                        <button
                          type="button"
                          className={classNames("sticky-note-face", open && "sticky-note-face-open")}
                          onClick={() => setExpandedId(open ? null : item.id)}
                          aria-expanded={open}
                        >
                          <span className="sticky-tape" aria-hidden="true" />
                          <span className="sticky-pin" aria-hidden="true" />
                          <span className="sticky-note-title">{item.title}</span>
                          {!open && (
                            <span className="sticky-note-snip">
                              {snippet(item.body) || (item.insight ? snippet(item.insight, 100) : "Open slip")}
                            </span>
                          )}
                          {!open && item.insight && (
                            <span className="sticky-insight-chip">summary</span>
                          )}
                        </button>

                        {open && (
                          <div className="sticky-note-body">
                            {item.body.trim() ? (
                              <div className="sticky-notes-block">
                                <MiniMarkdown text={item.body} />
                              </div>
                            ) : null}
                            {item.insight ? (
                              <div className="sticky-insight">
                                <div className="learned-insight-label">Summary</div>
                                {item.insight.split(/\n\s*\n/).map((para, pi) => (
                                  <p key={pi} className="sticky-insight-text">
                                    {para}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              !item.body.trim() && (
                                <p className="sticky-empty">No notes yet — add a summary to flesh this out.</p>
                              )
                            )}
                            <div className="sticky-actions">
                              <button
                                type="button"
                                className="sticky-action"
                                disabled={insightBusy === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  refreshInsight(d, item);
                                }}
                              >
                                <Icon.Bolt size={11} />
                                {insightBusy === item.id
                                  ? "Writing…"
                                  : item.insight
                                    ? "Regenerate"
                                    : "Summary"}
                              </button>
                              <button
                                type="button"
                                className="sticky-action sticky-action-mute"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(d, item.id);
                                  if (expandedId === item.id) setExpandedId(null);
                                  fireToast?.("Removed", "xp");
                                }}
                              >
                                <Icon.X size={11} /> Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
