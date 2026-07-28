import { SubscriptionError } from "@/lib/providers/errors";

/**
 * Tier ids/order intentionally mirror the XP rank ladder in `lib/xp.ts`
 * (Recruit is level 1, Architect is the top rank) so pricing doubles as an
 * in-app callback rather than introducing a second, disconnected vocabulary.
 *
 * Live AI today is OpenRouter BYOK for every tier. Paid tiers reserve the
 * managed-AI + quota product for when checkout ships — `managedAi` stays
 * false so quotas are not enforced until that path is re-enabled.
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
  /** null = unlimited / not billed (BYOK). Numbers are planned quotas for managed AI. */
  planGenerationsPerPeriod: number | null;
  aiActionsPerPeriod: number | null;
  /** Paid checkout / managed AI not live yet. */
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
    managedAi: false,
    planGenerationsPerPeriod: null,
    aiActionsPerPeriod: null,
    comingSoon: false,
    tagline: "Bring your own OpenRouter key.",
    features: [
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
    managedAi: false,
    planGenerationsPerPeriod: 3,
    aiActionsPerPeriod: 150,
    comingSoon: true,
    tagline: "Coming soon — managed AI on us.",
    features: [
      "Everything in Recruit",
      "Planned: 3 managed plan generations / month",
      "Planned: 150 managed AI actions / month",
      "Planned: no OpenRouter key required for those quotas",
      "Checkout not connected yet",
      "Until then, use Recruit with your own key",
    ],
  },
  architect: {
    id: "architect",
    rankLabel: "Architect",
    priceMonthlyUsd: 12,
    priceLabel: "$12/mo",
    managedAi: false,
    planGenerationsPerPeriod: 5,
    aiActionsPerPeriod: 400,
    comingSoon: true,
    tagline: "Coming soon — more managed headroom.",
    features: [
      "Everything planned for Operator",
      "Planned: 5 managed plan generations / month",
      "Planned: 400 managed AI actions / month",
      "Planned: highest managed monthly allowance",
      "Checkout not connected yet",
      "Until then, use Recruit with your own key",
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
 * quota. Only meaningful when managed AI is live (`willUseManagedAi()`).
 * Throws a `SubscriptionError` with a user-facing message on rejection.
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
