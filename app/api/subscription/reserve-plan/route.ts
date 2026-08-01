import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { reservePlanGenerationQuota } from "@/lib/db/subscriptionQuota";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";

/**
 * Reserves one AI-generated-plan unit against the caller's managed quota.
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

  let body: { totalDays?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const totalDays = body.totalDays;
  if (typeof totalDays !== "number" || !Number.isInteger(totalDays) || totalDays < 1 || totalDays > 730) {
    return NextResponse.json({ error: "totalDays must be an integer between 1 and 730." }, { status: 400 });
  }

  try {
    const result = await reservePlanGenerationQuota(userId, totalDays);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/subscription/reserve-plan", "failed", err);
    return NextResponse.json({ error: "Could not reserve plan-generation quota." }, { status: 500 });
  }
}
