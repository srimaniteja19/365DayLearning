import type { ChatRequest, ProviderConfig } from "@/lib/providers/types";
import { ContentError, fetchWithRetry, mapHttpError } from "@/lib/providers/errors";

export async function openAiCompatibleChat(
  endpoint: string,
  req: ChatRequest,
  cfg: ProviderConfig,
  extraHeaders?: Record<string, string>,
  opts?: { preferJsonSchema?: boolean },
): Promise<string> {
  if (!cfg.apiKey?.trim()) throw mapHttpError(401, "Missing API key");

  const messages: Array<{ role: string; content: string }> = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.prompt });

  let responseFormat: Record<string, unknown> | undefined;
  if (req.structured) {
    if (opts?.preferJsonSchema) {
      responseFormat = {
        type: "json_schema",
        json_schema: {
          name: req.structured.name,
          strict: true,
          schema: withAdditionalPropertiesFalse(req.structured.schema),
        },
      };
    } else {
      responseFormat = { type: "json_object" };
    }
  }

  const res = await fetchWithRetry(endpoint, {
    method: "POST",
    signal: req.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      messages,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    if (req.structured && (res.status === 400 || res.status === 422)) {
      if (opts?.preferJsonSchema) {
        return openAiCompatibleChat(endpoint, req, cfg, extraHeaders, {
          preferJsonSchema: false,
        });
      }
      // Model rejects response_format entirely — retry as plain chat.
      const plainReq: ChatRequest = { ...req, structured: undefined };
      return openAiCompatibleChat(endpoint, plainReq, cfg, extraHeaders, opts);
    }
    throw mapHttpError(res.status, raw, res.headers.get("Retry-After"));
  }

  let data: {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ContentError("Response was not valid JSON.");
  }

  const content = data.choices?.[0]?.message?.content;
  let text = "";
  if (typeof content === "string") text = content.trim();
  else if (Array.isArray(content)) {
    text = content
      .map((c) => (typeof c === "string" ? c : c.text || ""))
      .join("")
      .trim();
  }

  if (!text) throw new ContentError("Empty response from model.");
  return text;
}

function withAdditionalPropertiesFalse(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(walk);
    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = { ...src };
    if (out.type === "object") {
      out.additionalProperties = false;
      if (out.properties && typeof out.properties === "object") {
        const props: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(out.properties as Record<string, unknown>)) {
          props[k] = walk(v);
        }
        out.properties = props;
      }
    }
    if (out.items) out.items = walk(out.items);
    return out;
  };
  return walk(schema) as Record<string, unknown>;
}
