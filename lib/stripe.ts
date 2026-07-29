import Stripe from "stripe";
import type { SubscriptionTier } from "@/lib/subscriptions";

let stripeSingleton: Stripe | null = null;

/** Server-only Stripe client. Throws if STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return stripeSingleton;
}

export function hasStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Map paid tiers → Stripe Price IDs from env. */
export function priceIdForTier(tier: SubscriptionTier): string | null {
  if (tier === "operator") return process.env.STRIPE_PRICE_OPERATOR?.trim() || null;
  if (tier === "architect") return process.env.STRIPE_PRICE_ARCHITECT?.trim() || null;
  return null;
}

export function tierFromPriceId(priceId: string | null | undefined): SubscriptionTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_OPERATOR) return "operator";
  if (priceId === process.env.STRIPE_PRICE_ARCHITECT) return "architect";
  return null;
}

/** Random 8-letter suffix for Checkout `integration_identifier`. */
export function checkoutIntegrationId(label: string): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${label}_${suffix}`;
}

export function appBaseUrl(reqUrl: string): string {
  const env = process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  try {
    return new URL(reqUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
}
