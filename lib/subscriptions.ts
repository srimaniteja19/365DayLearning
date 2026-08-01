import { SubscriptionError } from "@/lib/providers/errors";

/**
 * Tier ids/order intentionally mirror the XP rank ladder in `lib/xp.ts`
 * (Recruit is level 1, Architect is the top rank) so pricing doubles as an
 * in-app callback rather than introducing a second, disconnected vocabulary.
 *
 * Paid tiers use Stripe Checkout + webhooks. Managed AI (server OpenRouter
 * proxy) is available to every signed-in tier. Recruit receives a small,
 * one-time managed allowance; BYOK remains available at every tier.
 */
export type SubscriptionTier = "free" | "operator" | "architect";

export const TIER_ORDER: SubscriptionTier[] = ["free", "operator", "architect"];

export type TierDefinition = {
  id: SubscriptionTier;
  rankLabel: string;
  priceMonthlyUsd: number;
  priceLabel: string;
  /** Whether this tier can use server-managed AI without supplying an API key. */
  managedAi: boolean;
  /** Numbers are quotas for server-managed AI; BYOK is always unlimited. */
  planGenerationsPerPeriod: number | null;
  aiActionsPerPeriod: number | null;
  /** Maximum days for a managed plan generation; null means no length gate. */
  maxDaysManaged: number | null;
  /** Recruit allowances never reset; paid allowances use the rolling period. */
  managedAllowanceWindow: "lifetime" | "rolling";
  /** When true, UI shows Coming soon and checkout is blocked. */
  comingSoon: boolean;
  tagline: string;
  features: string[];
};

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierDefinition> = {
  free: {
    id: "free",
    rankLabel: "Recruit",
    priceMonthlyUsd: 0,
    priceLabel: "Free",
    managedAi: true,
    planGenerationsPerPeriod: 1,
    aiActionsPerPeriod: 10,
    maxDaysManaged: 90,
    managedAllowanceWindow: "lifetime",
    comingSoon: false,
    tagline: "Try managed AI once — or bring your own key anytime.",
    features: [
      "1 managed plan generation (up to 90 days), lifetime",
      "10 managed AI actions, lifetime",
      "Unlimited custom plans on your OpenRouter key",
      "Unlimited quiz, notes, LinkedIn drafts & journal insights",
      "Example campaigns, multi-plan switcher, XP & streaks",
      "Spaced repetition, badges, themes & type voices",
      "Accounts + cloud sync across devices",
      "Export, import & plan sharing",
    ],
  },
  operator: {
    id: "operator",
    rankLabel: "Operator",
    priceMonthlyUsd: 7,
    priceLabel: "$7/mo",
    managedAi: true,
    planGenerationsPerPeriod: 3,
    aiActionsPerPeriod: 150,
    maxDaysManaged: null,
    managedAllowanceWindow: "rolling",
    comingSoon: false,
    tagline: "Managed AI on us — light monthly quota.",
    features: [
      "Everything in Recruit",
      "3 managed plan generations / month",
      "150 managed AI actions / month",
      "No OpenRouter key required for those quotas",
      "BYOK remains available anytime",
      "Invoices & self-serve billing portal",
    ],
  },
  architect: {
    id: "architect",
    rankLabel: "Architect",
    priceMonthlyUsd: 12,
    priceLabel: "$12/mo",
    managedAi: true,
    planGenerationsPerPeriod: 5,
    aiActionsPerPeriod: 400,
    maxDaysManaged: null,
    managedAllowanceWindow: "rolling",
    comingSoon: false,
    tagline: "More managed AI headroom.",
    features: [
      "Everything in Operator",
      "5 managed plan generations / month",
      "400 managed AI actions / month",
      "Highest managed monthly allowance",
      "BYOK remains available anytime",
      "Invoices & self-serve billing portal",
    ],
  },
};

/**
 * Usage resets on a rolling ~30-day window from `usagePeriodStart` rather
 * than the calendar month, so the server never has to reason about "which
 * month"/timezones — it just checks elapsed time. Stripe billing cycle
 * still drives renewals; this window gates managed-AI quotas in-app.
 */
export const USAGE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Client-side cache of the signed-in user's tier (hydrated from /api/subscription). */
let cachedTier: SubscriptionTier | null = null;

export function getCachedSubscriptionTier(): SubscriptionTier | null {
  return cachedTier;
}

export function setCachedSubscriptionTier(tier: SubscriptionTier | null): void {
  cachedTier = tier;
}

export function isPeriodExpired(periodStart: string | number | Date): boolean {
  const t = new Date(periodStart).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t >= USAGE_PERIOD_MS;
}

export function periodResetsAt(periodStart: string | number | Date): Date {
  const t = new Date(periodStart).getTime();
  return new Date((Number.isNaN(t) ? Date.now() : t) + USAGE_PERIOD_MS);
}

export function tierDef(tier: string | null | undefined): TierDefinition {
  return SUBSCRIPTION_TIERS[tier as SubscriptionTier] || SUBSCRIPTION_TIERS.free;
}

export type SubscriptionUsage = {
  tier: SubscriptionTier;
  /** Stripe subscription status (`active`, `past_due`, `canceled`, …). */
  status: string;
  /** True when a Stripe customer exists — portal stays available even if demoted. */
  hasBillingAccount: boolean;
  planGenerationsUsed: number;
  planGenerationsLimit: number | null;
  aiActionsUsed: number;
  aiActionsLimit: number | null;
  /** Whether displayed managed usage is lifetime rather than rolling. */
  managedAllowanceWindow: "lifetime" | "rolling";
  /** Null for lifetime allowances. */
  periodResetAt: string | null;
};

/** Statuses that mean the account already has a live Stripe subscription. */
export function hasLiveStripeSubscription(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/** Fetch the signed-in user's current tier + usage from the server. */
export async function fetchSubscriptionStatus(): Promise<
  { ok: true; usage: SubscriptionUsage } | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/subscription", { method: "GET" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: (data && data.error) || `Request failed (${res.status})` };
    }
    const usage = data as SubscriptionUsage;
    setCachedSubscriptionTier(usage.tier);
    return { ok: true, usage };
  } catch {
    return { ok: false, error: "Network error while loading subscription status." };
  }
}

/**
 * Reserves one AI-generated plan against the signed-in user's monthly
 * quota. Only meaningful when managed AI is live (`willUseManagedAi()`).
 * Throws a `SubscriptionError` with a user-facing message on rejection.
 */
export async function reservePlanGeneration(totalDays: number, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/subscription/reserve-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalDays }),
      signal,
    });
  } catch {
    throw new SubscriptionError("Network error while checking your plan quota.");
  }
  if (res.ok) return;
  const data = await res.json().catch(() => ({}) as { error?: string });
  throw new SubscriptionError(data.error || "Could not reserve plan-generation quota.");
}

/**
 * Starts Stripe Checkout for a paid tier. On success returns `{ ok, url }`
 * for a full-page redirect.
 */
export async function requestUpgrade(
  tier: SubscriptionTier,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch("/api/subscription/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json().catch(() => ({}) as { error?: string; url?: string });
    if (!res.ok) return { ok: false, error: data.error || "Could not start checkout." };
    if (!data.url) return { ok: false, error: "Checkout URL missing." };
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

/** Opens the Stripe Customer Portal (invoices, payment method, cancel). */
export async function openBillingPortal(): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch("/api/subscription/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}) as { error?: string; url?: string });
    if (!res.ok) return { ok: false, error: data.error || "Could not open billing portal." };
    if (!data.url) return { ok: false, error: "Portal URL missing." };
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "Network error." };
  }
}
