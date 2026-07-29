import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { getUserBilling } from "@/lib/db/billing";
import { appBaseUrl, getStripe, hasStripe } from "@/lib/stripe";

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

/** Opens the Stripe Customer Portal for invoice history, payment method, cancel. */
export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts are not configured on this server." }, { status: 503 });
  }
  if (!hasStripe()) {
    return NextResponse.json({ error: "Payments are not configured on this server." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const user = await getUserBilling(userId);
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet. Upgrade to a paid plan first." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appBaseUrl(req.url)}/?billing=portal`,
  });

  return NextResponse.json({ url: portal.url });
}
