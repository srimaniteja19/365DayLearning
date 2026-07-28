export class ProviderError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
  }
}

export class AuthError extends ProviderError {
  constructor(message = "API key is invalid or lacks permission.", status = 401) {
    super(message, "auth", status);
    this.name = "AuthError";
  }
}

export class RateLimitError extends ProviderError {
  readonly retryAfterMs?: number;

  constructor(message = "Rate limited. Try again shortly.", retryAfterMs?: number, status = 429) {
    super(message, "rate_limit", status);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class QuotaError extends ProviderError {
  constructor(message = "Out of credit or quota for this key.", status = 402) {
    super(message, "quota", status);
    this.name = "QuotaError";
  }
}

export class NetworkError extends ProviderError {
  constructor(
    message = "Network or CORS failure. This provider may block browser calls — try OpenRouter or a local proxy.",
  ) {
    super(message, "network");
    this.name = "NetworkError";
  }
}

export class ContentError extends ProviderError {
  constructor(message = "The model returned something unparseable.") {
    super(message, "content");
    this.name = "ContentError";
  }
}

/** Raised when a managed-AI (no-BYOK-key) request is blocked by sign-in state or subscription quota. */
export class SubscriptionError extends ProviderError {
  constructor(message = "Add your OpenRouter key in Settings. Managed AI upgrades are coming soon.", status = 402) {
    super(message, "subscription", status);
    this.name = "SubscriptionError";
  }
}

type ParsedProviderBody = {
  message: string;
  resetUnix?: number;
};

/** Pull a human message out of plain text or OpenRouter-style JSON error bodies. */
export function extractProviderErrorMessage(bodyText: string): ParsedProviderBody {
  const trimmed = bodyText.trim();
  if (!trimmed) return { message: "" };

  try {
    const json = JSON.parse(trimmed) as {
      error?: {
        message?: string;
        metadata?: { headers?: Record<string, string> };
      };
      message?: string;
    };
    const message = (json.error?.message || json.message || "").trim();
    const resetRaw = json.error?.metadata?.headers?.["X-RateLimit-Reset"];
    const resetUnix = resetRaw ? Number(resetRaw) : undefined;
    return {
      message: message || trimmed.slice(0, 280),
      resetUnix: Number.isFinite(resetUnix) ? resetUnix : undefined,
    };
  } catch {
    return { message: trimmed.slice(0, 280) };
  }
}

/** Friendlier copy for common OpenRouter limit cases. */
export function humanizeProviderMessage(raw: string): string {
  const msg = raw.trim();
  if (!msg) return "";

  if (/free-models-per-day|free model requests per day/i.test(msg)) {
    return (
      "OpenRouter free-model daily limit reached (usually 50/day). " +
      "Switch to a Paid model in Settings, or add credits at openrouter.ai/settings/credits " +
      "to raise free-model limits."
    );
  }
  if (/free-models-per-min|requests per minute/i.test(msg)) {
    return "OpenRouter rate limit hit. Wait a minute, or switch to a Paid model in Settings.";
  }
  if (/Add \d+ credits/i.test(msg) && /rate limit/i.test(msg)) {
    return `${msg} Or pick a Paid model in Settings.`;
  }
  return msg;
}

export function mapHttpError(status: number, bodyText: string, retryAfterHeader?: string | null): ProviderError {
  const parsed = extractProviderErrorMessage(bodyText);
  const message = humanizeProviderMessage(parsed.message) || parsed.message;

  if (status === 401 || status === 403) {
    return new AuthError(message || undefined, status);
  }
  if (status === 429) {
    let retryAfterMs = parseRetryAfter(retryAfterHeader);
    if (retryAfterMs == null && parsed.resetUnix) {
      // OpenRouter often sends unix seconds in X-RateLimit-Reset metadata.
      const ms = parsed.resetUnix > 1e12 ? parsed.resetUnix : parsed.resetUnix * 1000;
      retryAfterMs = Math.max(0, ms - Date.now());
    }
    return new RateLimitError(message || undefined, retryAfterMs, status);
  }
  if (
    status === 402 ||
    /quota|billing|insufficient.?credit|payment|add \d+ credits/i.test(message || parsed.message)
  ) {
    return new QuotaError(message || undefined, status === 402 ? 402 : status);
  }
  return new ProviderError(message || `Request failed (${status})`, "http", status);
}

/** Shared client-facing AI error text. */
export function formatAiError(err: unknown): string {
  if (err instanceof ProviderError) {
    if (err.code === "auth") return `${err.message} Open Settings to fix your key.`;
    if (err.code === "rate_limit") {
      if (/free-model|openrouter\.ai\/settings\/credits|Paid model/i.test(err.message)) {
        return err.message;
      }
      return `${err.message} Wait a moment and retry.`;
    }
    if (err.code === "quota") return `${err.message} Check OpenRouter billing/credits.`;
    if (err.code === "network") return err.message;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

function parseRetryAfter(header?: string | null): number | undefined {
  if (!header) return undefined;
  const asNum = Number(header);
  if (Number.isFinite(asNum)) return asNum * 1000;
  const when = Date.parse(header);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return undefined;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  opts?: { retries?: number },
): Promise<Response> {
  const retries = opts?.retries ?? 1;
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(input, init);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new NetworkError(
        err instanceof Error
          ? `${err.message}. This provider may block browser calls — try OpenRouter or a local proxy.`
          : undefined,
      );
    }

    // Don't burn retries on free-model daily caps — they won't clear in seconds.
    if (res.status === 429 && attempt < retries) {
      let peek = "";
      try {
        peek = typeof res.clone === "function" ? await res.clone().text() : "";
      } catch {
        peek = "";
      }
      if (/free-models-per-day/i.test(peek)) return res;
      const retryAfter = parseRetryAfter(res.headers.get("Retry-After")) ?? 800 * (attempt + 1);
      attempt += 1;
      await sleep(retryAfter, init.signal ?? undefined);
      continue;
    }

    return res;
  }
}
