import DOMAIN_META from "@/data/domains.json";
import { safeHref } from "@/lib/safeHref";
import type {
  TopicResource,
  TopicResourceKind,
  TopicResourcePair,
} from "@/lib/types";
import type { UrlCitation } from "@/lib/openrouterWebSearch";
import { OPENROUTER_DEFAULT_MODEL } from "@/lib/providers/openrouter";

/** Cache TTL for suggested topic resources (90 days). */
export const TOPIC_RESOURCE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const TOPIC_RESOURCE_SEARCH_MODEL = OPENROUTER_DEFAULT_MODEL;

/** Lowercase, trim, collapse whitespace, strip punctuation — stable cache key. */
export function normalizeTopicResourceKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cacheKeyForKind(topicKey: string, kind: TopicResourceKind): string {
  return `${topicKey}::${kind}`;
}

export function domainLabelForSearch(domainId: string | undefined): string {
  if (!domainId) return "General";
  const meta = (DOMAIN_META as Record<string, { label?: string }>)[domainId];
  return meta?.label || domainId;
}

export function isPlaceholderTopic(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  return /^needs review\b/i.test(t) || /^new topic placeholder$/i.test(t);
}

export function citationToResource(
  citation: UrlCitation | null,
  kind?: TopicResourceKind,
): TopicResource | null {
  if (!citation?.url) return null;
  const href = safeHref(citation.url);
  if (!href || !/^https?:\/\//i.test(href)) return null;
  return {
    url: href,
    title: (citation.title || href).slice(0, 300),
    snippet: citation.content ? citation.content.slice(0, 500) : undefined,
    kind,
  };
}

function isLegacyResource(value: unknown): value is TopicResource {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as TopicResource).url === "string" &&
    !("article" in (value as object)) &&
    !("video" in (value as object))
  );
}

/** Normalize legacy single-resource slots into article/video pairs. */
export function asResourcePair(
  slot: TopicResourcePair | TopicResource | null | undefined,
): TopicResourcePair | null | undefined {
  if (slot === undefined) return undefined;
  if (slot === null) return null;
  if (isLegacyResource(slot)) {
    return {
      article: { ...slot, kind: slot.kind || "article" },
    };
  }
  const pair = slot as TopicResourcePair;
  return {
    article: pair.article ?? undefined,
    video: pair.video ?? undefined,
    doc: pair.doc ?? undefined,
    interactive: pair.interactive ?? undefined,
    audio: pair.audio ?? undefined,
    repo: pair.repo ?? undefined,
  };
}

export function pairHasAnyResource(
  slot: TopicResourcePair | TopicResource | null | undefined,
): boolean {
  const pair = asResourcePair(slot);
  return !!(
    pair?.article?.url ||
    pair?.video?.url ||
    pair?.doc?.url ||
    pair?.interactive?.url ||
    pair?.audio?.url ||
    pair?.repo?.url
  );
}

export function searchPromptForKind(
  title: string,
  category: string,
  kind: TopicResourceKind,
): string {
  if (kind === "video") {
    return `Search YouTube for one high-quality educational video tutorial about: "${title}" (${category}). Return a youtube.com or youtu.be watch link.`;
  }
  if (kind === "doc") {
    return `Search for official documentation or API specs for: "${title}" (${category}). Prefer developer.mozilla.org, docs.*, or official spec pages.`;
  }
  if (kind === "interactive") {
    return `Search for interactive practice katas, exercises, or live code sandboxes for: "${title}" (${category}).`;
  }
  if (kind === "audio") {
    return `Search for a podcast episode or audio lecture explaining: "${title}" (${category}).`;
  }
  if (kind === "repo") {
    return `Search GitHub for a well-maintained open source repository or reference codebase for: "${title}" (${category}).`;
  }
  return `Find one authoritative article or official docs page for: "${title}" (${category}). Prefer official docs over blogspam.`;
}

/** One web_search for multi-format resources — returns top educational citations. */
export function searchPromptForPair(title: string, category: string): string {
  return `Find authoritative learning resources for "${title}" (${category}):
1) Official documentation, spec page, or article
2) Educational video, repository, or interactive exercise
Prefer high-quality sources. Do not invent URLs — use web search results only.`;
}

export function isVideoCitationUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be" ||
      host === "vimeo.com" ||
      host.endsWith(".youtube.com")
    );
  } catch {
    return /youtu\.?be|vimeo\.com/i.test(url);
  }
}

export function isDocCitationUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.toLowerCase();
    return (
      host === "developer.mozilla.org" ||
      host.startsWith("docs.") ||
      host.endsWith(".readthedocs.io") ||
      host === "devdocs.io" ||
      path.includes("/docs/") ||
      path.includes("/documentation/") ||
      (host.endsWith("rust-lang.org") && path.includes("/book"))
    );
  } catch {
    return /developer\.mozilla\.org|docs\.|readthedocs\.io|\/docs\//i.test(url);
  }
}

export function isInteractiveCitationUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return (
      host === "exercism.org" ||
      host === "leetcode.com" ||
      host === "codepen.io" ||
      host === "stackblitz.com" ||
      host === "replit.com" ||
      host === "freecodecamp.org" ||
      host === "scrimba.com"
    );
  } catch {
    return /exercism|leetcode|codepen|stackblitz|replit|freecodecamp|scrimba/i.test(url);
  }
}

export function isAudioCitationUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return (
      host === "spotify.com" ||
      host === "podcasts.apple.com" ||
      host === "soundcloud.com" ||
      host === "overcast.fm"
    );
  } catch {
    return /spotify\.com|podcasts\.apple\.com|soundcloud/i.test(url);
  }
}

export function isRepoCitationUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === "github.com" || host === "gitlab.com" || host === "bitbucket.org";
  } catch {
    return /github\.com|gitlab\.com/i.test(url);
  }
}

/** Pick multi-modal resources from a mixed citation list. */
export function pairFromCitations(
  citations: UrlCitation[],
): TopicResourcePair {
  let article: TopicResource | null = null;
  let video: TopicResource | null = null;
  let doc: TopicResource | null = null;
  let interactive: TopicResource | null = null;
  let audio: TopicResource | null = null;
  let repo: TopicResource | null = null;

  for (const c of citations) {
    if (!c?.url) continue;
    if (isRepoCitationUrl(c.url)) {
      if (!repo) repo = citationToResource(c, "repo");
    } else if (isInteractiveCitationUrl(c.url)) {
      if (!interactive) interactive = citationToResource(c, "interactive");
    } else if (isAudioCitationUrl(c.url)) {
      if (!audio) audio = citationToResource(c, "audio");
    } else if (isVideoCitationUrl(c.url)) {
      if (!video) video = citationToResource(c, "video");
    } else {
      if (!article) article = citationToResource(c, "article");
      if (isDocCitationUrl(c.url) && !doc) doc = citationToResource(c, "doc");
    }
  }

  return { article, video, doc, interactive, audio, repo };
}
