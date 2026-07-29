import { getProvider } from "@/lib/providers/index";
import { getCredentials } from "@/lib/providers/credentials";
import type { ChatRequest, StructuredSchema } from "@/lib/providers/types";
import {
  AuthError,
  ProviderError,
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
import type { ZodType } from "zod";

export type ChatKind = "plan" | "action";

/**
 * True when the next `chat()` call would use server-managed AI.
 * Refrainly is OpenRouter-only BYOK — managed Anthropic proxy is disabled.
 */
export function willUseManagedAi(): boolean {
  return false;
}

export {
  clearSessionPreferredModel,
} from "@/lib/providers/openrouter";

/**
 * Chat through OpenRouter using the key from Settings.
 * If the selected model is free (or fails), tries other free models, then
 * cheap paid models. Account-wide free daily caps skip remaining free models.
 */
export async function chat(
  req: Omit<ChatRequest, "prompt"> & { prompt: string; kind?: ChatKind },
): Promise<string> {
  const creds = getCredentials();
  const provider = getProvider("openrouter");

  if (!creds.apiKey?.trim()) {
    throw new AuthError("Add your OpenRouter API key in Settings.");
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
      maxTokens: Math.min(opts.maxTokens, 4000),
      temperature: 0,
      signal: opts.signal,
      kind: opts.kind,
      structured: opts.structured,
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
