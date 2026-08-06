import { describe, expect, it } from "vitest";
import {
  buildKitWeekDigest,
  buildLearnedChronoIndex,
  createLearnedId,
  dateKey,
  extractUrlsFromText,
  formatChronoFilterLabel,
  insertAtSelection,
  linkLabelForUrl,
  matchesChronoFilter,
  sanitizeLearned,
  sortedLearnedDays,
  stripLinkMarkup,
  urlFromPaste,
} from "@/lib/learned";

describe("learned helpers", () => {
  it("dateKey uses local calendar date", () => {
    const d = new Date(2026, 6, 27);
    expect(dateKey(d)).toBe("2026-07-27");
  });

  it("sanitizeLearned drops junk and keeps valid items", () => {
    const out = sanitizeLearned({
      "2026-07-27": [
        { id: "a", title: "Redis", body: "notes", createdAt: 1, insight: "keep", archived: true },
        { title: "", body: "", createdAt: 2 },
        null,
      ],
      bad: [{ title: "x", body: "y", createdAt: 1 }],
      "not-a-date": [],
    });
    expect(out["2026-07-27"]).toHaveLength(1);
    expect(out["2026-07-27"][0].insight).toBe("keep");
    expect(out["2026-07-27"][0].archived).toBe(true);
    expect(out.bad).toBeUndefined();
  });

  it("sortedLearnedDays is newest first", () => {
    const days = sortedLearnedDays({
      "2026-07-20": [{ id: "1", title: "old", body: "", createdAt: 1 }],
      "2026-07-27": [
        { id: "2", title: "new", body: "", createdAt: 20 },
        { id: "3", title: "newer", body: "", createdAt: 30 },
      ],
    });
    expect(days.map((d) => d.date)).toEqual(["2026-07-27", "2026-07-20"]);
    expect(days[0].items.map((i) => i.id)).toEqual(["3", "2"]);
  });

  it("createLearnedId is unique-ish", () => {
    expect(createLearnedId()).not.toBe(createLearnedId());
  });

  it("sanitizeLearned keeps allowed tags only", () => {
    const out = sanitizeLearned({
      "2026-07-27": [
        {
          id: "a",
          title: "Talk",
          body: "notes",
          createdAt: 1,
          tags: ["talk", "NOPE", "tip", "talk"],
        },
      ],
    });
    expect(out["2026-07-27"][0].tags).toEqual(["talk", "tip"]);
  });

  it("buildKitWeekDigest counts recent slips and bookmarks", () => {
    const now = Date.parse("2026-07-28T12:00:00Z");
    const digest = buildKitWeekDigest(
      {
        "2026-07-27": [
          {
            id: "1",
            title: "Fresh",
            body: "",
            createdAt: now - 2 * 24 * 60 * 60 * 1000,
            tags: ["talk"],
          },
        ],
        "2026-06-01": [
          {
            id: "2",
            title: "Old",
            body: "",
            createdAt: now - 40 * 24 * 60 * 60 * 1000,
            tags: ["paper"],
          },
        ],
      },
      [
        { createdAt: now - 1 * 24 * 60 * 60 * 1000 },
        { createdAt: now - 20 * 24 * 60 * 60 * 1000 },
      ],
      now,
    );
    expect(digest.slipCount).toBe(1);
    expect(digest.bookmarkCount).toBe(1);
    expect(digest.topTags).toEqual([{ tag: "talk", n: 1 }]);
    expect(digest.recentSlips[0].title).toBe("Fresh");
  });

  it("urlFromPaste accepts a single URL token", () => {
    expect(urlFromPaste("https://youtu.be/9qMHBfLPGAY")).toMatch(/^https:\/\/youtu\.be\//);
    expect(urlFromPaste("youtu.be/9qMHBfLPGAY")).toMatch(/^https:\/\//);
    expect(urlFromPaste("not a url")).toBeNull();
    expect(urlFromPaste("https://a.com and more")).toBeNull();
  });

  it("extractUrlsFromText finds bare and markdown links", () => {
    const urls = extractUrlsFromText(
      "See https://example.com/a and [YouTube](https://youtu.be/9qMHBfLPGAY?si=abc)",
    );
    expect(urls).toContain("https://example.com/a");
    expect(urls.some((u) => u.includes("youtu.be"))).toBe(true);
    expect(urls.length).toBe(2);
  });

  it("linkLabelForUrl prefers YouTube / host", () => {
    expect(linkLabelForUrl("https://youtu.be/9qMHBfLPGAY")).toBe("YouTube");
    expect(linkLabelForUrl("https://www.example.com/path")).toBe("example.com");
  });

  it("insertAtSelection pads tokens", () => {
    expect(insertAtSelection("hello", 5, 5, "https://x.com")).toEqual({
      next: "hello https://x.com",
      cursor: "hello https://x.com".length,
    });
    expect(insertAtSelection("", 0, 0, "https://x.com").next).toBe("https://x.com");
  });

  it("stripLinkMarkup removes bare and markdown links", () => {
    expect(stripLinkMarkup("Watch [YouTube](https://youtu.be/abc) then notes")).toBe(
      "Watch then notes",
    );
    expect(stripLinkMarkup("https://youtu.be/abc")).toBe("");
    expect(stripLinkMarkup("Idea one\n\nhttps://example.com\n\nIdea two")).toBe(
      "Idea one\n\nIdea two",
    );
  });

  it("chrono index and filter drill year → month → day", () => {
    const learned = {
      "2026-07-28": [
        { id: "1", title: "a", body: "", createdAt: 1 },
        { id: "2", title: "b", body: "", createdAt: 2 },
      ],
      "2026-07-01": [{ id: "3", title: "c", body: "", createdAt: 3 }],
      "2025-12-15": [{ id: "4", title: "d", body: "", createdAt: 4 }],
    };
    const index = buildLearnedChronoIndex(learned);
    expect(index.total).toBe(4);
    expect(index.years.map((y) => y.year)).toEqual([2026, 2025]);
    expect(index.months.find((m) => m.month === 7)?.count).toBe(3);

    const scoped = buildLearnedChronoIndex(learned, 2026);
    expect(scoped.months.find((m) => m.month === 7)?.count).toBe(3);
    expect(scoped.months.find((m) => m.month === 12)?.count).toBe(0);

    expect(matchesChronoFilter("2026-07-28", { year: 2026, month: 7, day: null })).toBe(true);
    expect(matchesChronoFilter("2025-12-15", { year: 2026, month: null, day: null })).toBe(false);
    expect(formatChronoFilterLabel({ year: 2026, month: 7, day: null })).toBe("Jul 2026");
  });
});
