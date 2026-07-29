export const SOURCE_MAX_CHARS = 14_000;
export const SOURCE_MAX_URLS = 3;

export type SourceKind = "youtube" | "article" | "link";
export type SourceProvider = "youtube-captions" | "jina" | "html" | "oembed" | "none";

export type SourceContent = {
  url: string;
  kind: SourceKind;
  title?: string;
  text: string;
  provider: SourceProvider;
  truncated: boolean;
};

export function clipSourceText(text: string, max = SOURCE_MAX_CHARS): { text: string; truncated: boolean } {
  const cleaned = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (cleaned.length <= max) return { text: cleaned, truncated: false };
  const slice = cleaned.slice(0, max);
  const cut = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf(" "));
  const textOut = (cut > max * 0.6 ? slice.slice(0, cut) : slice).trim() + "…";
  return { text: textOut, truncated: true };
}

/** Format extracted sources for the enrichment prompt. */
export function formatSourcesForPrompt(sources: SourceContent[]): string {
  const usable = sources.filter((s) => s.text.trim().length > 0);
  if (!usable.length) return "";
  return usable
    .map((s, i) => {
      const head = [
        `Source ${i + 1}`,
        s.kind,
        s.provider !== "none" ? `via ${s.provider}` : null,
        s.title ? `title: ${s.title}` : null,
        s.url,
        s.truncated ? "(truncated)" : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `--- ${head} ---\n${s.text}`;
    })
    .join("\n\n");
}
