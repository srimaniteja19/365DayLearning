import type { ChatRequest, Provider, ProviderConfig } from "@/lib/providers/types";
import { ContentError, fetchWithRetry, mapHttpError } from "@/lib/providers/errors";

export const ollamaProvider: Provider = {
  id: "ollama",
  label: "Ollama (local)",
  models: ["llama3.2", "qwen2.5", "mistral", "phi4"],
  needsKey: false,
  keyHint: "(no key required)",
  docsUrl: "https://ollama.com/",
  defaultBaseUrl: "http://localhost:11434",

  async chat(req: ChatRequest, cfg: ProviderConfig): Promise<string> {
    const base = (cfg.baseUrl || this.defaultBaseUrl!).replace(/\/$/, "");
    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    messages.push({ role: "user", content: req.prompt });

    const res = await fetchWithRetry(`${base}/api/chat`, {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        options: {
          num_predict: req.maxTokens,
          temperature: req.temperature,
        },
        messages,
      }),
    });

    const raw = await res.text();
    if (!res.ok) throw mapHttpError(res.status, raw, res.headers.get("Retry-After"));

    let data: { message?: { content?: string } };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ContentError("Ollama response was not valid JSON.");
    }

    const text = (data.message?.content || "").trim();
    if (!text) throw new ContentError("Empty response from Ollama.");
    return text;
  },
};
