import type { ChatRequest, Provider, ProviderConfig } from "@/lib/providers/types";
import { ContentError, fetchWithRetry, mapHttpError } from "@/lib/providers/errors";

export const geminiProvider: Provider = {
  id: "gemini",
  label: "Google Gemini",
  models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  needsKey: true,
  keyHint: "AIza...",
  docsUrl: "https://aistudio.google.com/apikey",
  defaultBaseUrl: "https://generativelanguage.googleapis.com",

  async chat(req: ChatRequest, cfg: ProviderConfig): Promise<string> {
    if (!cfg.apiKey?.trim()) throw mapHttpError(401, "Missing Gemini API key");

    const base = (cfg.baseUrl || this.defaultBaseUrl!).replace(/\/$/, "");
    const model = encodeURIComponent(cfg.model);
    const url = `${base}/v1beta/models/${model}:generateContent`;

    const parts: Array<{ text: string }> = [];
    if (req.system) parts.push({ text: `System: ${req.system}\n\n` });
    parts.push({ text: req.prompt });

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: req.maxTokens,
      temperature: req.temperature,
    };
    if (req.structured) {
      // Force JSON; include schema when the API accepts it.
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = toGeminiSchema(req.structured.schema);
    }

    const res = await fetchWithRetry(url, {
      method: "POST",
      signal: req.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cfg.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
    });

    const raw = await res.text();
    if (!res.ok) throw mapHttpError(res.status, raw, res.headers.get("Retry-After"));

    let data: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ContentError("Gemini response was not valid JSON.");
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    if (!text) throw new ContentError("Empty response from Gemini.");
    return text;
  },
};

/** Gemini responseSchema is a subset of JSON Schema — strip unsupported keys. */
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(walk);
    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of [
      "type",
      "properties",
      "items",
      "required",
      "enum",
      "description",
      "nullable",
      "minItems",
      "maxItems",
      "minimum",
      "maximum",
    ]) {
      if (src[key] === undefined) continue;
      if (key === "properties" && src.properties && typeof src.properties === "object") {
        const props: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(src.properties as Record<string, unknown>)) {
          props[k] = walk(v);
        }
        out.properties = props;
      } else if (key === "items") {
        out.items = walk(src.items);
      } else {
        out[key] = src[key];
      }
    }
    // Gemini uses UPPERCASE type names in some versions; lowercase is accepted in v1beta.
    return out;
  };
  return walk(schema) as Record<string, unknown>;
}
