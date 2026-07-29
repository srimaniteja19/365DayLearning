import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import {
  getUserBilling,
  setStripeCustomerId,
} from "@/lib/db/billing";
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "@/lib/subscriptions";
import {
  appBaseUrl,
  checkoutIntegrationId,
  getStripe,
  hasStripe,
  priceIdForTier,
} from "@/lib/stripe";

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
 * Creates a Stripe Checkout Session (subscription mode) for Operator / Architect
 * and returns `{ url }` for the client to redirect to.
 */
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
    return NextResponse.json({ error: "Sign in required to upgrade." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const tier = (body as { tier?: unknown })?.tier;
  if (typeof tier !== "string" || (tier !== "operator" && tier !== "architect")) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  if (SUBSCRIPTION_TIERS[tier as SubscriptionTier].comingSoon) {
    return NextResponse.json({ error: "That plan isn't available yet." }, { status: 400 });
  }

  const priceId = priceIdForTier(tier as SubscriptionTier);
  if (!priceId) {
    return NextResponse.json(
      { error: "Price is not configured for that plan. Set STRIPE_PRICE_OPERATOR / STRIPE_PRICE_ARCHITECT." },
      { status: 503 },
    );
  }

  const user = await getUserBilling(userId);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (user.subscriptionTier === tier && user.subscriptionStatus === "active") {
    return NextResponse.json({ error: "You're already on that plan." }, { status: 400 });
  }

  const stripe = getStripe();
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await setStripeCustomerId(userId, customerId);
  }

  const base = appBaseUrl(req.url);
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?billing=cancelled`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    // Invoices are created automatically for subscription mode.
    subscription_data: {
      metadata: { userId, tier },
    },
    metadata: { userId, tier },
    integration_identifier: checkoutIntegrationId(`refrainly_${tier}`),
  });

  if (!checkout.url) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }

  return NextResponse.json({ url: checkout.url });
}
