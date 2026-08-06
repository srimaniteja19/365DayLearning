import { describe, expect, it } from "vitest";
import { extractUrlFromShare } from "@/app/share-target/page";

describe("extractUrlFromShare", () => {
  it("extracts clean URL when url parameter is provided directly", () => {
    const res = extractUrlFromShare("https://example.com/article?id=123", "Some text");
    expect(res).toBe("https://example.com/article?id=123");
  });

  it("extracts URL from text when url parameter is missing or empty (e.g. YouTube Android Share)", () => {
    const res = extractUrlFromShare(
      "",
      "Check out this awesome video! https://youtu.be/dQw4w9WgXcQ"
    );
    expect(res).toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it("strips trailing punctuation attached by native app share text", () => {
    const res = extractUrlFromShare(
      null,
      "Read this article (https://news.ycombinator.com/item?id=999)."
    );
    expect(res).toBe("https://news.ycombinator.com/item?id=999");
  });

  it("handles Twitter/X share format", () => {
    const res = extractUrlFromShare(
      undefined,
      "Interesting post on X https://x.com/nextjs/status/123456789"
    );
    expect(res).toBe("https://x.com/nextjs/status/123456789");
  });
});
