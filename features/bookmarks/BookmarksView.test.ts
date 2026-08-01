import { describe, expect, it, vi } from "vitest";
import {
  addBookmarkTag,
  applyPreviewToBookmark,
  createBookmarkId,
  detectBookmarkKind,
  normalizeBookmarkUrl,
  removeBookmarkTag,
  seedPreviewFromUrl,
} from "@/lib/bookmarks";
import type { BookmarkItem } from "@/lib/types";

describe("BookmarksView data flow", () => {
  it("creates valid bookmark items with seed preview", () => {
    const rawUrl = "https://github.com/facebook/react";
    const url = normalizeBookmarkUrl(rawUrl)!;
    expect(url).toBe("https://github.com/facebook/react");

    const kind = detectBookmarkKind(url);
    expect(kind).toBe("repo");

    const item: BookmarkItem = {
      id: createBookmarkId(),
      url,
      kind,
      title: "facebook/react",
      preview: seedPreviewFromUrl(url),
      createdAt: Date.now(),
    };

    expect(item.id).toMatch(/^b-/);
    expect(item.kind).toBe("repo");
    expect(item.preview?.siteName).toBe("github.com");
  });

  it("handles tag addition and removal cleanly", () => {
    let tags: string[] | undefined = undefined;

    tags = addBookmarkTag(tags, "important");
    expect(tags).toEqual(["important"]);

    tags = addBookmarkTag(tags, "design");
    expect(tags).toEqual(["important", "design"]);

    // Deduplication check
    tags = addBookmarkTag(tags, "important");
    expect(tags).toEqual(["important", "design"]);

    tags = removeBookmarkTag(tags, "important");
    expect(tags).toEqual(["design"]);
  });

  it("applies fetched preview metadata to bookmark", () => {
    const item: BookmarkItem = {
      id: "b_test2",
      url: "https://example.com/article",
      kind: "article",
      title: "article",
      createdAt: 100,
    };

    const updated = applyPreviewToBookmark(
      item,
      {
        title: "Fetched Article Title",
        description: "Article preview body snippet",
        siteName: "Example News",
      },
      { overwriteTitle: true },
    );

    expect(updated.title).toBe("Fetched Article Title");
    expect(updated.preview?.siteName).toBe("Example News");
  });
});
