import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  applySubscriptionState,
  getUserBilling,
  getUserByStripeCustomerId,
} from "@/lib/db/billing";
import { hasDatabase } from "@/lib/db/client";
import { getStripe, hasStripe, tierFromPriceId } from "@/lib/stripe";
import type { SubscriptionTier } from "@/lib/subscriptions";

export const runtime = "nodejs";

function customerIdOf(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if ("deleted" in value && value.deleted) return null;
  return value.id;
}

function tierFromSubscription(sub: Stripe.Subscription): SubscriptionTier {
  const metaTier = sub.metadata?.tier;
  if (metaTier === "operator" || metaTier === "architect") return metaTier;
  const priceId = sub.items.data[0]?.price?.id;
  return tierFromPriceId(priceId) || "free";
}

async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.userId) return sub.metadata.userId;
  const customerId = customerIdOf(sub.customer);
  if (!customerId) return null;
  const user = await getUserByStripeCustomerId(customerId);
  return user?.id || null;
}

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(sub);
  if (!userId) {
    console.error("[stripe webhook] no user for subscription", sub.id);
    return;
  }

  const status = sub.status;
  const active = status === "active" || status === "trialing";
  const tier = active ? tierFromSubscription(sub) : "free";
  const existing = await getUserBilling(userId);
  const tierChanged = existing?.subscriptionTier !== tier;

  await applySubscriptionState({
    userId,
    tier,
    status,
    stripeSubscriptionId: active ? sub.id : null,
    resetUsage: active && tierChanged && tier !== "free",
  });
}

export async function POST(req: NextRequest) {
  if (!hasDatabase() || !hasStripe()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 503 });
  }

  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        // Prefer metadata from the Checkout Session when Subscription metadata is empty.
        if (!sub.metadata?.userId && session.metadata?.userId) {
          sub.metadata = {
            ...sub.metadata,
            userId: session.metadata.userId,
            tier: session.metadata.tier || sub.metadata?.tier || "",
          };
        }
        await syncSubscription(sub);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        // Subscription status updates arrive via customer.subscription.* events.
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
