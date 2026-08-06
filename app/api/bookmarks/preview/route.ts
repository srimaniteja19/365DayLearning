import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  detectBookmarkKind,
  extractVimeoId,
  extractYoutubeId,
  hostnameOf,
  normalizeBookmarkUrl,
} from "@/lib/bookmarks";
import { isRateLimited, isSameOrigin } from "@/lib/httpGuard";
import type { BookmarkPreview } from "@/lib/types";
import { isPrivateHostname } from "@/lib/urlSafety";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 512_000;
const FETCH_TIMEOUT_MS = 8_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function absolutize(base: string, maybeRel: string | undefined): string | undefined {
  if (!maybeRel) return undefined;
  try {
    return new URL(maybeRel, base).toString();
  } catch {
    return undefined;
  }
}

async function fetchYoutubeOembed(url: string): Promise<BookmarkPreview | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    const id = extractYoutubeId(url);
    return {
      title: data.title,
      siteName: data.author_name ? `YouTube · ${data.author_name}` : "YouTube",
      image: data.thumbnail_url || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined),
      embedId: id || undefined,
      embedProvider: "youtube",
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchVimeoOembed(url: string): Promise<BookmarkPreview | null> {
  try {
    const endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      description?: string;
      thumbnail_url?: string;
      author_name?: string;
      video_id?: number;
    };
    const id = extractVimeoId(url) || (data.video_id ? String(data.video_id) : undefined);
    return {
      title: data.title,
      description: data.description?.slice(0, 800),
      image: data.thumbnail_url,
      siteName: data.author_name ? `Vimeo · ${data.author_name}` : "Vimeo",
      embedId: id,
      embedProvider: "vimeo",
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchOpenGraph(url: string): Promise<BookmarkPreview> {
  const host = hostnameOf(url);
  const preview: BookmarkPreview = {
    siteName: host || undefined,
    favicon: host
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
      : undefined,
    fetchedAt: Date.now(),
  };

  if (isPrivateHostname(host)) {
    return preview;
  }

  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "RefrainlyBookmarkBot/1.0 (+https://refrainly.app)",
    },
  });

  const finalUrl = res.url || url;
  const finalHost = hostnameOf(finalUrl);
  if (isPrivateHostname(finalHost)) {
    return preview;
  }

  const ctype = res.headers.get("content-type") || "";
  if (!/html|xml|text\/plain/i.test(ctype) && res.ok) {
    // Non-HTML (e.g. PDF) — keep host/favicon only
    preview.siteName = finalHost || host;
    return preview;
  }

  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
  const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);

  const title =
    metaContent(html, "og:title", "twitter:title") || pageTitle(html) || undefined;
  const description =
    metaContent(html, "og:description", "twitter:description", "description") || undefined;
  const image = absolutize(
    finalUrl,
    metaContent(html, "og:image", "twitter:image", "twitter:image:src"),
  );
  const siteName = metaContent(html, "og:site_name") || finalHost || host;

  if (title) preview.title = title.slice(0, 300);
  if (description) preview.description = description.slice(0, 800);
  if (image && /^https?:\/\//i.test(image)) preview.image = image.slice(0, 2000);
  if (siteName) preview.siteName = siteName.slice(0, 120);
  preview.favicon = finalHost
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(finalHost)}&sz=64`
    : preview.favicon;

  return preview;
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (await isRateLimited(`bookmark-preview:${session.user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = normalizeBookmarkUrl(body?.url || "");
  if (!url) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const host = hostnameOf(url);
  if (isPrivateHostname(host)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  const kind = detectBookmarkKind(url);
  try {
    let preview: BookmarkPreview | null = null;
    if (kind === "youtube") preview = await fetchYoutubeOembed(url);
    else if (kind === "vimeo") preview = await fetchVimeoOembed(url);

    if (!preview) preview = await fetchOpenGraph(url);

    // Ensure embed ids survive even if oEmbed failed
    const yt = extractYoutubeId(url);
    if (yt) {
      preview.embedId = yt;
      preview.embedProvider = "youtube";
      if (!preview.image) preview.image = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    }
    const vim = extractVimeoId(url);
    if (vim) {
      preview.embedId = vim;
      preview.embedProvider = "vimeo";
    }

    return NextResponse.json({
      url,
      kind,
      preview: { ...preview, fetchedAt: Date.now() },
    });
  } catch {
    return NextResponse.json(
      {
        url,
        kind,
        preview: {
          siteName: host,
          favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
          embedId: extractYoutubeId(url) || extractVimeoId(url) || undefined,
          embedProvider: extractYoutubeId(url)
            ? "youtube"
            : extractVimeoId(url)
              ? "vimeo"
              : undefined,
          image: extractYoutubeId(url)
            ? `https://i.ytimg.com/vi/${extractYoutubeId(url)}/hqdefault.jpg`
            : undefined,
          fetchedAt: Date.now(),
        } satisfies BookmarkPreview,
        warning: "Preview fetch failed",
      },
      { status: 200 },
    );
  }
}
