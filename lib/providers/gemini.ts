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

    const res = await fetchWithRetry(url, {
      method: "POST",
      signal: req.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cfg.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: req.maxTokens,
          temperature: req.temperature,
        },
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
