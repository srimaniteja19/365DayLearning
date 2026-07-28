import type { ChatRequest, Provider, ProviderConfig } from "@/lib/providers/types";
import { ContentError, fetchWithRetry, mapHttpError } from "@/lib/providers/errors";

function extractAnthropicText(
  content: Array<{ type: string; text?: string; name?: string; input?: unknown }> | undefined,
  structuredName?: string,
): string {
  const blocks = content || [];
  if (structuredName) {
    const tool = blocks.find((b) => b.type === "tool_use" && b.name === structuredName);
    if (tool && tool.input !== undefined) {
      return JSON.stringify(tool.input);
    }
  }
  const text = blocks
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text;
}

export const anthropicProvider: Provider = {
  id: "anthropic",
  label: "Anthropic",
  models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  needsKey: true,
  keyHint: "sk-ant-...",
  docsUrl: "https://console.anthropic.com/",
  defaultBaseUrl: "https://api.anthropic.com",

  async chat(req: ChatRequest, cfg: ProviderConfig): Promise<string> {
    if (!cfg.apiKey?.trim()) throw mapHttpError(401, "Missing Anthropic API key");

    const base = (cfg.baseUrl || this.defaultBaseUrl!).replace(/\/$/, "");
    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: req.prompt },
    ];

    const body: Record<string, unknown> = {
      model: cfg.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      system: req.system || undefined,
      messages,
    };

    if (req.structured) {
      body.tools = [
        {
          name: req.structured.name,
          description: req.structured.description || "Submit the structured result.",
          input_schema: req.structured.schema,
        },
      ];
      body.tool_choice = { type: "tool", name: req.structured.name };
    }

    const res = await fetchWithRetry(`${base}/v1/messages`, {
      method: "POST",
      signal: req.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    if (!res.ok) throw mapHttpError(res.status, raw, res.headers.get("Retry-After"));

    let data: {
      content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
      stop_reason?: string;
    };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ContentError("Anthropic response was not valid JSON.");
    }

    const text = extractAnthropicText(data.content, req.structured?.name);
    if (!text) throw new ContentError("Empty response from Anthropic.");

    if (data.stop_reason === "max_tokens" && !req.structured) {
      // Truncated free-form JSON is almost always unparsable; surface a clear error
      // so the caller can regenerate with a smaller payload / higher cap.
      throw new ContentError(
        "AI response was cut off (token limit). Try fewer days per period or regenerate.",
      );
    }

    return text;
  },
};
