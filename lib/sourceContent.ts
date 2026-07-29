import { fetchTranscript } from "youtube-transcript";
import {
  detectBookmarkKind,
  extractYoutubeId,
  hostnameOf,
  normalizeBookmarkUrl,
} from "@/lib/bookmarks";
import {
  clipSourceText,
  formatSourcesForPrompt,
  SOURCE_MAX_URLS,
  type SourceContent,
  type SourceKind,
} from "@/lib/sourceContentShared";
import { isPrivateHostname } from "@/lib/urlSafety";

export {
  clipSourceText,
  formatSourcesForPrompt,
  SOURCE_MAX_CHARS,
  SOURCE_MAX_URLS,
  type SourceContent,
  type SourceKind,
  type SourceProvider,
} from "@/lib/sourceContentShared";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 800_000;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function metaContent(html: string, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const reProp = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    );
    const reProp2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      "i",
    );
    const m = html.match(reProp) || html.match(reProp2);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function pageTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1].trim()) : undefined;
}

function pickMainHtml(html: string): string {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article?.[1] && article[1].length > 400) return article[1];
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main?.[1] && main[1].length > 400) return main[1];
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return body?.[1] || html;
}

/** Rough readable text from HTML — good enough for summarization context. */
export function htmlToPlainText(html: string): string {
  const chunk = pickMainHtml(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/section|\/article|\/header|\/footer)[^>]*>/gi, "\n")
    .replace(/<(p|div|h[1-6]|li|tr|section|article|header|footer)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(chunk);
}

function kindForUrl(url: string): SourceKind {
  const k = detectBookmarkKind(url);
  if (k === "youtube") return "youtube";
  if (k === "article" || k === "doc" || k === "repo") return "article";
  return "link";
}

async function fetchYoutubeCaptions(url: string): Promise<SourceContent | null> {
  const id = extractYoutubeId(url);
  if (!id) return null;
  try {
    const segments = await fetchTranscript(url);
    const joined = segments
      .map((s) => String(s.text || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");
    const clipped = clipSourceText(joined);
    if (!clipped.text) return null;
    return {
      url,
      kind: "youtube",
      title: undefined,
      text: clipped.text,
      provider: "youtube-captions",
      truncated: clipped.truncated,
    };
  } catch {
    return null;
  }
}

async function fetchYoutubeOembedTitle(url: string): Promise<string | undefined> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { title?: string };
    return data.title?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function fetchViaJina(url: string): Promise<SourceContent | null> {
  const key = process.env.JINA_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/plain",
        Authorization: `Bearer ${key}`,
        "X-Return-Format": "markdown",
      },
    });
    if (!res.ok) return null;
    const raw = await res.text();
    const clipped = clipSourceText(raw);
    if (clipped.text.length < 80) return null;
    const titleLine = raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
    return {
      url,
      kind: kindForUrl(url),
      title: titleLine,
      text: clipped.text,
      provider: "jina",
      truncated: clipped.truncated,
    };
  } catch {
    return null;
  }
}

async function fetchViaHtml(url: string): Promise<SourceContent | null> {
  const host = hostnameOf(url);
  if (isPrivateHostname(host)) return null;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "RefrainlySourceBot/1.0 (+https://refrainly.app)",
      },
    });
    const finalUrl = res.url || url;
    if (isPrivateHostname(hostnameOf(finalUrl))) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!/html|xml|text\/plain/i.test(ctype) && res.ok) return null;

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);

    const title =
      metaContent(html, "og:title", "twitter:title") || pageTitle(html) || undefined;
    const description =
      metaContent(html, "og:description", "twitter:description", "description") || "";
    const bodyText = htmlToPlainText(html);
    const merged = [description, bodyText].filter(Boolean).join("\n\n");
    const clipped = clipSourceText(merged);
    if (clipped.text.length < 40) {
      if (!title && !description) return null;
      const thin = clipSourceText([title, description].filter(Boolean).join("\n\n"));
      return {
        url: finalUrl,
        kind: kindForUrl(url),
        title,
        text: thin.text,
        provider: "html",
        truncated: thin.truncated,
      };
    }
    return {
      url: finalUrl,
      kind: kindForUrl(url),
      title,
      text: clipped.text,
      provider: "html",
      truncated: clipped.truncated,
    };
  } catch {
    return null;
  }
}

/** Pull transcript / article text for one public URL. Never throws. */
export async function extractSourceContent(rawUrl: string): Promise<SourceContent> {
  const url = normalizeBookmarkUrl(rawUrl);
  if (!url) {
    return { url: rawUrl, kind: "link", text: "", provider: "none", truncated: false };
  }
  const host = hostnameOf(url);
  if (isPrivateHostname(host)) {
    return { url, kind: "link", text: "", provider: "none", truncated: false };
  }

  const kind = kindForUrl(url);

  if (kind === "youtube") {
    const captions = await fetchYoutubeCaptions(url);
    if (captions) {
      const title = await fetchYoutubeOembedTitle(url);
      return title ? { ...captions, title } : captions;
    }
    const jina = await fetchViaJina(url);
    if (jina) return { ...jina, kind: "youtube" };
    const title = await fetchYoutubeOembedTitle(url);
    return {
      url,
      kind: "youtube",
      title,
      text: title ? `Video title: ${title}` : "",
      provider: title ? "oembed" : "none",
      truncated: false,
    };
  }

  const jina = await fetchViaJina(url);
  if (jina) return jina;

  const html = await fetchViaHtml(url);
  if (html) return html;

  return { url, kind, text: "", provider: "none", truncated: false };
}

export async function extractSourcesForUrls(urls: string[]): Promise<SourceContent[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const n = normalizeBookmarkUrl(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    unique.push(n);
    if (unique.length >= SOURCE_MAX_URLS) break;
  }
  const results: SourceContent[] = [];
  for (const url of unique) {
    results.push(await extractSourceContent(url));
  }
  return results;
}
