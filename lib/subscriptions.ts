import { SubscriptionError } from "@/lib/providers/errors";

/**
 * Tier ids/order intentionally mirror the XP rank ladder in `lib/xp.ts`
 * (Recruit is level 1, Architect is the top rank) so pricing doubles as an
 * in-app callback rather than introducing a second, disconnected vocabulary.
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
  /** null = not applicable (BYOK plan generation on Free is always unlimited). */
  planGenerationsPerPeriod: number | null;
  aiActionsPerPeriod: number | null;
  tagline: string;
  features: string[];
};

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierDefinition> = {
  free: {
    id: "free",
    rankLabel: "Recruit",
    priceMonthlyUsd: 0,
    priceLabel: "Free",
    managedAi: false,
    planGenerationsPerPeriod: null,
    aiActionsPerPeriod: null,
    tagline: "Bring your own OpenRouter key.",
    features: [
      "Unlimited custom plans on your own API key",
      "Unlimited quiz, notes, LinkedIn drafts & journal insights on your key",
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
    tagline: "Managed AI — no key required.",
    features: [
      "Everything in Recruit",
      "3 AI-generated custom plans / month",
      "150 AI actions / month (quiz, notes, drafts, insights, briefings)",
      "Managed AI — no API key needed",
      "Daily briefing & on-this-day memories",
      "BYOK still available anytime",
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
    tagline: "More plans, more headroom.",
    features: [
      "Everything in Operator",
      "5 AI-generated custom plans / month",
      "400 AI actions / month",
      "Managed AI — no API key needed",
      "Highest monthly headroom for active campaigns",
      "BYOK still available anytime",
    ],
  },
};

/**
 * Usage resets on a rolling ~30-day window from `usagePeriodStart` rather
 * than the calendar month, so the server never has to reason about "which
 * month"/timezones — it just checks elapsed time. Good enough ahead of real
 * Stripe billing-cycle anchoring.
 */
export const USAGE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

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
  planGenerationsUsed: number;
  planGenerationsLimit: number | null;
  aiActionsUsed: number;
  aiActionsLimit: number | null;
  periodResetAt: string;
};

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
    return { ok: true, usage: data as SubscriptionUsage };
  } catch {
    return { ok: false, error: "Network error while loading subscription status." };
  }
}

/**
 * Reserves one AI-generated plan against the signed-in user's monthly
 * quota. Called once per fresh `generatePlan()` run (not on resume) — the
 * many individual chat() calls inside a single generation don't each count
 * separately. Throws a `SubscriptionError` with a user-facing message on
 * rejection (no session, free tier, or quota exhausted).
 */
export async function reservePlanGeneration(signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/subscription/reserve-plan", { method: "POST", signal });
  } catch {
    throw new SubscriptionError("Network error while checking your plan quota.");
  }
  if (res.ok) return;
  const data = await res.json().catch(() => ({}) as { error?: string });
  throw new SubscriptionError(data.error || "Could not reserve plan-generation quota.");
}

/** Placeholder until Stripe Checkout is wired up — see app/api/subscription/upgrade/route.ts. */
export async function requestUpgrade(
  tier: SubscriptionTier,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/subscription/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json().catch(() => ({}) as { error?: string });
    if (!res.ok) return { ok: false, error: data.error || "Upgrades aren't available yet." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error." };
  }
}
