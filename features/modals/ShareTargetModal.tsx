"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import {
  createBookmarkId,
  defaultTitleForUrl,
  detectBookmarkKind,
  hostnameOf,
  normalizeBookmarkUrl,
  seedPreviewFromUrl,
} from "@/lib/bookmarks";
import { createLearnedId, dateKey } from "@/lib/learned";
import type { BookmarkKind } from "@/lib/types";

interface ShareTargetModalProps {
  sharedUrl: string;
  sharedTitle?: string;
  sharedText?: string;
  onClose: () => void;
  onSaveBookmark: (item: any) => void;
  onUpdateBookmark?: (item: any) => void;
  onDeleteBookmark?: (id: string) => void;
  onSaveLearned: (date: string, item: any) => void;
  onDeleteLearned?: (date: string, id: string) => void;
  fireToast: (msg: string, tone?: string) => void;
  openKit: (tab: string) => void;
}

export function ShareTargetModal({
  sharedUrl,
  sharedTitle,
  sharedText,
  onClose,
  onSaveBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  onSaveLearned,
  onDeleteLearned,
  fireToast,
  openKit,
}: ShareTargetModalProps) {
  const normalizedUrl = normalizeBookmarkUrl(sharedUrl) || sharedUrl;
  const host = hostnameOf(normalizedUrl);
  const detectedKind = detectBookmarkKind(normalizedUrl);

  const [destination, setDestination] = useState<"bookmarks" | "learned">("bookmarks");
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [savedDateKey, setSavedDateKey] = useState<string | null>(null);
  const [showEditDrawer, setShowEditDrawer] = useState<"none" | "tags" | "note" | "full">("none");

  const [title, setTitle] = useState(
    sharedTitle || defaultTitleForUrl(normalizedUrl)
  );
  const [kind, setKind] = useState<BookmarkKind>(detectedKind);
  const [note, setNote] = useState(sharedText && sharedText !== sharedTitle ? sharedText : "");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [preview, setPreview] = useState<any>(() => seedPreviewFromUrl(normalizedUrl));

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(6);

  // Auto-Save on Mount (Pocket Style Instant Save)
  useEffect(() => {
    if (!normalizedUrl) return;

    const bmId = createBookmarkId();
    const item = {
      id: bmId,
      url: normalizedUrl,
      kind: detectedKind,
      title: title.trim() || defaultTitleForUrl(normalizedUrl),
      note: note.trim() || undefined,
      tags: [],
      preview,
      createdAt: Date.now(),
    };

    onSaveBookmark(item);
    setSavedItemId(bmId);
    fireToast("Saved to Bookmarks", "day");

    // Background preview fetch
    fetch("/api/bookmarks/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalizedUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.preview) return;
        setPreview(data.preview);
        if (data.preview.title && !sharedTitle) {
          setTitle(data.preview.title);
        }
        if (onUpdateBookmark) {
          onUpdateBookmark({ ...item, preview: data.preview, title: data.preview.title || item.title });
        }
      })
      .catch(() => {});
  }, []);

  // Auto-close countdown (pauses if editing)
  useEffect(() => {
    if (showEditDrawer !== "none") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showEditDrawer, onClose]);

  // Toggle Destination (Bookmarks <-> Learned)
  const handleToggleDestination = () => {
    if (!normalizedUrl) return;

    if (destination === "bookmarks") {
      // Move from Bookmarks to Learned
      if (savedItemId && onDeleteBookmark) {
        onDeleteBookmark(savedItemId);
      }
      const today = dateKey();
      const newLearnedId = createLearnedId();
      const learnedItem = {
        id: newLearnedId,
        title: title.trim() || defaultTitleForUrl(normalizedUrl),
        insight: note.trim() || `Saved from ${host || "shared link"}`,
        sourceUrl: normalizedUrl,
        tags: tags.length ? tags : [host || "shared"],
        createdAt: Date.now(),
      };
      onSaveLearned(today, learnedItem);
      setSavedItemId(newLearnedId);
      setSavedDateKey(today);
      setDestination("learned");
      fireToast("Moved to Learned Log", "day");
    } else {
      // Move from Learned to Bookmarks
      if (savedItemId && savedDateKey && onDeleteLearned) {
        onDeleteLearned(savedDateKey, savedItemId);
      }
      const bmId = createBookmarkId();
      const bmItem = {
        id: bmId,
        url: normalizedUrl,
        kind,
        title: title.trim() || defaultTitleForUrl(normalizedUrl),
        note: note.trim() || undefined,
        tags,
        preview,
        createdAt: Date.now(),
      };
      onSaveBookmark(bmItem);
      setSavedItemId(bmId);
      setSavedDateKey(null);
      setDestination("bookmarks");
      fireToast("Moved to Bookmarks", "day");
    }
  };

  // Save edits
  const handleSaveEdits = () => {
    if (!normalizedUrl) return;
    if (destination === "bookmarks" && savedItemId && onUpdateBookmark) {
      onUpdateBookmark({
        id: savedItemId,
        url: normalizedUrl,
        kind,
        title: title.trim() || defaultTitleForUrl(normalizedUrl),
        note: note.trim() || undefined,
        tags,
        preview,
        createdAt: Date.now(),
      });
      fireToast("Updated Bookmark", "ok");
    } else if (destination === "learned" && savedItemId && savedDateKey) {
      onSaveLearned(savedDateKey, {
        id: savedItemId,
        title: title.trim() || defaultTitleForUrl(normalizedUrl),
        insight: note.trim() || `Saved from ${host || "shared link"}`,
        sourceUrl: normalizedUrl,
        tags,
        createdAt: Date.now(),
      });
      fireToast("Updated Learned Log", "ok");
    }
    setShowEditDrawer("none");
    onClose();
  };

  const handleUndo = () => {
    if (destination === "bookmarks" && savedItemId && onDeleteBookmark) {
      onDeleteBookmark(savedItemId);
    } else if (destination === "learned" && savedItemId && savedDateKey && onDeleteLearned) {
      onDeleteLearned(savedDateKey, savedItemId);
    }
    fireToast("Save Undone", "warn");
    onClose();
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none animate-fadeIn">
      <div className="w-full max-w-[500px] bg-[#0C1116] border-2 border-amber-400/80 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transition-all duration-300 text-[#EEF2F6]">
        {/* Main Pocket Card Bar */}
        <div className="p-3.5 bg-[#161C24] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold shrink-0 shadow-lg">
              <Icon.Check size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
                  Saved to {destination === "bookmarks" ? "Bookmarks" : "Learned"}
                </span>
                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                  {host || "link"}
                </span>
              </div>
              <p className="text-xs font-semibold truncate text-white mt-0.5">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => openKit(destination)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition text-xs font-mono"
              title="Open View"
            >
              View →
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
              title="Done"
            >
              <Icon.X size={16} />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-3.5 py-2 bg-[#0C1116] border-t border-[#26303B] flex items-center justify-between gap-1 text-xs font-mono overflow-x-auto">
          <button
            onClick={handleToggleDestination}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-amber-400/20 hover:text-amber-300 text-gray-300 transition shrink-0"
          >
            {destination === "bookmarks" ? <Icon.Brain size={13} /> : <Icon.Bookmark size={13} />}
            <span>Move to {destination === "bookmarks" ? "Learned" : "Bookmarks"}</span>
          </button>

          <button
            onClick={() => setShowEditDrawer(showEditDrawer === "tags" ? "none" : "tags")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition shrink-0 ${
              showEditDrawer === "tags"
                ? "bg-amber-400 text-black font-semibold"
                : "bg-white/5 hover:bg-white/10 text-gray-300"
            }`}
          >
            <span>+ Tags</span>
          </button>

          <button
            onClick={() => setShowEditDrawer(showEditDrawer === "note" ? "none" : "note")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition shrink-0 ${
              showEditDrawer === "note"
                ? "bg-amber-400 text-black font-semibold"
                : "bg-white/5 hover:bg-white/10 text-gray-300"
            }`}
          >
            <span>+ Note</span>
          </button>

          <button
            onClick={handleUndo}
            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition shrink-0"
          >
            Undo
          </button>

          {showEditDrawer === "none" && (
            <span className="text-[10px] text-gray-500 font-mono ml-auto shrink-0">
              Closing in {countdown}s
            </span>
          )}
        </div>

        {/* Expandable Quick Edit Drawer */}
        {showEditDrawer !== "none" && (
          <div className="p-3.5 bg-[#161C24] border-t border-[#26303B] space-y-3 animate-fadeIn">
            {showEditDrawer === "tags" && (
              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1">
                  Add Tags (Press Enter)
                </label>
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                        className="hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="tag name..."
                    className="flex-1 bg-[#0C1116] border border-[#26303B] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1 bg-amber-400 text-black font-semibold rounded-lg text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {showEditDrawer === "note" && (
              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1">
                  {destination === "learned" ? "Key Reflection" : "Notes"}
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add quick notes..."
                  className="w-full bg-[#0C1116] border border-[#26303B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowEditDrawer("none")}
                className="px-3 py-1 text-xs font-mono text-gray-400 hover:text-white"
              >
                Close Drawer
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                className="px-4 py-1.5 bg-amber-400 text-black font-semibold rounded-lg text-xs font-mono shadow"
              >
                Done Editing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
