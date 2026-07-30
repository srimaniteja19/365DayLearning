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
      video: undefined,
    };
  }
  const pair = slot as TopicResourcePair;
  return {
    article: pair.article ?? undefined,
    video: pair.video ?? undefined,
  };
}

export function pairHasAnyResource(
  slot: TopicResourcePair | TopicResource | null | undefined,
): boolean {
  const pair = asResourcePair(slot);
  return !!(pair?.article?.url || pair?.video?.url);
}

export function searchPromptForKind(
  title: string,
  category: string,
  kind: TopicResourceKind,
): string {
  if (kind === "video") {
    return `Find one high-quality educational video (preferably YouTube or a well-known course lecture) for the topic: "${title}" in the context of ${category}. Prefer clear tutorials or lectures from reputable channels over spam. Return only the single best video.`;
  }
  return `Find one high-quality, authoritative learning article or official docs page for the topic: "${title}" in the context of ${category}. Prefer official documentation or widely-cited articles over blogspam. Return only the single best article.`;
}
