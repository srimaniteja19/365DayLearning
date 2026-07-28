import { getProvider } from "@/lib/providers/index";
import { getCredentials } from "@/lib/providers/credentials";
import type { ChatRequest, StructuredSchema } from "@/lib/providers/types";
import { AuthError, ProviderError, SubscriptionError } from "@/lib/providers/errors";
import type { ZodType } from "zod";

export type ChatKind = "plan" | "action";

/**
 * True when the next `chat()` call (with no BYOK key set) would route
 * through the server-managed `/api/claude` proxy rather than failing with
 * "add a key". Exported so `generatePlan()` can decide up front whether to
 * reserve plan-generation quota before making any of its many chat() calls.
 */
export function willUseManagedAi(): boolean {
  const creds = getCredentials();
  const provider = getProvider(creds.providerId);
  return provider.needsKey && !creds.apiKey?.trim() && provider.id === "anthropic";
}

/**
 * Chat through the active BYOK provider.
 * Falls back to the server `/api/claude` proxy only when Anthropic is
 * selected and no browser key is set — that proxy is either a simple
 * same-origin fallback (no accounts configured) or gated by subscription
 * tier + quota (accounts configured), depending on server setup.
 */
export async function chat(
  req: Omit<ChatRequest, "prompt"> & { prompt: string; kind?: ChatKind },
): Promise<string> {
  const creds = getCredentials();
  const provider = getProvider(creds.providerId);

  if (provider.needsKey && !creds.apiKey?.trim()) {
    if (provider.id === "anthropic") {
      return chatViaServerProxy(req, req.kind ?? "action");
    }
    throw new AuthError(`Add an API key for ${provider.label} in Settings.`);
  }

  return provider.chat(
    {
      system: req.system,
      prompt: req.prompt,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
      signal: req.signal,
      structured: req.structured,
    },
    {
      apiKey: creds.apiKey,
      model: creds.model || provider.models[0],
      baseUrl: creds.baseUrl || provider.defaultBaseUrl,
    },
  );
}

/** @deprecated Prefer `chat` — kept for call sites during migration. */
export async function callClaude(prompt: string, maxTokens?: number, signal?: AbortSignal): Promise<string> {
  return chat({ prompt, maxTokens: maxTokens ?? 1000, signal });
}

async function chatViaServerProxy(
  req: Omit<ChatRequest, "prompt"> & { prompt: string },
  kind: ChatKind = "action",
): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    signal: req.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: req.prompt,
      system: req.system,
      maxTokens: req.maxTokens ?? 1000,
      temperature: req.temperature,
      kind,
      structured: req.structured,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) {
    if (res.status === 401) throw new SubscriptionError(data.error, 401);
    if (res.status === 402 || res.status === 429) throw new SubscriptionError(data.error, res.status);
    if (res.status === 403) throw new AuthError(data.error);
    if (res.status === 503) {
      throw new AuthError(
        data.error || "No server Anthropic key. Add ANTHROPIC_API_KEY or paste a key in Settings.",
      );
    }
    throw new ProviderError(data.error || `Request failed (${res.status})`, "http", res.status);
  }
  if (!data.text?.trim()) throw new ProviderError("Empty response", "content");
  return data.text.trim();
}

export type ChatStructuredOpts<T> = {
  system?: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
  kind?: ChatKind;
  structured: StructuredSchema;
  schema: ZodType<T>;
  repairPrompt?: (error: string, bad: string) => string;
  parse: (
    raw: string,
    schema: ZodType<T>,
    repair: (error: string, raw: string) => Promise<string>,
  ) => Promise<T>;
};

/**
 * Prefer provider structured/tool output, then locally heal + schema-validate.
 * Retries the whole model call once if parsing still fails.
 */
export async function chatStructured<T>(opts: ChatStructuredOpts<T>): Promise<T> {
  const runOnce = async () => {
    const raw = await chat({
      system: opts.system,
      prompt: opts.prompt,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      signal: opts.signal,
      kind: opts.kind,
      structured: opts.structured,
    });
    return opts.parse(raw, opts.schema, async (error, bad) => {
      const repairPrompt =
        opts.repairPrompt?.(error, bad) ||
        `Fix this into valid JSON matching the required schema.
Parser error: ${error}
Broken input:
${bad.slice(0, 8000)}
Return corrected JSON only. No markdown.`;
      return chat({
        system: "You repair malformed JSON. Return only the corrected JSON object.",
        prompt: repairPrompt,
        maxTokens: opts.maxTokens,
        temperature: 0,
        signal: opts.signal,
        kind: opts.kind,
        structured: opts.structured,
      });
    });
  };

  try {
    return await runOnce();
  } catch (first) {
    try {
      return await runOnce();
    } catch {
      throw first;
    }
  }
}

export async function testConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  model: string;
  sample?: string;
  error?: string;
  errorCode?: string;
}> {
  const creds = getCredentials();
  const provider = getProvider(creds.providerId);
  const started = performance.now();
  try {
    const text = await chat({
      prompt: "Reply with exactly: ok",
      maxTokens: 5,
      temperature: 0,
    });
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - started),
      model: creds.model || provider.models[0],
      sample: text.slice(0, 80),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    const code = err instanceof ProviderError ? err.code : undefined;
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      model: creds.model || provider.models[0],
      error: message,
      errorCode: code,
    };
  }
}
