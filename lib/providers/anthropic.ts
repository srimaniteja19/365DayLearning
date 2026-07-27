import type { ChatRequest, Provider, ProviderConfig } from "@/lib/providers/types";
import { ContentError, fetchWithRetry, mapHttpError } from "@/lib/providers/errors";

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
    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) {
      // Anthropic uses top-level system; keep user message as prompt only.
    }
    messages.push({ role: "user", content: req.prompt });

    const res = await fetchWithRetry(`${base}/v1/messages`, {
      method: "POST",
      signal: req.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        system: req.system || undefined,
        messages,
      }),
    });

    const raw = await res.text();
    if (!res.ok) throw mapHttpError(res.status, raw, res.headers.get("Retry-After"));

    let data: { content?: Array<{ type: string; text?: string }> };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ContentError("Anthropic response was not valid JSON.");
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) throw new ContentError("Empty response from Anthropic.");
    return text;
  },
};
