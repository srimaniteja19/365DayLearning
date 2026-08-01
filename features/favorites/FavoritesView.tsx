// @ts-nocheck
"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { formatLearnedDate, stripLinkMarkup } from "@/lib/learned";
import { hostnameOf } from "@/lib/bookmarks";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "note", label: "Notes" },
  { key: "bookmark", label: "Bookmarks" },
];

function snippet(text, max = 130) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function entryKey(entry) {
  return `${entry.type}:${entry.item.id}`;
}

export function FavoritesView({
  learned,
  bookmarks,
  onUpdateLearned,
  onUpdateBookmark,
  onJumpToDate,
  accent,
  fireToast,
  lensQuery,
  onLensQueryChange,
}) {
  const [filter, setFilter] = useState("all");
  const [localQuery, setLocalQuery] = useState("");
  const query = typeof lensQuery === "string" ? lensQuery : localQuery;
  const setQuery = typeof onLensQueryChange === "function" ? onLensQueryChange : setLocalQuery;
  const kitLens = typeof onLensQueryChange === "function";
  const [exitingKeys, setExitingKeys] = useState(() => new Set());
  const timers = useRef({});

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const noteFavorites = useMemo(() => {
    const out = [];
    Object.entries(learned || {}).forEach(([date, items]) => {
      (items || []).forEach((item) => {
        if (item.favorite) out.push({ type: "note", date, item });
      });
    });
    return out;
  }, [learned]);

  const bookmarkFavorites = useMemo(
    () => (bookmarks || []).filter((b) => b.favorite).map((item) => ({ type: "bookmark", item })),
    [bookmarks],
  );

  const combined = useMemo(() => {
    return [...noteFavorites, ...bookmarkFavorites].sort(
      (a, b) => (b.item.createdAt || 0) - (a.item.createdAt || 0),
    );
  }, [noteFavorites, bookmarkFavorites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return combined.filter((entry) => {
      if (filter !== "all" && entry.type !== filter) return false;
      if (!q) return true;
      const it = entry.item;
      const hay =
        entry.type === "note"
          ? [it.title, it.body, it.insight, ...(it.tags || [])]
          : [it.title, it.url, it.note, it.preview?.description, it.preview?.siteName, ...(it.tags || [])];
      return hay.filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [combined, filter, query]);

  const unfavorite = (entry) => {
    const key = entryKey(entry);
    setExitingKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    timers.current[key] = setTimeout(() => {
      if (entry.type === "note") {
        onUpdateLearned?.(entry.date, { ...entry.item, favorite: false });
      } else {
        onUpdateBookmark?.({ ...entry.item, favorite: false });
      }
      fireToast?.("Unstarred", "xp");
    }, 200);
  };

  return (
    <div className="fav-view ops-view-enter" style={{ "--accent": accent }}>
      <header className="fav-head">
        <div className="fav-head-copy">
          <div className="fav-kicker">
            <span className="fav-kicker-mark" aria-hidden="true" />
            <span>Starred · pulled from Notes &amp; Bookmarks</span>
          </div>
          <h2 className="fav-title">
            Star<span className="fav-title-accent">log</span>
          </h2>
          <p className="fav-lead">
            Everything you&apos;ve starred, off both boards and onto one shelf.
          </p>
        </div>
        <div className="fav-meter" aria-label="Favorites totals">
          <div className="fav-meter-cell">
            <span className="fav-meter-val">{String(noteFavorites.length).padStart(2, "0")}</span>
            <span className="fav-meter-label">Notes</span>
          </div>
          <div className="fav-meter-cell">
            <span className="fav-meter-val">{String(bookmarkFavorites.length).padStart(2, "0")}</span>
            <span className="fav-meter-label">Bookmarks</span>
          </div>
          <div className="fav-meter-cell fav-meter-cell-accent">
            <span className="fav-meter-val">{String(combined.length).padStart(2, "0")}</span>
            <span className="fav-meter-label">Starred</span>
          </div>
        </div>
      </header>

      {combined.length > 0 && (
        <div className="fav-toolbar">
          <div className="fav-filter" role="group" aria-label="Filter favorites">
            {FILTERS.map((f) => {
              const count =
                f.key === "all"
                  ? combined.length
                  : f.key === "note"
                    ? noteFavorites.length
                    : bookmarkFavorites.length;
              return (
                <button
                  key={f.key}
                  type="button"
                  className={classNames("fav-filter-btn", filter === f.key && "is-on")}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  <span className="fav-filter-count">{count}</span>
                </button>
              );
            })}
          </div>
          {!kitLens && (
            <label className="fav-search">
              <Icon.Search size={13} />
              <input
                className="fav-search-input"
                placeholder="Search your favorites…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search favorites"
              />
              {query.trim() && (
                <button
                  type="button"
                  className="fav-search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <Icon.X size={11} />
                </button>
              )}
            </label>
          )}
        </div>
      )}

      {combined.length === 0 ? (
        <div className="fav-empty">
          <div className="fav-empty-scatter" aria-hidden="true">
            <Icon.Star size={14} />
            <Icon.Star size={10} />
            <Icon.Star size={18} />
            <Icon.Star size={11} />
          </div>
          <div className="fav-empty-title">The shelf is empty</div>
          <p className="fav-empty-copy">
            Star a note in Field notes or a link in Bookmarks — it&apos;ll land here, out of the
            board and into your collection.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="fav-empty fav-empty-slim">
          <div className="fav-empty-title">No matches</div>
          <p className="fav-empty-copy">Try another search term or clear the filter.</p>
        </div>
      ) : (
        <div className="fav-grid">
          {filtered.map((entry) => {
            const key = entryKey(entry);
            const exiting = exitingKeys.has(key);
            const it = entry.item;
            if (entry.type === "note") {
              const noteText = stripLinkMarkup(it.body || "");
              const snip = noteText ? snippet(noteText) : it.insight ? snippet(it.insight) : "";
              return (
                <article
                  key={key}
                  className={classNames("fav-card", "fav-card-note", exiting && "fav-card-exiting")}
                >
                  <span className="fav-card-ribbon" aria-hidden="true" />
                  <div className="fav-card-top">
                    <span className="fav-card-type">Note</span>
                    <span className="fav-card-date">{formatLearnedDate(entry.date)}</span>
                  </div>
                  <h3 className="fav-card-title">{it.title}</h3>
                  {snip && <p className="fav-card-snippet">{snip}</p>}
                  {(it.tags || []).length > 0 && (
                    <div className="fav-card-tags">
                      {it.tags.map((t) => (
                        <span key={t} className="fav-tag-chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="fav-card-actions">
                    <button
                      type="button"
                      className="fav-card-btn"
                      onClick={() => onJumpToDate?.(entry.date)}
                    >
                      <Icon.Note size={11} /> Open entry
                    </button>
                    <button
                      type="button"
                      className="fav-card-btn fav-card-btn-star"
                      onClick={() => unfavorite(entry)}
                      aria-label="Remove from favorites"
                    >
                      <Icon.Star size={11} fill="currentColor" />
                    </button>
                  </div>
                </article>
              );
            }

            const host = it.preview?.siteName || hostnameOf(it.url);
            const desc = it.preview?.description || it.note;
            return (
              <article
                key={key}
                className={classNames("fav-card", "fav-card-bookmark", exiting && "fav-card-exiting")}
              >
                <span className="fav-card-ribbon" aria-hidden="true" />
                <div className="fav-card-top">
                  <span className="fav-card-type">Link</span>
                  <span className="fav-card-date">{host}</span>
                </div>
                <h3 className="fav-card-title">{it.title}</h3>
                {desc && <p className="fav-card-snippet">{snippet(desc)}</p>}
                {(it.tags || []).length > 0 && (
                  <div className="fav-card-tags">
                    {it.tags.map((t) => (
                      <span key={t} className="fav-tag-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="fav-card-actions">
                  <a
                    className="fav-card-btn"
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon.Link size={11} /> Open
                  </a>
                  <button
                    type="button"
                    className="fav-card-btn fav-card-btn-star"
                    onClick={() => unfavorite(entry)}
                    aria-label="Remove from favorites"
                  >
                    <Icon.Star size={11} fill="currentColor" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
