"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import {
  addBookmarkTag,
  applyPreviewToBookmark,
  createBookmarkId,
  defaultTitleForUrl,
  detectBookmarkKind,
  extractVimeoId,
  extractYoutubeId,
  hostnameOf,
  normalizeBookmarkUrl,
  removeBookmarkTag,
  seedPreviewFromUrl,
  youtubeEmbedUrl,
  vimeoEmbedUrl,
} from "@/lib/bookmarks";
import type { BookmarkItem } from "@/lib/types";

const CATEGORIES = [
  { key: "note", label: "Notes", kinds: ["note"], tone: "butter" },
  { key: "youtube", label: "Video", kinds: ["youtube", "vimeo"], tone: "coral" },
  { key: "article", label: "Articles", kinds: ["article"], tone: "lemon" },
  { key: "repo", label: "Repos", kinds: ["repo"], tone: "mint" },
  { key: "doc", label: "Docs", kinds: ["doc"], tone: "sky" },
  { key: "link", label: "Links", kinds: ["link"], tone: "lilac" },
];

const STICKY_TONES = ["lemon", "coral", "mint", "sky", "blush", "butter", "lilac", "seafoam"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}

function toneFor(item: BookmarkItem, index: number): string {
  return STICKY_TONES[hashStr(item.id || String(index)) % STICKY_TONES.length];
}

function resolveEmbed(item: BookmarkItem): { id: string; provider: "youtube" | "vimeo"; src: string } | null {
  const fromPreview = item.preview?.embedId;
  const provider = item.preview?.embedProvider;
  if (fromPreview && provider === "vimeo") {
    return { id: fromPreview, provider: "vimeo", src: vimeoEmbedUrl(fromPreview) };
  }
  if (fromPreview && (provider === "youtube" || item.kind === "youtube")) {
    return { id: fromPreview, provider: "youtube", src: youtubeEmbedUrl(fromPreview) };
  }
  const yt = extractYoutubeId(item.url);
  if (yt) return { id: yt, provider: "youtube", src: youtubeEmbedUrl(yt) };
  const vim = extractVimeoId(item.url);
  if (vim) return { id: vim, provider: "vimeo", src: vimeoEmbedUrl(vim) };
  return null;
}

async function fetchPreview(url: string) {
  const res = await fetch("/api/bookmarks/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Preview failed");
  return data;
}

function StickyThumb({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="bm-sticky-thumb-img"
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export type BookmarksViewProps = {
  bookmarks: BookmarkItem[];
  onAdd: (item: BookmarkItem) => void;
  onUpdate: (item: BookmarkItem) => void;
  onRemove: (id: string) => void;
  accent?: string;
  fireToast?: (msg: string, icon?: string) => void;
  onOpenNotes?: () => void;
  lensQuery?: string;
  onLensQueryChange?: (q: string) => void;
  focusId?: string | null;
  onFocusIdConsumed?: () => void;
};

export function BookmarksView({
  bookmarks,
  onAdd,
  onUpdate,
  onRemove,
  accent,
  fireToast,
  onOpenNotes,
  lensQuery,
  onLensQueryChange,
  focusId = null,
  onFocusIdConsumed,
}: BookmarksViewProps) {
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [localQuery, setLocalQuery] = useState("");
  const query = typeof lensQuery === "string" ? lensQuery : localQuery;
  const setQuery = typeof onLensQueryChange === "function" ? onLensQueryChange : setLocalQuery;
  const kitLens = typeof onLensQueryChange === "function";
  const [enrichBusy, setEnrichBusy] = useState<string | null>(null);
  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashExisting = (id: string) => {
    document.getElementById(`bm-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1600);
  };

  const pendingFocusRef = useRef<string | null>(null);

  // Constellation (or other deep-links) → clear any filter hiding the target, then scroll + flash it.
  useEffect(() => {
    if (!focusId) return;
    setQuery("");
    pendingFocusRef.current = focusId;
    onFocusIdConsumed?.();
  }, [focusId, onFocusIdConsumed, setQuery]);

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const id = pendingFocusRef.current;
    pendingFocusRef.current = null;
    flashExisting(id);
  }, [query]);

  const activeBookmarks = useMemo(
    () => (bookmarks || []).filter((b) => !b.archived),
    [bookmarks],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeBookmarks;
    return activeBookmarks.filter((item) => {
      const hay = [
        item.title,
        item.url,
        item.note,
        item.preview?.description,
        item.preview?.siteName,
        ...(item.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeBookmarks, query]);

  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favoritesCount = useMemo(() => activeBookmarks.filter((b) => b.favorite).length, [activeBookmarks]);

  const groups = useMemo(() => {
    const base = favoritesOnly ? filtered.filter((item) => item.favorite) : filtered;
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: base.filter((item) => cat.kinds.includes(item.kind)),
    })).filter((g) => g.items.length > 0);
  }, [filtered, favoritesOnly]);

  const submit = async () => {
    const rawInput = urlInput.trim();
    if (!rawInput) return;
    const url = normalizeBookmarkUrl(rawInput);
    if (!url) {
      setSaving(true);
      setErr("");
      const lines = rawInput.split("\n").map((l) => l.trim()).filter(Boolean);
      const firstLine = lines[0] || "Note";
      const title = firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
      const item: BookmarkItem = {
        id: createBookmarkId(),
        url: "",
        kind: "note",
        title,
        note: rawInput,
        createdAt: Date.now(),
      };
      onAdd(item);
      setUrlInput("");
      setSaving(false);
      fireToast?.("Note pinned", "day");
      return;
    }

    const dup = (bookmarks || []).find((b) => b.url === url);
    if (dup) {
      setUrlInput("");
      setErr("");
      fireToast?.("Already pinned — jumped to it", "xp");
      flashExisting(dup.id);
      return;
    }
    setSaving(true);
    setErr("");
    const kind = detectBookmarkKind(url);
    const item = {
      id: createBookmarkId(),
      url,
      kind,
      title: defaultTitleForUrl(url),
      preview: seedPreviewFromUrl(url),
      createdAt: Date.now(),
    };
    onAdd(item);
    setUrlInput("");
    fireToast?.("Bookmark saved", "day");

    try {
      const data = await fetchPreview(url);
      if (data?.preview) {
        onUpdate(applyPreviewToBookmark(item, data.preview, { overwriteTitle: true }));
      }
    } catch {
      /* keep seed */
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = (item: BookmarkItem) => {
    onUpdate({ ...item, favorite: !item.favorite });
  };

  const reEnrich = async (item: BookmarkItem) => {
    setEnrichBusy(item.id);
    try {
      const data = await fetchPreview(item.url);
      if (data?.preview) {
        onUpdate(applyPreviewToBookmark(item, data.preview, { overwriteTitle: false }));
        fireToast?.("Preview updated", "xp");
      }
    } catch (e) {
      fireToast?.((e as Error)?.message || "Could not refresh preview", "xp");
    } finally {
      setEnrichBusy(null);
    }
  };

  return (
    <div className="bm-view" style={{ "--accent": accent } as React.CSSProperties}>
      <header className="bm-head">
        <div className="bm-head-copy">
          <div className="bm-kicker">
            <span className="bm-kicker-mark" aria-hidden="true" />
            <span>Pinned · by kind</span>
          </div>
          <h2 className="bm-title">
            Book<span className="bm-title-accent">marks</span>
          </h2>
          <p className="bm-lead">Sticky slips grouped by type — links, notes, and video embeds right on the card.</p>
        </div>
        <div className="bm-head-meta">
          <span className="bm-live-stamp">Live</span>
          <span className="bm-count">{activeBookmarks.length}</span>
        </div>
      </header>

      <div className="bm-toolbar">
        <div className="bm-add">
          <Icon.Link size={14} />
          <input
            className="bm-add-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Paste a URL or type a note & press Enter"
            spellCheck="false"
            autoComplete="url"
            inputMode="url"
          />
          <button
            type="button"
            className="bm-add-btn"
            onClick={submit}
            disabled={saving || !urlInput.trim()}
          >
            {saving ? "…" : "Pin"}
          </button>
        </div>

        {(bookmarks || []).length > 0 && !kitLens && (
          <label className="bm-search">
            <span className="bm-search-label">Find</span>
            <Icon.Search size={13} />
            <input
              className="bm-search-input"
              placeholder="Title, site, or note…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search bookmarks"
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
      {err && (
        <p className="panel-error bm-err" role="alert">
          {err}
        </p>
      )}

      {favoritesCount > 0 && (
        <div className="bm-filter-row">
          <button
            type="button"
            className={classNames("bm-filter-chip", favoritesOnly && "bm-filter-chip-active")}
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            <Icon.Star size={12} fill={favoritesOnly ? "currentColor" : "none"} />
            Favorites
            <span className="bm-filter-chip-count">{favoritesCount}</span>
          </button>
        </div>
      )}

      {groups.length === 0 && (
        <div className="ops-empty bm-empty">
          <span className="ops-empty-mark" aria-hidden="true" />
          <div className="ops-empty-title">
            {favoritesOnly ? "No favorites yet" : query.trim() ? "No matches" : "Board is clear"}
          </div>
          <p className="ops-empty-copy">
            {favoritesOnly
              ? "Tap the star on a card to pin it here."
              : query.trim()
                ? "No bookmarks match that search. Try another term or clear Find."
                : "Paste a link above — it’ll land on a sticky in its category."}
          </p>
          <span className="ops-empty-stamp">{favoritesOnly ? "STAR" : query.trim() ? "SCAN" : "PIN"}</span>
          {!query.trim() && !favoritesOnly && onOpenNotes && (
            <button type="button" className="bm-empty-cross" onClick={onOpenNotes}>
              Or log a note
            </button>
          )}
        </div>
      )}

      <div className="bm-groups">
        {groups.map((group) => (
          <section key={group.key} className="bm-group">
            <div className="bm-group-head">
              <span className={classNames("bm-group-mark", `bm-mark-${group.tone}`)} aria-hidden="true" />
              <h3 className="bm-group-title">{group.label}</h3>
              <span className="bm-group-n">{group.items.length}</span>
            </div>

            <div className={classNames("bm-sticky-board", group.key === "youtube" && "bm-sticky-board-video")}>
              {group.items.map((item, index) => {
                const isNoteKind = item.kind === "note" || !item.url;
                const host = isNoteKind ? "Note" : item.preview?.siteName || hostnameOf(item.url);
                const desc = item.preview?.description;
                const image = item.preview?.image;
                const embed = resolveEmbed(item);
                const tone = toneFor(item, index);

                return (
                  <article
                    key={item.id}
                    id={`bm-card-${item.id}`}
                    className={classNames(
                      "bm-sticky",
                      `sticky-${tone}`,
                      `bm-sticky-${item.kind}`,
                      embed && "bm-sticky-video",
                      flashId === item.id && "bm-sticky-flash",
                    )}
                    style={{ "--slip-tilt": embed ? "0deg" : index % 2 === 0 ? "-1.8deg" : "1.8deg" } as React.CSSProperties}
                  >
                    <span className="bm-sticky-backing" aria-hidden="true" />
                    <span className="bm-sticky-tape" aria-hidden="true" />
                    <span className={classNames("bm-fav-corner", item.favorite && "bm-fav-corner-on")} aria-hidden="true" />
                    <button
                      type="button"
                      className={classNames("bm-fav-btn", item.favorite && "is-fav")}
                      onClick={() => toggleFavorite(item)}
                      aria-label={item.favorite ? "Remove from favorites" : "Add to favorites"}
                      aria-pressed={!!item.favorite}
                    >
                      <Icon.Star size={14} className="bm-fav-star bm-fav-star-outline" />
                      <Icon.Star size={14} fill="currentColor" className="bm-fav-star bm-fav-star-filled" />
                    </button>

                    <div className="bm-sticky-face">
                      <span className="bm-sticky-ribbon" aria-hidden="true" />
                      {isNoteKind ? (
                        <div className="bm-sticky-meta">
                          <span className="bm-sticky-host">Note</span>
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
                          {!embed && desc && <span className="bm-sticky-desc">{desc}</span>}
                        </a>
                      )}

                      {!isNoteKind && (
                        embed ? (
                          <div className="bm-sticky-embed">
                            <iframe
                              title={item.title}
                              src={embed.src}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              loading="lazy"
                              referrerPolicy="strict-origin-when-cross-origin"
                            />
                          </div>
                        ) : (
                          <a
                            className="bm-sticky-media"
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <StickyThumb src={image} />
                          </a>
                        )
                      )}

                      {noteEditId === item.id ? (
                        <div className="bm-note-edit">
                          <textarea
                            className="bm-note-input"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Note text…"
                            rows={3}
                            maxLength={1000}
                          />
                          <div className="bm-note-actions">
                            <button
                              type="button"
                              className="bm-sticky-action"
                              onClick={() => {
                                const note = noteDraft.trim();
                                onUpdate({
                                  ...item,
                                  title: isNoteKind && note ? (note.split("\n")[0].slice(0, 60) || item.title) : item.title,
                                  note: note || undefined,
                                });
                                setNoteEditId(null);
                                setNoteDraft("");
                                fireToast?.(note ? "Note saved" : "Note cleared", "xp");
                              }}
                            >
                              Save note
                            </button>
                            <button
                              type="button"
                              className="bm-sticky-action bm-sticky-action-mute"
                              onClick={() => {
                                setNoteEditId(null);
                                setNoteDraft("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : item.note ? (
                        <p className="bm-sticky-note">{item.note}</p>
                      ) : null}

                      {tagEditId === item.id ? (
                        <div className="bm-tag-edit">
                          <div className="bm-tag-chips">
                            {(item.tags || []).map((tag) => (
                              <span key={tag} className="bm-tag-chip">
                                {tag}
                                <button
                                  type="button"
                                  className="bm-tag-remove"
                                  onClick={() =>
                                    onUpdate({ ...item, tags: removeBookmarkTag(item.tags, tag) })
                                  }
                                  aria-label={`Remove tag ${tag}`}
                                >
                                  <Icon.X size={9} />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="bm-tag-add">
                            <input
                              className="bm-tag-input"
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === ",") {
                                  e.preventDefault();
                                  const next = addBookmarkTag(item.tags, tagInput);
                                  if (next !== item.tags) onUpdate({ ...item, tags: next });
                                  setTagInput("");
                                }
                              }}
                              placeholder={
                                (item.tags?.length || 0) >= 8 ? "Tag limit reached" : "Add tag, Enter…"
                              }
                              disabled={(item.tags?.length || 0) >= 8}
                              maxLength={32}
                            />
                            <button
                              type="button"
                              className="bm-sticky-action"
                              onClick={() => {
                                setTagEditId(null);
                                setTagInput("");
                              }}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ) : item.tags?.length ? (
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
                          onClick={() => {
                            setNoteEditId(item.id);
                            setNoteDraft(item.note || "");
                          }}
                        >
                          {item.note ? "Edit note" : "Add note"}
                        </button>
                        <button
                          type="button"
                          className="bm-sticky-action"
                          onClick={() => {
                            setTagEditId(item.id);
                            setTagInput("");
                          }}
                        >
                          {item.tags?.length ? "Edit tags" : "+ Tag"}
                        </button>
                        {!isNoteKind && (
                          <button
                            type="button"
                            className="bm-sticky-action"
                            disabled={enrichBusy === item.id}
                            onClick={() => reEnrich(item)}
                          >
                            {enrichBusy === item.id ? "…" : "Refresh"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="bm-sticky-action bm-sticky-action-mute"
                          onClick={() => {
                            onUpdate({ ...item, archived: true });
                            fireToast?.("Moved to Archive", "xp");
                          }}
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          className="bm-sticky-action bm-sticky-action-mute"
                          onClick={() => {
                            onRemove(item.id);
                            fireToast?.("Removed", "xp");
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
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
