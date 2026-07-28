import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { requireManagedAiTier, reserveAiActionQuota } from "@/lib/db/subscriptionQuota";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_PROMPT_CHARS = 40_000;
const MAX_TOKENS_CAP = 4096;
const UPSTREAM_TIMEOUT_MS = 60_000;

// Sliding-window rate limit, per IP. In-memory: resets on redeploy and is
// per-instance, which is acceptable for this app's single-region scale.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const rateBuckets = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (rateBuckets.get(ip) || []).filter((t) => t > cutoff);
  if (hits.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateBuckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (rateBuckets.size > 10_000) {
    for (const [key, times] of rateBuckets) {
      if (!times.some((t) => t > cutoff)) rateBuckets.delete(key);
    }
  }
  return false;
}

/**
 * Browsers always send an Origin header on cross-site and same-site fetch
 * POSTs. Requiring a same-origin Origin blocks other websites and plain
 * curl/script abuse of the server-side API key.
 */
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type ClaudeRequestBody = {
  prompt?: unknown;
  maxTokens?: unknown;
  /** "plan" = one of the many calls inside a single plan-builder generation
   *  (quota already reserved once via /api/subscription/reserve-plan);
   *  anything else = a standalone AI action (quiz, notes, LinkedIn draft,
   *  journal insight, daily briefing) checked/incremented right here. */
  kind?: unknown;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: ClaudeRequestBody;
  try {
    body = (await req.json()) as ClaudeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: "prompt is too long." }, { status: 400 });
  }

  const requested =
    typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens)
      ? Math.floor(body.maxTokens)
      : 1000;
  const maxTokens = Math.min(Math.max(requested, 64), MAX_TOKENS_CAP);
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  // This route doubles as: (a) a simple same-origin+IP-rate-limited fallback
  // for self-hosted setups with no accounts configured at all, and (b) the
  // managed-AI path for paid subscribers once accounts *are* configured. Only
  // gate on subscription state in case (b) — case (a) keeps working exactly
  // as before so a bare ANTHROPIC_API_KEY deploy doesn't need the whole
  // accounts/billing stack.
  if (hasDatabase()) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Sign in required for managed AI. Add your own API key instead, or sign in and upgrade." },
        { status: 401 },
      );
    }
    const kind = body.kind === "plan" ? "plan" : "action";
    const result =
      kind === "plan" ? await requireManagedAiTier(userId) : await reserveAiActionQuota(userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      // Log detail server-side; return only a generic message to the client.
      console.error(
        `[api/claude] upstream ${res.status}: ${data.error?.message || "(no message)"}`,
      );
      const generic =
        res.status === 429
          ? "The AI service is rate limited right now. Try again shortly."
          : res.status === 401 || res.status === 403
            ? "The server's AI credentials were rejected."
            : "The AI request failed. Try again shortly.";
      return NextResponse.json(
        { error: generic },
        { status: res.status === 429 ? 429 : 502 },
      );
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Empty response from model." }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    console.error(`[api/claude] ${timedOut ? "upstream timeout" : "upstream error"}`, err);
    return NextResponse.json(
      { error: timedOut ? "The AI request timed out." : "Upstream request failed." },
      { status: timedOut ? 504 : 502 },
    );
  }
}
