import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "@/lib/subscriptions";

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
 * Checkout is not wired up yet — no Stripe (or other processor) is
 * configured, so this intentionally always returns 501. It exists now so
 * the client contract (POST { tier }) is stable, and so wiring up real
 * checkout later is a matter of replacing the body of this handler with a
 * Checkout Session redirect/client secret, then updating the user's
 * subscriptionTier from a payment webhook once payment succeeds — not a
 * client-facing API change.
 */
export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts are not configured on this server." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required to upgrade." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const tier = (body as { tier?: unknown })?.tier;
  if (typeof tier !== "string" || !SUBSCRIPTION_TIERS[tier as SubscriptionTier]) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  return NextResponse.json(
    { error: "Checkout isn't connected yet — payments are coming soon." },
    { status: 501 },
  );
}
