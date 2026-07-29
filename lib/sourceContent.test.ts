import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "@/lib/sourceContent";
import {
  clipSourceText,
  formatSourcesForPrompt,
  SOURCE_MAX_CHARS,
  type SourceContent,
} from "@/lib/sourceContentShared";
import { isPrivateHostname } from "@/lib/urlSafety";

describe("sourceContent helpers", () => {
  it("clips long text on a sentence boundary when possible", () => {
    const long = ("Sentence one. ".repeat(20) + "Keep going. ").repeat(80);
    expect(long.length).toBeGreaterThan(SOURCE_MAX_CHARS);
    const { text, truncated } = clipSourceText(long);
    expect(truncated).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(SOURCE_MAX_CHARS + 1);
  });

  it("htmlToPlainText strips scripts and keeps readable flow", () => {
    const html = `
      <html><body>
        <script>evil()</script>
        <article>
          <h1>Hello</h1>
          <p>First paragraph.</p>
          <p>Second &amp; last.</p>
        </article>
      </body></html>`;
    const text = htmlToPlainText(html);
    expect(text).toContain("Hello");
    expect(text).toContain("First paragraph.");
    expect(text).toContain("Second & last.");
    expect(text).not.toContain("evil");
  });

  it("formatSourcesForPrompt skips empty sources", () => {
    const sources: SourceContent[] = [
      {
        url: "https://youtu.be/abc",
        kind: "youtube",
        title: "Demo",
        text: "Hello from captions",
        provider: "youtube-captions",
        truncated: false,
      },
      {
        url: "https://example.com",
        kind: "article",
        text: "",
        provider: "none",
        truncated: false,
      },
    ];
    const block = formatSourcesForPrompt(sources);
    expect(block).toContain("youtube-captions");
    expect(block).toContain("Hello from captions");
    expect(block).not.toContain("example.com");
  });
});

describe("urlSafety", () => {
  it("flags private hosts", () => {
    expect(isPrivateHostname("localhost")).toBe(true);
    expect(isPrivateHostname("127.0.0.1")).toBe(true);
    expect(isPrivateHostname("192.168.1.1")).toBe(true);
    expect(isPrivateHostname("example.com")).toBe(false);
  });
});
