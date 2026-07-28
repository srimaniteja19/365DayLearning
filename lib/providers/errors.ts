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

export function mapHttpError(status: number, bodyText: string, retryAfterHeader?: string | null): ProviderError {
  const snippet = bodyText.slice(0, 240).trim();
  if (status === 401 || status === 403) {
    return new AuthError(snippet || undefined, status);
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(retryAfterHeader);
    return new RateLimitError(snippet || undefined, retryAfterMs, status);
  }
  if (status === 402 || /quota|billing|insufficient.?credit|payment/i.test(snippet)) {
    return new QuotaError(snippet || undefined, status === 402 ? 402 : status);
  }
  return new ProviderError(snippet || `Request failed (${status})`, "http", status);
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

    if (res.status !== 429 || attempt >= retries) return res;

    const retryAfter = parseRetryAfter(res.headers.get("Retry-After")) ?? 800 * (attempt + 1);
    attempt += 1;
    await sleep(retryAfter, init.signal ?? undefined);
  }
}
