import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { reservePlanGenerationQuota } from "@/lib/db/subscriptionQuota";

/**
 * Session cookies ride along on cross-site requests, so state-changing
 * requests need an explicit same-origin check (mirrors app/api/state).
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

/**
 * Reserves one AI-generated-plan unit against the caller's monthly quota.
 * Called once per fresh plan-builder generation run (see
 * lib/planGeneration.ts) before any of the underlying chat() calls fire —
 * those calls don't individually re-check this quota.
 */
export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts are not configured on this server." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required for managed AI." }, { status: 401 });
  }

  try {
    const result = await reservePlanGenerationQuota(userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/subscription/reserve-plan] failed", err);
    return NextResponse.json({ error: "Could not reserve plan-generation quota." }, { status: 500 });
  }
}
