import { describe, expect, it } from "vitest";
import {
  applyPreviewToBookmark,
  detectBookmarkKind,
  extractVimeoId,
  extractYoutubeId,
  mergeBookmarks,
  normalizeBookmarkUrl,
  sanitizeBookmarks,
} from "@/lib/bookmarks";

describe("bookmarks helpers", () => {
  it("normalizes and rejects bad URLs", () => {
    expect(normalizeBookmarkUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeBookmarkUrl("example.com/path")).toBe("https://example.com/path");
    expect(normalizeBookmarkUrl("not a url")).toBeNull();
    expect(normalizeBookmarkUrl("ftp://x.com")).toBeNull();
  });

  it("extracts YouTube and Vimeo ids", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVimeoId("https://vimeo.com/123456789")).toBe("123456789");
  });

  it("detects kinds", () => {
    expect(detectBookmarkKind("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(detectBookmarkKind("https://github.com/vercel/next.js")).toBe("repo");
    expect(detectBookmarkKind("https://docs.google.com/document/d/abc")).toBe("doc");
  });

  it("sanitizeBookmarks drops junk and keeps valid clips", () => {
    const out = sanitizeBookmarks([
      { id: "b1", url: "https://example.com/x", title: "Hello", createdAt: 1 },
      { url: "not-valid", title: "Nope" },
      { id: "b1", url: "https://example.com/dup", title: "Dup" },
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b1");
    expect(out[0].title).toBe("Hello");
  });

  it("mergeBookmarks dedupes by id", () => {
    const a = [{ id: "1", url: "https://a.com", kind: "link" as const, title: "A", createdAt: 2 }];
    const b = [
      { id: "1", url: "https://a.com", kind: "link" as const, title: "A2", createdAt: 3 },
      { id: "2", url: "https://b.com", kind: "link" as const, title: "B", createdAt: 1 },
    ];
    const merged = mergeBookmarks(a, b);
    expect(merged.map((x) => x.id).sort()).toEqual(["1", "2"]);
    expect(merged.find((x) => x.id === "1")?.title).toBe("A");
  });

  it("applyPreviewToBookmark fills title from remote when placeholder", () => {
    const item = {
      id: "1",
      url: "https://example.com/post",
      kind: "link" as const,
      title: "post",
      createdAt: 1,
    };
    const next = applyPreviewToBookmark(item, {
      title: "Real Title From OG",
      description: "Desc",
      image: "https://cdn.example.com/i.jpg",
      siteName: "Example",
    });
    expect(next.title).toBe("Real Title From OG");
    expect(next.preview?.image).toContain("cdn.example.com");
  });
});
