"use client";

import React, { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { formatLearnedDate } from "@/lib/learned";
import { hostnameOf } from "@/lib/bookmarks";
import type { BookmarkItem, LearnedItem, LearnedMap } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "note", label: "Notes" },
  { key: "bookmark", label: "Bookmarks" },
];

function snippet(text: string | null | undefined, max = 140): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

type ArchiveEntry =
  | { type: "note"; date: string; item: LearnedItem }
  | { type: "bookmark"; item: BookmarkItem };

function entryKey(entry: ArchiveEntry): string {
  return `${entry.type}:${entry.item.id}`;
}

export type ArchiveViewProps = {
  learned: LearnedMap;
  bookmarks: BookmarkItem[];
  onUpdateLearned?: (date: string, item: LearnedItem) => void;
  onRemoveLearned?: (date: string, id: string) => void;
  onUpdateBookmark?: (item: BookmarkItem) => void;
  onRemoveBookmark?: (id: string) => void;
  accent?: string;
  fireToast?: (msg: string, icon?: string) => void;
  lensQuery?: string;
  onLensQueryChange?: (q: string) => void;
};

export function ArchiveView({
  learned,
  bookmarks,
  onUpdateLearned,
  onRemoveLearned,
  onUpdateBookmark,
  onRemoveBookmark,
  accent,
  fireToast,
  lensQuery,
  onLensQueryChange,
}: ArchiveViewProps) {
  const [filter, setFilter] = useState("all");
  const [localQuery, setLocalQuery] = useState("");
  const query = typeof lensQuery === "string" ? lensQuery : localQuery;
  const setQuery = typeof onLensQueryChange === "function" ? onLensQueryChange : setLocalQuery;
  const kitLens = typeof onLensQueryChange === "function";

  const archivedNotes = useMemo(() => {
    const out: ArchiveEntry[] = [];
    Object.entries(learned || {}).forEach(([date, items]) => {
      (items || []).forEach((item) => {
        if (item?.archived) out.push({ type: "note", date, item });
      });
    });
    return out;
  }, [learned]);

  const archivedBookmarks = useMemo(
    () => (bookmarks || []).filter((b) => b?.archived).map((item): ArchiveEntry => ({ type: "bookmark", item })),
    [bookmarks],
  );

  const combined = useMemo(() => {
    return [...archivedNotes, ...archivedBookmarks].sort(
      (a, b) => (b.item.createdAt || 0) - (a.item.createdAt || 0),
    );
  }, [archivedNotes, archivedBookmarks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return combined.filter((entry) => {
      if (filter !== "all" && entry.type !== filter) return false;
      if (!q) return true;
      const hay =
        entry.type === "note"
          ? [entry.item.title, entry.item.body, entry.item.insight, ...(entry.item.tags || [])]
          : [
              entry.item.title,
              entry.item.url,
              entry.item.note,
              entry.item.preview?.description,
              entry.item.preview?.siteName,
              ...(entry.item.tags || []),
            ];
      return hay.filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [combined, filter, query]);

  const restoreEntry = (entry: ArchiveEntry) => {
    if (entry.type === "note") {
      onUpdateLearned?.(entry.date, { ...entry.item, archived: false });
    } else {
      onUpdateBookmark?.({ ...entry.item, archived: false });
    }
    fireToast?.("Restored from Archive", "xp");
  };

  const removeEntry = (entry: ArchiveEntry) => {
    if (entry.type === "note") {
      onRemoveLearned?.(entry.date, entry.item.id);
    } else {
      onRemoveBookmark?.(entry.item.id);
    }
    fireToast?.("Permanently removed", "xp");
  };

  return (
    <div className="bm-view fav-view" style={{ "--accent": accent } as React.CSSProperties}>
      <header className="bm-head">
        <div className="bm-head-copy">
          <div className="bm-kicker">
            <span className="bm-kicker-mark" aria-hidden="true" />
            <span>Archived · slips & links</span>
          </div>
          <h2 className="bm-title">
            Arch<span className="bm-title-accent">ive</span>
          </h2>
          <p className="bm-lead">
            Notes and bookmarks moved off your active boards. Restore them to active inventory anytime.
          </p>
        </div>
        <div className="bm-head-meta">
          <span className="bm-live-stamp">Archive</span>
          <span className="bm-count">{combined.length}</span>
        </div>
      </header>

      <div className="bm-toolbar fav-toolbar">
        <div className="fav-filter-chips" role="tablist" aria-label="Archive filters">
          {FILTERS.map((cat) => {
            const count =
              cat.key === "all"
                ? combined.length
                : cat.key === "note"
                  ? archivedNotes.length
                  : archivedBookmarks.length;
            const on = filter === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                role="tab"
                aria-selected={on}
                className={classNames("fav-chip", on && "is-on")}
                onClick={() => setFilter(cat.key)}
              >
                <span>{cat.label}</span>
                <span className="fav-chip-count">{count}</span>
              </button>
            );
          })}
        </div>

        {!kitLens && (
          <label className="bm-search">
            <span className="bm-search-label">Find</span>
            <Icon.Search size={13} />
            <input
              className="bm-search-input"
              placeholder="Search archive…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search archived items"
            />
            {query.trim() && (
              <button
                type="button"
                className="bm-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <Icon.X size={11} />
              </button>
            )}
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="ops-empty bm-empty">
          <span className="ops-empty-mark" aria-hidden="true" />
          <div className="ops-empty-title">
            {combined.length === 0 ? "Archive is clear" : "No matches"}
          </div>
          <p className="ops-empty-copy">
            {combined.length === 0
              ? "Move notes or bookmarks to archive whenever you want to tidy your active boards."
              : "No archived items match your filter or search."}
          </p>
          <span className="ops-empty-stamp">ARCHIVE</span>
        </div>
      ) : (
        <div className="bm-sticky-board fav-board">
          {filtered.map((entry, index) => {
            const key = entryKey(entry);
            if (entry.type === "note") {
              const item = entry.item;
              const dateStr = formatLearnedDate(entry.date);
              const bodyText = snippet(item.body || item.insight, 160);
              return (
                <article
                  key={key}
                  className="bm-sticky sticky-lemon bm-sticky-note"
                  style={{ "--slip-tilt": index % 2 === 0 ? "-1.5deg" : "1.5deg" } as React.CSSProperties}
                >
                  <span className="bm-sticky-backing" aria-hidden="true" />
                  <span className="bm-sticky-tape" aria-hidden="true" />
                  <div className="bm-sticky-face">
                    <span className="bm-sticky-ribbon" aria-hidden="true" />
                    <div className="bm-sticky-meta">
                      <span className="bm-sticky-host">Note · {dateStr}</span>
                      <span className="bm-sticky-title">{item.title}</span>
                    </div>
                    {bodyText && <p className="bm-sticky-note">{bodyText}</p>}
                    {item.tags?.length ? (
                      <div className="bm-sticky-tags">
                        {item.tags.map((tag) => (
                          <span key={tag} className="bm-tag-chip bm-tag-chip-static">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="bm-sticky-actions">
                      <button
                        type="button"
                        className="bm-sticky-action"
                        onClick={() => restoreEntry(entry)}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="bm-sticky-action bm-sticky-action-mute"
                        onClick={() => removeEntry(entry)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            }

            const item = entry.item;
            const isNoteKind = item.kind === "note" || !item.url;
            const host = isNoteKind ? "Note" : item.preview?.siteName || hostnameOf(item.url);
            const desc = item.preview?.description;

            return (
              <article
                key={key}
                className={classNames("bm-sticky", `bm-sticky-${item.kind}`)}
                style={{ "--slip-tilt": index % 2 === 0 ? "-1.5deg" : "1.5deg" } as React.CSSProperties}
              >
                <span className="bm-sticky-backing" aria-hidden="true" />
                <span className="bm-sticky-tape" aria-hidden="true" />
                <div className="bm-sticky-face">
                  <span className="bm-sticky-ribbon" aria-hidden="true" />
                  {isNoteKind ? (
                    <div className="bm-sticky-meta">
                      <span className="bm-sticky-host">Bookmark Note</span>
                      <span className="bm-sticky-title">{item.title}</span>
                    </div>
                  ) : (
                    <a
                      className="bm-sticky-meta"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="bm-sticky-host">{host}</span>
                      <span className="bm-sticky-title">{item.title}</span>
                      {desc && <span className="bm-sticky-desc">{snippet(desc, 120)}</span>}
                    </a>
                  )}
                  {item.note && <p className="bm-sticky-note">{snippet(item.note, 140)}</p>}
                  {item.tags?.length ? (
                    <div className="bm-sticky-tags">
                      {item.tags.map((tag) => (
                        <span key={tag} className="bm-tag-chip bm-tag-chip-static">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="bm-sticky-actions">
                    {!isNoteKind && (
                      <a
                        className="bm-sticky-action"
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open
                      </a>
                    )}
                    <button
                      type="button"
                      className="bm-sticky-action"
                      onClick={() => restoreEntry(entry)}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="bm-sticky-action bm-sticky-action-mute"
                      onClick={() => removeEntry(entry)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
