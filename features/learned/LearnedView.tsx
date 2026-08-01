// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { callClaude } from "@/lib/claude-client";
import { formatAiError } from "@/lib/providers/errors";
import {
  buildLearnedChronoIndex,
  createLearnedId,
  dateKey,
  EMPTY_CHRONO_FILTER,
  extractUrlsFromText,
  formatChronoFilterLabel,
  formatLearnedDate,
  insertAtSelection,
  isChronoFilterActive,
  LEARNED_TAG_OPTIONS,
  linkLabelForUrl,
  matchesChronoFilter,
  parseLearnedDateParts,
  sortedLearnedDays,
  stripLinkMarkup,
  urlFromPaste,
  type LearnedChronoFilter,
} from "@/lib/learned";
import {
  extractVimeoId,
  extractYoutubeId,
  fetchPreviewQueued,
  hostnameOf,
  seedPreviewFromUrl,
  vimeoEmbedUrl,
  youtubeEmbedUrl,
} from "@/lib/bookmarks";
import { formatSourcesForPrompt } from "@/lib/sourceContentShared";
import { MiniMarkdown } from "@/features/ui/Views";

const SLIP_TONES = ["lemon", "coral", "mint", "sky", "blush", "butter", "lilac", "seafoam"];
const MONTH_TICKETS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function sourceProviderLabel(provider: string): string {
  if (provider === "youtube-captions") return "YouTube captions";
  if (provider === "jina") return "article text";
  if (provider === "html") return "page text";
  if (provider === "oembed") return "video title";
  return "source";
}
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
  const t = stripLinkMarkup(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function LearnedLinkEmbed({ url, compact = false }) {
  const seed = useMemo(() => seedPreviewFromUrl(url), [url]);
  const [preview, setPreview] = useState(seed);
  const yt = extractYoutubeId(url);
  const vim = extractVimeoId(url);
  const label = preview.title || preview.siteName || linkLabelForUrl(url);
  const host = preview.siteName || hostnameOf(url);

  useEffect(() => {
    setPreview(seed);
    let cancelled = false;
    fetchPreviewQueued(url)
      .then((data) => {
        if (!cancelled && data?.preview) setPreview((prev) => ({ ...prev, ...data.preview }));
      })
      .catch(() => {
        /* keep seed */
      });
    return () => {
      cancelled = true;
    };
  }, [url, seed]);

  if (compact) {
    return (
      <span className="learned-embed learned-embed-compact">
        {preview.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="learned-embed-thumb"
            src={preview.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="learned-embed-thumb learned-embed-thumb-empty" aria-hidden="true" />
        )}
        <span className="learned-embed-compact-copy">
          <span className="learned-embed-kicker">{yt ? "YouTube" : vim ? "Vimeo" : host}</span>
          <span className="learned-embed-title">{label}</span>
        </span>
        {(yt || vim) && <span className="learned-embed-play" aria-hidden="true" />}
      </span>
    );
  }

  if (yt) {
    return (
      <div className="learned-embed">
        <div className="learned-embed-frame">
          <iframe
            title={label}
            src={youtubeEmbedUrl(yt)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <a
          className="learned-embed-cap"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{label}</span>
          <span className="learned-embed-cap-host">YouTube · open</span>
        </a>
      </div>
    );
  }

  if (vim) {
    return (
      <div className="learned-embed">
        <div className="learned-embed-frame">
          <iframe
            title={label}
            src={vimeoEmbedUrl(vim)}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <a
          className="learned-embed-cap"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{label}</span>
          <span className="learned-embed-cap-host">Vimeo · open</span>
        </a>
      </div>
    );
  }

  return (
    <a
      className="learned-embed learned-embed-card"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="learned-embed-card-media"
          src={preview.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : preview.favicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="learned-embed-favicon"
          src={preview.favicon}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="learned-embed-mark" aria-hidden="true" />
      )}
      <span className="learned-embed-card-copy">
        <span className="learned-embed-title">{label}</span>
        <span className="learned-embed-kicker">{host}</span>
      </span>
    </a>
  );
}

async function fetchLinkedSources(body) {
  const urls = extractUrlsFromText(body || "").slice(0, 3);
  if (!urls.length) return "";
  try {
    const res = await fetch("/api/learned/source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data?.sources)) return "";
    return formatSourcesForPrompt(data.sources);
  } catch {
    return "";
  }
}

async function generateEnrichment(title, body, sourceBlock = null) {
  const block = sourceBlock == null ? await fetchLinkedSources(body) : sourceBlock;
  const prompt = `You help clean up a learner's journal entry.

Current title: ${title || "(untitled)"}
Their notes (markdown):
${body || "(no notes — infer from the title alone)"}
${
  block
    ? `
Source material extracted from linked URLs (primary evidence — captions / page text):
${block}
`
    : ""
}

Reply in EXACTLY this plain-text format, with no markdown fences, no extra labels, no commentary before or after:

TITLE: <a clear, specific title, 4-12 words, max 80 characters>
SUMMARY:
<a COMPLETE summary, 90-120 words, in flowing prose paragraphs>

Rules:
- title: fix grammar, capture what was learned, do not start with "Learned about" or "I learned", do not wrap it in quotes.
- summary: explain what this is, why it matters, and one practical takeaway. Plain prose only — no headings, no bullet lists. You may use a blank line between paragraphs if it reads better as two short paragraphs.
- When source material is present, ground the summary in it. Prefer concrete points from the transcript or article over guessing from the URL alone.
- Do not invent facts beyond what the title, notes, and source material support. If notes/sources are thin, stay high-level and practical.
- The summary MUST be complete — never stop mid-sentence.
- Do not repeat the word TITLE or SUMMARY anywhere except as the two labels above.`;

  const raw = await callClaude(prompt, 1400);
  return { ...parseEnrichment(raw, title), usedSources: Boolean(block) };
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

export function LearnedView({
  learned,
  onAdd,
  onUpdate,
  onRemove,
  accent,
  fireToast,
  focusDate = null,
  onFocusDateConsumed,
  onOpenBookmarks,
  lensQuery,
  onLensQueryChange,
  kitSeed = null,
  onKitSeedConsumed,
  onPinBookmark,
}) {
  const today = dateKey();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(today);
  const [tags, setTags] = useState([]);
  const [preview, setPreview] = useState(false);
  const [autoInsight, setAutoInsight] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [localQuery, setLocalQuery] = useState("");
  const query = typeof lensQuery === "string" ? lensQuery : localQuery;
  const setQuery = typeof onLensQueryChange === "function" ? onLensQueryChange : setLocalQuery;
  const kitLens = typeof onLensQueryChange === "function";
  const [chrono, setChrono] = useState<LearnedChronoFilter>(EMPTY_CHRONO_FILTER);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [insightBusy, setInsightBusy] = useState(null);
  const [linkPreviews, setLinkPreviews] = useState({});
  const [sourceStatus, setSourceStatus] = useState(null);
  const sourceBlockRef = useRef("");
  const taRef = useRef(null);

  const bodyUrls = useMemo(() => extractUrlsFromText(body), [body]);

  const toggleTag = (tag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  // On This Day (or other deep-links) → jump Chrono to that date.
  useEffect(() => {
    if (!focusDate) return;
    const parts = parseLearnedDateParts(focusDate);
    if (parts) {
      setChrono({ year: parts.year, month: parts.month, day: parts.day });
      setExpandedId(null);
    }
    onFocusDateConsumed?.();
  }, [focusDate, onFocusDateConsumed]);

  // Campaign day → Field Kit draft seed.
  useEffect(() => {
    if (!kitSeed) return;
    if (kitSeed.title) setTitle(String(kitSeed.title));
    if (kitSeed.body) setBody(String(kitSeed.body));
    if (kitSeed.date && /^\d{4}-\d{2}-\d{2}$/.test(kitSeed.date)) setDate(kitSeed.date);
    if (Array.isArray(kitSeed.tags)) {
      setTags(kitSeed.tags.filter((t) => LEARNED_TAG_OPTIONS.includes(t)));
    }
    setPreview(false);
    onKitSeedConsumed?.();
  }, [kitSeed, onKitSeedConsumed]);

  useEffect(() => {
    const el = taRef.current;
    if (!el || preview) return;
    el.style.height = "auto";
    el.style.height = Math.max(88, Math.min(220, el.scrollHeight)) + "px";
  }, [body, preview]);

  // Seed + enrich link previews for URLs in notes.
  useEffect(() => {
    if (bodyUrls.length === 0) {
      setLinkPreviews({});
      return;
    }
    setLinkPreviews((prev) => {
      const next = {};
      bodyUrls.forEach((url) => {
        next[url] = prev[url] || seedPreviewFromUrl(url);
      });
      return next;
    });

    let cancelled = false;
    (async () => {
      for (const url of bodyUrls) {
        if (cancelled) return;
        try {
          const data = await fetchPreviewQueued(url);
          if (cancelled || !data?.preview) continue;
          setLinkPreviews((prev) => ({
            ...prev,
            [url]: { ...(prev[url] || seedPreviewFromUrl(url)), ...data.preview },
          }));
        } catch {
          /* keep seed */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bodyUrls]);

  // Prefetch captions / article text when polish is on and URLs are present.
  useEffect(() => {
    if (!autoInsight || bodyUrls.length === 0) {
      setSourceStatus(null);
      sourceBlockRef.current = "";
      return;
    }
    const ac = new AbortController();
    const key = bodyUrls.join("|");
    setSourceStatus({ state: "loading", count: bodyUrls.length });
    sourceBlockRef.current = "";
    (async () => {
      try {
        const res = await fetch("/api/learned/source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: bodyUrls }),
          signal: ac.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        const sources = Array.isArray(data?.sources) ? data.sources : [];
        const usable = sources.filter((s) => String(s?.text || "").trim());
        const block = formatSourcesForPrompt(usable);
        sourceBlockRef.current = block;
        if (!usable.length) {
          setSourceStatus({ state: "empty", count: bodyUrls.length });
          return;
        }
        const labels = [...new Set(usable.map((s) => sourceProviderLabel(s.provider)))];
        setSourceStatus({ state: "ready", count: usable.length, labels, key });
      } catch {
        if (!ac.signal.aborted) {
          setSourceStatus({ state: "error", count: bodyUrls.length });
          sourceBlockRef.current = "";
        }
      }
    })();
    return () => ac.abort();
  }, [autoInsight, bodyUrls]);

  const onPasteNotes = (e) => {
    const pasted = e.clipboardData?.getData("text") || "";
    const url = urlFromPaste(pasted);
    if (!url) return;
    e.preventDefault();
    const ta = taRef.current;
    const start = ta?.selectionStart ?? body.length;
    const end = ta?.selectionEnd ?? body.length;
    const { next, cursor } = insertAtSelection(body, start, end, url);
    setBody(next);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      taRef.current.focus();
      taRef.current.setSelectionRange(cursor, cursor);
    });
  };

  const chronoIndex = useMemo(
    () => buildLearnedChronoIndex(learned, chrono.year),
    [learned, chrono.year],
  );

  const todayParts = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    return { year: y, month: m, day: d };
  }, [today]);

  const days = useMemo(() => {
    const all = sortedLearnedDays(learned);
    const q = query.trim().toLowerCase();
    const filtered = all
      .filter(({ date: d }) => matchesChronoFilter(d, chrono))
      .map(({ date: d, items }) => ({
        date: d,
        items: q
          ? items.filter(
              (it) =>
                it.title.toLowerCase().includes(q) ||
                it.body.toLowerCase().includes(q) ||
                (it.insight || "").toLowerCase().includes(q) ||
                (it.tags || []).some((t) => t.includes(q)),
            )
          : items,
      }))
      .filter((g) => g.items.length > 0);
    return filtered;
  }, [learned, query, chrono]);

  const visibleSlipCount = useMemo(
    () => days.reduce((n, d) => n + d.items.length, 0),
    [days],
  );

  const activeMonthBucket = useMemo(() => {
    if (chrono.month == null) return null;
    return chronoIndex.months.find((m) => m.month === chrono.month) || null;
  }, [chrono.month, chronoIndex.months]);

  const maxMonthCount = useMemo(
    () => Math.max(1, ...chronoIndex.months.map((m) => m.count)),
    [chronoIndex.months],
  );

  const setChronoYear = (year: number) => {
    setChrono((prev) => {
      if (prev.year === year && prev.month == null && prev.day == null) {
        return EMPTY_CHRONO_FILTER;
      }
      return { year, month: null, day: null };
    });
  };

  const setChronoMonth = (month: number) => {
    setChrono((prev) => {
      if (prev.month === month && prev.day == null) {
        return { year: prev.year, month: null, day: null };
      }
      let year = prev.year;
      if (year == null) {
        const hit = chronoIndex.years.find((y) => y.months.some((m) => m.month === month && m.count > 0));
        year = hit?.year ?? todayParts.year;
      }
      return { year, month, day: null };
    });
  };

  const setChronoDay = (day: number, dateStr?: string) => {
    setChrono((prev) => {
      if (prev.day === day) {
        return { year: prev.year, month: prev.month, day: null };
      }
      if (dateStr) {
        const [y, m, d] = dateStr.split("-").map(Number);
        return { year: y, month: m, day: d };
      }
      return {
        year: prev.year ?? todayParts.year,
        month: prev.month ?? todayParts.month,
        day,
      };
    });
  };

  const jumpAll = () => setChrono(EMPTY_CHRONO_FILTER);
  const jumpToday = () =>
    setChrono({ year: todayParts.year, month: todayParts.month, day: todayParts.day });
  const jumpThisMonth = () =>
    setChrono({ year: todayParts.year, month: todayParts.month, day: null });

  const chronoActive = isChronoFilterActive(chrono);

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
      ...(tags.length ? { tags: [...tags] } : {}),
      createdAt: Date.now(),
    };
    try {
      let usedSources = false;
      if (autoInsight && (title.trim() || body.trim())) {
        try {
          const enriched = await generateEnrichment(
            item.title,
            item.body,
            sourceBlockRef.current || null,
          );
          item.title = enriched.title;
          item.insight = enriched.summary;
          usedSources = enriched.usedSources;
        } catch (e) {
          fireToast?.(`Saved without summary — ${formatAiError(e)}`, "xp");
        }
      }
      onAdd(date, item);
      setTitle("");
      setBody("");
      setTags([]);
      setPreview(false);
      setExpandedId(item.id);
      if (item.insight) {
        fireToast?.(
          usedSources ? "Logged · summary from source" : "Logged · title & summary ready",
          "day",
        );
      } else {
        fireToast?.("Logged what you learned", "day");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = (dateStr, item) => {
    onUpdate(dateStr, { ...item, favorite: !item.favorite });
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
      fireToast?.(
        enriched.usedSources ? "Title & summary updated from source" : "Title & summary updated",
        "xp",
      );
    } catch (e) {
      fireToast?.(formatAiError(e), "xp");
    } finally {
      setInsightBusy(null);
    }
  };

  return (
    <div className="learned-view" style={{ "--accent": accent }}>
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
            Paste a link and optional AI polish pulls captions or page text for a grounded summary.
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
          <span className="learned-field-label">Stamp</span>
          <div className="learned-tag-row" role="group" aria-label="Slip tags">
            {LEARNED_TAG_OPTIONS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={classNames("learned-tag-chip", on && "is-on")}
                  aria-pressed={on}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

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
              onPaste={onPasteNotes}
              placeholder={"Paste a link or jot a note…\n\n- Key idea\n- https://… becomes a clickable link"}
              spellCheck="true"
            />
          )}
          {bodyUrls.length > 0 && (
            <div className="learned-link-rack" aria-label="Detected links">
              {bodyUrls.map((url) => {
                const previewData = linkPreviews[url] || seedPreviewFromUrl(url);
                const label =
                  previewData.title ||
                  previewData.siteName ||
                  linkLabelForUrl(url);
                const host = previewData.siteName || hostnameOf(url);
                const yt = previewData.embedProvider === "youtube" && previewData.embedId;
                return (
                  <a
                    key={url}
                    className="learned-link-chip"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {previewData.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="learned-link-thumb"
                        src={previewData.image}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : previewData.favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="learned-link-favicon"
                        src={previewData.favicon}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="learned-link-mark" aria-hidden="true" />
                    )}
                    <span className="learned-link-copy">
                      <span className="learned-link-title">{label}</span>
                      <span className="learned-link-host">{host}</span>
                    </span>
                    {yt ? (
                      <span className="learned-link-stamp">YT</span>
                    ) : (
                      <span className="learned-link-stamp">OPEN</span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
          {autoInsight && sourceStatus && (
            <div
              className={classNames(
                "learned-source-chip",
                `learned-source-chip-${sourceStatus.state}`,
              )}
              aria-live="polite"
            >
              {sourceStatus.state === "loading" && (
                <>
                  <Icon.Bolt size={11} />
                  <span>Pulling source for summary…</span>
                </>
              )}
              {sourceStatus.state === "ready" && (
                <>
                  <Icon.Check size={11} />
                  <span>
                    Using {(sourceStatus.labels || []).join(" · ") || "source"}
                    {sourceStatus.count > 1 ? ` · ${sourceStatus.count} links` : ""}
                  </span>
                </>
              )}
              {sourceStatus.state === "empty" && (
                <>
                  <Icon.Search size={11} />
                  <span>No captions/page text yet — summary will stay high-level</span>
                </>
              )}
              {sourceStatus.state === "error" && (
                <>
                  <Icon.X size={11} />
                  <span>Couldn&apos;t fetch source — summary will use your notes</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="learned-dispatch-foot">
          <label className="learned-auto">
            <input
              type="checkbox"
              checked={autoInsight}
              onChange={(e) => setAutoInsight(e.target.checked)}
            />
            <span>Polish title + grounded summary on save</span>
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

      {!kitLens && (
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
      )}
      {kitLens && (
        <div className="learned-toolbar learned-toolbar-slim">
          <div className="learned-board-label" aria-hidden="true">
            Evidence board
          </div>
        </div>
      )}

      {totalCount > 0 && (
        <section className="learned-chrono" aria-label="Filter by date">
          <div className="learned-chrono-glow" aria-hidden="true" />
          <div className="learned-chrono-head">
            <div className="learned-chrono-brand">
              <span className="learned-chrono-stamp">Chrono index</span>
              <span className="learned-chrono-readout" aria-live="polite">
                <span className="learned-chrono-readout-label">Window</span>
                <strong>{formatChronoFilterLabel(chrono)}</strong>
                <span className="learned-chrono-readout-count">
                  {String(visibleSlipCount).padStart(2, "0")} slips
                </span>
              </span>
            </div>
            <div className="learned-chrono-jumps" role="group" aria-label="Quick ranges">
              <button
                type="button"
                className={classNames("learned-chrono-jump", !chronoActive && "is-on")}
                onClick={jumpAll}
              >
                All time
              </button>
              <button
                type="button"
                className={classNames(
                  "learned-chrono-jump",
                  chrono.year === todayParts.year &&
                    chrono.month === todayParts.month &&
                    chrono.day == null &&
                    "is-on",
                )}
                onClick={jumpThisMonth}
              >
                This month
              </button>
              <button
                type="button"
                className={classNames(
                  "learned-chrono-jump learned-chrono-jump-now",
                  chrono.year === todayParts.year &&
                    chrono.month === todayParts.month &&
                    chrono.day === todayParts.day &&
                    "is-on",
                )}
                onClick={jumpToday}
              >
                Today
              </button>
              {chronoActive && (
                <button type="button" className="learned-chrono-clear" onClick={jumpAll}>
                  <Icon.X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {chronoIndex.years.length > 0 && (
            <div className="learned-chrono-years" role="list" aria-label="Years">
              {chronoIndex.years.map((y) => {
                const on = chrono.year === y.year;
                return (
                  <button
                    key={y.year}
                    type="button"
                    role="listitem"
                    className={classNames("learned-year-stamp", on && "is-on")}
                    aria-pressed={on}
                    onClick={() => setChronoYear(y.year)}
                  >
                    <span className="learned-year-num">{y.year}</span>
                    <span className="learned-year-meta">
                      <span className="learned-year-count">{y.count}</span>
                      <span className="learned-year-unit">slips</span>
                    </span>
                    <span className="learned-year-serration" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="learned-chrono-months" role="list" aria-label="Months">
            {chronoIndex.months.map((m) => {
              const on = chrono.month === m.month;
              const empty = m.count === 0;
              const heat = empty ? 0 : Math.max(0.18, m.count / maxMonthCount);
              return (
                <button
                  key={m.month}
                  type="button"
                  role="listitem"
                  className={classNames(
                    "learned-month-ticket",
                    on && "is-on",
                    empty && "is-empty",
                  )}
                  disabled={empty}
                  aria-pressed={on}
                  aria-label={`${MONTH_FULL[m.month - 1]}${m.count ? `, ${m.count} slips` : ", empty"}`}
                  style={{ "--heat": String(heat) }}
                  onClick={() => setChronoMonth(m.month)}
                >
                  <span className="learned-month-perf" aria-hidden="true" />
                  <span className="learned-month-code">{MONTH_TICKETS[m.month - 1]}</span>
                  <span className="learned-month-heat" aria-hidden="true">
                    <span style={{ height: `${Math.round(heat * 100)}%` }} />
                  </span>
                  <span className="learned-month-count">{empty ? "—" : m.count}</span>
                </button>
              );
            })}
          </div>

          {chrono.month != null && activeMonthBucket && activeMonthBucket.days.length > 0 && (
            <div className="learned-chrono-days" aria-label={`Days in ${MONTH_FULL[chrono.month - 1]}`}>
              <div className="learned-chrono-days-label">
                <span>Day punches</span>
                <span className="learned-chrono-days-month">{MONTH_FULL[chrono.month - 1]}</span>
              </div>
              <div className="learned-chrono-days-rail" role="list">
                {activeMonthBucket.days.map((d) => {
                  const on = chrono.day === d.day;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      role="listitem"
                      className={classNames("learned-day-punch", on && "is-on")}
                      aria-pressed={on}
                      onClick={() => setChronoDay(d.day, d.date)}
                    >
                      <span className="learned-day-punch-num">{String(d.day).padStart(2, "0")}</span>
                      <span className="learned-day-punch-count">{d.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {days.length === 0 && (
        <div className="learned-empty">
          <span className="learned-empty-mark" aria-hidden="true" />
          <div className="learned-empty-title">
            {query.trim() || chronoActive ? "No slips in this window" : "Board is clear"}
          </div>
          <p className="learned-empty-copy">
            {query.trim() || chronoActive
              ? "Widen the chrono window, clear filters, or try another search term."
              : "Log the first rabbit hole — a talk, a doc, a hallway tip — and it lands here as a slip."}
          </p>
          <div className="learned-empty-actions">
            {chronoActive && (
              <button type="button" className="learned-chrono-clear" onClick={jumpAll}>
                Clear date filter
              </button>
            )}
            {query.trim() && (
              <button type="button" className="learned-chrono-clear" onClick={() => setQuery("")}>
                Clear search
              </button>
            )}
            {!query.trim() && !chronoActive && onOpenBookmarks && (
              <button type="button" className="learned-chrono-clear" onClick={onOpenBookmarks}>
                Or pin a bookmark
              </button>
            )}
          </div>
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
                    const urls = extractUrlsFromText(item.body || "");
                    const noteText = stripLinkMarkup(item.body || "");
                    const snip = noteText
                      ? snippet(noteText)
                      : item.insight
                        ? snippet(item.insight, 100)
                        : urls.length
                          ? ""
                          : "Open slip";
                    return (
                      <article
                        key={item.id}
                        className={classNames(
                          "sticky-note",
                          `sticky-${tone}`,
                          `bento-${size}`,
                          open && "sticky-note-open",
                          urls.length > 0 && "sticky-note-has-embed",
                        )}
                        style={{ "--slip-tilt": open ? "0deg" : slipTilt(item.id) }}
                      >
                        <button
                          type="button"
                          className={classNames("learned-fav-btn", item.favorite && "is-fav")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(d, item);
                          }}
                          aria-label={item.favorite ? "Remove from favorites" : "Add to favorites"}
                          aria-pressed={!!item.favorite}
                        >
                          <Icon.Star size={12} fill={item.favorite ? "currentColor" : "none"} />
                        </button>
                        <button
                          type="button"
                          className={classNames("sticky-note-face", open && "sticky-note-face-open")}
                          onClick={() => setExpandedId(open ? null : item.id)}
                          aria-expanded={open}
                        >
                          <span className="sticky-tape" aria-hidden="true" />
                          <span className="sticky-pin" aria-hidden="true" />
                          <span className="sticky-note-title">{item.title}</span>
                          {!open && urls[0] && (
                            <LearnedLinkEmbed url={urls[0]} compact />
                          )}
                          {!open && snip && (
                            <span className="sticky-note-snip">{snip}</span>
                          )}
                          {!open && item.insight && (
                            <span className="sticky-insight-chip">summary</span>
                          )}
                          {!open && (item.tags || [])[0] && (
                            <span className="sticky-tag-chip">{item.tags[0]}</span>
                          )}
                        </button>

                        {open && (
                          <div className="sticky-note-body">
                            {editingId === item.id && editDraft ? (
                              <div className="sticky-edit">
                                <label className="sticky-edit-field">
                                  <span>Title</span>
                                  <input
                                    value={editDraft.title}
                                    onChange={(e) =>
                                      setEditDraft((d) => ({ ...d, title: e.target.value }))
                                    }
                                    maxLength={120}
                                  />
                                </label>
                                <label className="sticky-edit-field">
                                  <span>Date</span>
                                  <input
                                    type="date"
                                    value={editDraft.date}
                                    onChange={(e) =>
                                      setEditDraft((d) => ({ ...d, date: e.target.value }))
                                    }
                                  />
                                </label>
                                <label className="sticky-edit-field">
                                  <span>Notes</span>
                                  <textarea
                                    value={editDraft.body}
                                    onChange={(e) =>
                                      setEditDraft((d) => ({ ...d, body: e.target.value }))
                                    }
                                    rows={5}
                                  />
                                </label>
                                <div className="learned-tag-row">
                                  {LEARNED_TAG_OPTIONS.map((tag) => {
                                    const on = (editDraft.tags || []).includes(tag);
                                    return (
                                      <button
                                        key={tag}
                                        type="button"
                                        className={classNames("learned-tag-chip", on && "is-on")}
                                        aria-pressed={on}
                                        onClick={() =>
                                          setEditDraft((draft) => {
                                            const cur = draft.tags || [];
                                            return {
                                              ...draft,
                                              tags: on
                                                ? cur.filter((t) => t !== tag)
                                                : [...cur, tag],
                                            };
                                          })
                                        }
                                      >
                                        {tag}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="sticky-actions">
                                  <button
                                    type="button"
                                    className="sticky-action"
                                    onClick={() => {
                                      const next = {
                                        ...item,
                                        title: (editDraft.title || "").trim() || "Untitled",
                                        body: editDraft.body || "",
                                        tags: (editDraft.tags || []).length
                                          ? editDraft.tags
                                          : undefined,
                                      };
                                      onUpdate(d, next, editDraft.date);
                                      setEditingId(null);
                                      setEditDraft(null);
                                      fireToast?.("Slip updated", "day");
                                    }}
                                  >
                                    <Icon.Check size={11} /> Save
                                  </button>
                                  <button
                                    type="button"
                                    className="sticky-action sticky-action-mute"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditDraft(null);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {(item.tags || []).length > 0 && (
                                  <div className="sticky-tags">
                                    {item.tags.map((t) => (
                                      <span key={t} className="sticky-tag">
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {urls.length > 0 && (
                                  <div className="learned-embed-stack">
                                    {urls.map((url) => (
                                      <div key={url} className="learned-embed-wrap">
                                        <LearnedLinkEmbed url={url} />
                                        {onPinBookmark && (
                                          <button
                                            type="button"
                                            className="learned-pin-bm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onPinBookmark(url, {
                                                title: item.title,
                                                note: snippet(noteText || item.insight || "", 160),
                                              });
                                            }}
                                          >
                                            <Icon.Link size={11} /> Pin to Bookmarks
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {noteText ? (
                                  <div className="sticky-notes-block">
                                    <MiniMarkdown text={noteText} />
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
                                  !noteText &&
                                  urls.length === 0 && (
                                    <p className="sticky-empty">
                                      No notes yet — add a summary to flesh this out.
                                    </p>
                                  )
                                )}
                                <div className="sticky-actions">
                                  <button
                                    type="button"
                                    className="sticky-action"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingId(item.id);
                                      setEditDraft({
                                        title: item.title,
                                        body: item.body || "",
                                        date: d,
                                        tags: [...(item.tags || [])],
                                      });
                                    }}
                                  >
                                    <Icon.Note size={11} /> Edit
                                  </button>
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
                                      if (editingId === item.id) {
                                        setEditingId(null);
                                        setEditDraft(null);
                                      }
                                      fireToast?.("Removed", "xp");
                                    }}
                                  >
                                    <Icon.X size={11} /> Remove
                                  </button>
                                </div>
                              </>
                            )}
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
