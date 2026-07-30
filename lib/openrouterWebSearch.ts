import { ContentError, fetchWithRetry, mapHttpError } from "@/lib/providers/errors";

export type UrlCitation = {
  url: string;
  title?: string;
  content?: string;
};

export type WebSearchResult = {
  text: string;
  citation: UrlCitation | null;
  citations: UrlCitation[];
};

type Annotation =
  | {
      type?: string;
      url_citation?: {
        url?: string;
        title?: string;
        content?: string;
      };
      url?: string;
      title?: string;
      content?: string;
    }
  | null
  | undefined;

/**
 * Extract url_citation annotations from an OpenRouter chat message.
 * Prefers the nested `url_citation` object; also accepts flat annotation shapes.
 */
export function parseUrlCitations(annotations: unknown): UrlCitation[] {
  if (!Array.isArray(annotations)) return [];
  const out: UrlCitation[] = [];
  for (const raw of annotations as Annotation[]) {
    if (!raw || typeof raw !== "object") continue;
    const type = String(raw.type || "");
    if (type && type !== "url_citation") continue;

    const nested = raw.url_citation;
    const url =
      (nested && typeof nested.url === "string" && nested.url) ||
      (typeof raw.url === "string" ? raw.url : "") ||
      "";
    if (!url.trim()) continue;

    const title =
      (nested && typeof nested.title === "string" && nested.title) ||
      (typeof raw.title === "string" ? raw.title : undefined);
    const content =
      (nested && typeof nested.content === "string" && nested.content) ||
      (typeof raw.content === "string" ? raw.content : undefined);

    out.push({
      url: url.trim(),
      title: title?.trim() || undefined,
      content: content?.trim() || undefined,
    });
  }
  return out;
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) {
          return String((c as { text?: unknown }).text || "");
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

export type OpenRouterWebSearchOpts = {
  apiKey: string;
  model: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  baseUrl?: string;
  /** Cap results per search call (cost control). */
  maxResults?: number;
  referer?: string;
  title?: string;
  /** Optional domain allow-list for Exa / supported engines. */
  allowedDomains?: string[];
};

/**
 * Chat Completions call with the native `openrouter:web_search` server tool.
 * Returns parsed url_citation annotations — never regexes URLs from message text.
 */
export async function openRouterWebSearch(
  opts: OpenRouterWebSearchOpts,
): Promise<WebSearchResult> {
  if (!opts.apiKey?.trim()) throw mapHttpError(401, "Missing API key");

  const base = (opts.baseUrl || "https://openrouter.ai/api").replace(/\/$/, "");
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const parameters: Record<string, unknown> = {
    max_results: opts.maxResults ?? 3,
    max_uses: 1,
    search_context_size: "low",
  };
  if (opts.allowedDomains?.length) {
    parameters.allowed_domains = opts.allowedDomains;
  }

  const res = await fetchWithRetry(`${base}/v1/chat/completions`, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "HTTP-Referer": opts.referer || "https://refrainly.dev",
      "X-Title": opts.title || "Refrainly",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 200,
      temperature: opts.temperature ?? 0.1,
      messages,
      tools: [
        {
          type: "openrouter:web_search",
          parameters,
        },
      ],
      // One search is enough — we only need url_citation annotations, not a long essay.
      max_tool_calls: 1,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw mapHttpError(res.status, raw, res.headers.get("Retry-After"));
  }

  let data: {
    choices?: Array<{
      message?: {
        content?: unknown;
        annotations?: unknown;
      };
    }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ContentError("Response was not valid JSON.");
  }

  const message = data.choices?.[0]?.message;
  const text = messageText(message?.content);
  const citations = parseUrlCitations(message?.annotations);
  return {
    text,
    citation: citations[0] || null,
    citations,
  };
}
