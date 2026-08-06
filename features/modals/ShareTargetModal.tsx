"use client";

import React, { useState, useEffect } from "react";
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
  onSaveLearned: (date: string, item: any) => void;
  fireToast: (msg: string, tone?: string) => void;
  openKit: (tab: string) => void;
}

export function ShareTargetModal({
  sharedUrl,
  sharedTitle,
  sharedText,
  onClose,
  onSaveBookmark,
  onSaveLearned,
  fireToast,
  openKit,
}: ShareTargetModalProps) {
  const normalizedUrl = normalizeBookmarkUrl(sharedUrl) || sharedUrl;
  const host = hostnameOf(normalizedUrl);
  const detectedKind = detectBookmarkKind(normalizedUrl);

  const [destination, setDestination] = useState<"bookmarks" | "learned">("bookmarks");

  // Shared metadata states
  const [title, setTitle] = useState(
    sharedTitle || defaultTitleForUrl(normalizedUrl)
  );
  const [kind, setKind] = useState<BookmarkKind>(detectedKind);
  const [note, setNote] = useState(sharedText && sharedText !== sharedTitle ? sharedText : "");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [preview, setPreview] = useState<any>(() => seedPreviewFromUrl(normalizedUrl));
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch richer metadata (og:title, og:image, description) in background
  useEffect(() => {
    if (!normalizedUrl) return;
    let canceled = false;
    setLoadingPreview(true);
    fetch("/api/bookmarks/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalizedUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (canceled || !data?.preview) return;
        setPreview(data.preview);
        if (data.preview.title && !sharedTitle) {
          setTitle(data.preview.title);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!canceled) setLoadingPreview(false);
      });
    return () => {
      canceled = true;
    };
  }, [normalizedUrl, sharedTitle]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const handleSave = () => {
    if (!normalizedUrl) return;

    if (destination === "bookmarks") {
      const item = {
        id: createBookmarkId(),
        url: normalizedUrl,
        kind,
        title: title.trim() || defaultTitleForUrl(normalizedUrl),
        note: note.trim() || undefined,
        tags,
        preview,
        createdAt: Date.now(),
      };
      onSaveBookmark(item);
      fireToast("Saved to Bookmarks", "day");
      openKit("bookmarks");
    } else {
      const today = dateKey();
      const learnedItem = {
        id: createLearnedId(),
        title: title.trim() || defaultTitleForUrl(normalizedUrl),
        insight: note.trim() || `Saved from ${host || "shared link"}`,
        sourceUrl: normalizedUrl,
        tags: tags.length ? tags : [host || "shared"],
        createdAt: Date.now(),
      };
      onSaveLearned(today, learnedItem);
      fireToast("Saved to Learned", "day");
      openKit("learned");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-[480px] bg-[#0C1116] border border-[#26303B] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#26303B] flex items-center justify-between bg-[#161C24]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Icon.Share size={16} />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[#EEF2F6]">Received Shared Link</h2>
              <p className="text-xs text-gray-400 truncate max-w-[240px] font-mono">{host || normalizedUrl}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <Icon.X size={16} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Shared Link Preview Card */}
          <div className="p-3 bg-[#161C24] border border-[#26303B] rounded-xl flex gap-3 items-center">
            {preview?.image ? (
              <img
                src={preview.image}
                alt="Preview"
                className="w-14 h-14 object-cover rounded-lg border border-[#26303B] shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-amber-400/5 border border-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
                {kind === "youtube" ? <Icon.Youtube size={24} /> : <Icon.Link size={24} />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-semibold">
                  {kind}
                </span>
                {loadingPreview && (
                  <span className="text-[10px] font-mono text-gray-400 animate-pulse">Fetching preview...</span>
                )}
              </div>
              <p className="text-xs font-mono text-amber-400/90 truncate">{normalizedUrl}</p>
            </div>
          </div>

          {/* Save Destination Tabs */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider font-mono">
              Save Destination
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#161C24] border border-[#26303B] rounded-xl">
              <button
                type="button"
                onClick={() => setDestination("bookmarks")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-xs transition ${
                  destination === "bookmarks"
                    ? "bg-amber-400 text-black font-semibold shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon.Bookmark size={14} />
                <span>Bookmarks</span>
              </button>

              <button
                type="button"
                onClick={() => setDestination("learned")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-xs transition ${
                  destination === "learned"
                    ? "bg-amber-400 text-black font-semibold shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon.Brain size={14} />
                <span>Learned Log</span>
              </button>
            </div>
          </div>

          {/* Title Field */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 font-mono uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title for this link..."
              className="w-full bg-[#161C24] border border-[#26303B] rounded-xl px-3 py-2 text-xs text-[#EEF2F6] focus:outline-none focus:border-amber-400/60"
            />
          </div>

          {/* Destination Specific Fields */}
          {destination === "bookmarks" ? (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 font-mono uppercase tracking-wider">
                Category Kind
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as BookmarkKind)}
                className="w-full bg-[#161C24] border border-[#26303B] rounded-xl px-3 py-2 text-xs text-[#EEF2F6] focus:outline-none focus:border-amber-400/60"
              >
                <option value="article">Article</option>
                <option value="youtube">Video (YouTube / Vimeo)</option>
                <option value="repo">Code / Repository</option>
                <option value="doc">Documentation</option>
                <option value="link">General Link</option>
                <option value="note">Note</option>
              </select>
            </div>
          ) : null}

          {/* Notes / Insights Field */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 font-mono uppercase tracking-wider">
              {destination === "learned" ? "Key Takeaway / Reflection" : "Notes / Comment (Optional)"}
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                destination === "learned"
                  ? "What did you learn from this resource?"
                  : "Add optional notes or why you saved this link..."
              }
              className="w-full bg-[#161C24] border border-[#26303B] rounded-xl px-3 py-2 text-xs text-[#EEF2F6] focus:outline-none focus:border-amber-400/60 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 font-mono uppercase tracking-wider">
              Tags
            </label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
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
                placeholder="Add a tag and press enter..."
                className="flex-1 bg-[#161C24] border border-[#26303B] rounded-xl px-3 py-1.5 text-xs text-[#EEF2F6] focus:outline-none focus:border-amber-400/60"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-[#161C24] border border-[#26303B] hover:border-amber-400/50 rounded-xl text-xs text-gray-300 font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#26303B] bg-[#161C24] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-black shadow-lg transition flex items-center gap-1.5"
          >
            <Icon.Check size={14} />
            <span>Save to {destination === "bookmarks" ? "Bookmarks" : "Learned"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
