import { getProvider } from "@/lib/providers/index";
import { getCredentials } from "@/lib/providers/credentials";
import type { ChatRequest, StructuredSchema } from "@/lib/providers/types";
import {
  AuthError,
  ProviderError,
  SubscriptionError,
  formatAiError,
} from "@/lib/providers/errors";
import {
  buildModelFailoverChain,
  getSessionPreferredModel,
  isFailoverWorthyError,
  isFreeModelId,
  setSessionPreferredModel,
  shouldSkipRemainingFreeModels,
} from "@/lib/providers/openrouter";
import { getCachedSubscriptionTier, tierDef } from "@/lib/subscriptions";
import type { GenerationTelemetry } from "@/lib/generationTelemetry";
import type { ZodType } from "zod";

import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export type ChatKind = "plan" | "action";

/**
 * Use Vercel AI SDK generateObject with Zod schemas & OpenRouter provider.
 */
export async function generateObjectWithAiSdk<T>(opts: {
  schema: ZodType<T>;
  prompt: string;
  system?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const creds = getCredentials();
  const apiKey = creds.apiKey?.trim();
  const providerKey = apiKey || process.env.OPENROUTER_API_KEY;
  if (!providerKey) {
    throw new AuthError("OpenRouter API key missing in Settings or environment.");
  }
  const openrouter = createOpenRouter({ apiKey: providerKey });
  const modelId = opts.modelName || creds.model || "deepseek/deepseek-v4-flash";
  const { object } = await generateObject({
    model: openrouter(modelId),
    schema: opts.schema,
    prompt: opts.prompt,
    system: opts.system,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  });
  return object;
}

/**
 * True when the next `chat()` call would use server-managed AI
 * (signed-in tier, no OpenRouter key in Settings). BYOK always wins when present.
 */
export function willUseManagedAi(): boolean {
  const creds = getCredentials();
  if (creds.apiKey?.trim()) return false;
  return tierDef(getCachedSubscriptionTier()).managedAi;
}

export {
  clearSessionPreferredModel,
} from "@/lib/providers/openrouter";

async function chatManaged(
  req: Omit<ChatRequest, "prompt"> & { prompt: string; kind?: ChatKind },
): Promise<string> {
  const timeoutSignal = AbortSignal.timeout(35_000);
  const signal = req.signal ? AbortSignal.any([req.signal, timeoutSignal]) : timeoutSignal;

  let res: Response;
  try {
    res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        prompt: req.prompt,
        system: req.system,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        kind: req.kind || "action",
        structured: req.structured || undefined,
      }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (req.signal?.aborted) throw err;
      throw new ProviderError("The AI request timed out after 35 seconds. Click Resume or try again.", "http", 504);
    }
    throw err;
  }

  const data = (await res.json().catch(() => null)) as {
    text?: string;
    error?: string;
  } | null;
  if (!res.ok) {
    const message = data?.error || `Managed AI request failed (${res.status}).`;
    if (res.status === 401 || res.status === 402 || res.status === 429) {
      throw new SubscriptionError(message, res.status);
    }
    throw new ProviderError(message, "http");
  }
  if (!data?.text?.trim()) {
    throw new ProviderError("Empty response from managed AI.", "http");
  }
  return data.text;
}

/**
 * Chat through OpenRouter — BYOK key from Settings, or the server-managed
 * OpenRouter proxy (`/api/ai`) when no key is set.
 * BYOK failover: free models → cheap paid models when the primary fails.
 */
export async function chat(
  req: Omit<ChatRequest, "prompt"> & { prompt: string; kind?: ChatKind; telemetry?: GenerationTelemetry },
): Promise<string> {
  if (willUseManagedAi()) {
    return chatManaged(req);
  }

  const creds = getCredentials();
  const provider = getProvider("openrouter");

  if (!creds.apiKey?.trim()) {
    throw new AuthError(
      "Add your OpenRouter API key in Settings, or use your managed AI allowance.",
    );
  }

  const primary = creds.model || provider.models[0];
  const chain = buildModelFailoverChain(primary, {
    sessionPreferred: getSessionPreferredModel(),
  });

  let lastError: unknown;
  let skipFree = false;

  for (const model of chain) {
    if (skipFree && isFreeModelId(model)) continue;
    if (req.signal?.aborted) {
      throw req.signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    if (req.telemetry) {
      const outcome = req.telemetry.modelOutcomes[model] ?? { attempts: 0, failures: 0 };
      outcome.attempts += 1;
      req.telemetry.modelOutcomes[model] = outcome;
    }

    try {
      const text = await provider.chat(
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
          model,
          baseUrl: creds.baseUrl || provider.defaultBaseUrl,
        },
      );
      if (model !== primary) {
        setSessionPreferredModel(model);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (err instanceof AuthError) throw err;
      if (!isFailoverWorthyError(err)) throw err;

      if (req.telemetry) {
        const outcome = req.telemetry.modelOutcomes[model];
        if (outcome) outcome.failures += 1;
      }

      if (shouldSkipRemainingFreeModels(err)) {
        skipFree = true;
      }
    }
  }

  if (lastError instanceof ProviderError) throw lastError;
  if (lastError instanceof Error) {
    throw new ProviderError(formatAiError(lastError), "http");
  }
  throw new ProviderError("All OpenRouter model fallbacks failed.", "http");
}

/** @deprecated Prefer `chat` — kept for call sites during migration. */
export async function callClaude(prompt: string, maxTokens?: number, signal?: AbortSignal): Promise<string> {
  return chat({ prompt, maxTokens: maxTokens ?? 1000, signal });
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
  telemetry?: GenerationTelemetry;
};

/**
 * Prefer provider structured/tool output, then locally heal + schema-validate.
 * Repair is a single follow-up chat when local healing fails — no full re-roll
 * (plan generation already issues many calls; doubling them makes it crawl).
 */
export async function chatStructured<T>(opts: ChatStructuredOpts<T>): Promise<T> {
  const raw = await chat({
    system: opts.system,
    prompt: opts.prompt,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    signal: opts.signal,
    kind: opts.kind,
    structured: opts.structured,
    telemetry: opts.telemetry,
  });
  return opts.parse(raw, opts.schema, async (error, bad) => {
    if (opts.telemetry) opts.telemetry.repairCalls += 1;
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
      maxTokens: Math.min(opts.maxTokens, 4000),
      temperature: 0,
      signal: opts.signal,
      kind: opts.kind,
      structured: opts.structured,
      telemetry: opts.telemetry,
    });
  });
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
  const provider = getProvider("openrouter");
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
      model: getSessionPreferredModel() || creds.model || provider.models[0],
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
