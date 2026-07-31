import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { requireManagedAiTier, reserveAiActionQuota } from "@/lib/db/subscriptionQuota";
import { clientIp, isRateLimited, isSameOrigin } from "@/lib/httpGuard";
import { OPENROUTER_DEFAULT_MODEL } from "@/lib/providers/openrouter";
import { openAiCompatibleChat } from "@/lib/providers/openaiCompat";
import type { ChatRequest } from "@/lib/providers/types";

const MAX_PROMPT_CHARS = 40_000;
const MAX_TOKENS_CAP = 4096;
/** Plan generation periods can be large (monthly × 4 topics); allow more headroom. */
const MAX_TOKENS_CAP_PLAN = 8192;
const MAX_SYSTEM_CHARS = 8_000;
const UPSTREAM_TIMEOUT_MS = 90_000;
const OPENROUTER_BASE = "https://openrouter.ai/api";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;

type AiRequestBody = {
  prompt?: unknown;
  system?: unknown;
  maxTokens?: unknown;
  temperature?: unknown;
  /** "plan" = already reserved via /api/subscription/reserve-plan; else an AI action. */
  kind?: unknown;
  structured?: unknown;
};

function readStructured(
  value: unknown,
): { name: string; description?: string; schema: Record<string, unknown> } | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name.trim()) return null;
  if (!obj.schema || typeof obj.schema !== "object") return null;
  return {
    name: obj.name.trim().slice(0, 64),
    description:
      typeof obj.description === "string" ? obj.description.slice(0, 500) : undefined,
    schema: obj.schema as Record<string, unknown>,
  };
}

/**
 * Managed AI for Operator / Architect: proxies to OpenRouter with the
 * server `OPENROUTER_API_KEY`, gated by subscription quotas.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not configured on this server." },
      { status: 503 },
    );
  }

  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  }

  if (await isRateLimited(`ai:${clientIp(req)}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: AiRequestBody;
  try {
    body = (await req.json()) as AiRequestBody;
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

  const kind = body.kind === "plan" ? "plan" : "action";
  const system =
    typeof body.system === "string" && body.system.trim()
      ? body.system.trim().slice(0, MAX_SYSTEM_CHARS)
      : undefined;
  const temperature =
    typeof body.temperature === "number" && Number.isFinite(body.temperature)
      ? Math.min(1, Math.max(0, body.temperature))
      : undefined;

  const tokenCap = kind === "plan" ? MAX_TOKENS_CAP_PLAN : MAX_TOKENS_CAP;
  const requested =
    typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens)
      ? Math.floor(body.maxTokens)
      : 1000;
  const maxTokens = Math.min(Math.max(requested, 64), tokenCap);
  const model = process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL;
  const structured = readStructured(body.structured);

  if (hasDatabase()) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Sign in required for managed AI. Add your own OpenRouter key instead, or sign in and upgrade.",
        },
        { status: 401 },
      );
    }
    const result =
      kind === "plan" ? await requireManagedAiTier(userId) : await reserveAiActionQuota(userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
  }

  const chatReq: ChatRequest = {
    prompt,
    system,
    maxTokens,
    temperature,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    structured: structured || undefined,
  };

  try {
    const text = await openAiCompatibleChat(
      `${OPENROUTER_BASE}/v1/chat/completions`,
      chatReq,
      { apiKey, model, baseUrl: OPENROUTER_BASE },
      {
        "HTTP-Referer": process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://refrainly.dev",
        "X-Title": "Refrainly",
      },
      { preferJsonSchema: false },
    );
    return NextResponse.json({ text });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    const status =
      err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : undefined;
    console.error(`[api/ai] ${timedOut ? "upstream timeout" : "upstream error"}`, err);
    if (timedOut) {
      return NextResponse.json({ error: "The AI request timed out." }, { status: 504 });
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "The AI service is rate limited right now. Try again shortly." },
        { status: 429 },
      );
    }
    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "The server's OpenRouter credentials were rejected." },
        { status: 502 },
      );
    }
    const message =
      err instanceof Error && err.message ? err.message : "Upstream request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
