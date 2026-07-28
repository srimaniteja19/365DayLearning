import { getProvider } from "@/lib/providers/index";
import { getCredentials } from "@/lib/providers/credentials";
import type { ChatRequest } from "@/lib/providers/types";
import { AuthError, ProviderError, SubscriptionError } from "@/lib/providers/errors";

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
