import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import {
  isPeriodExpired,
  periodResetsAt,
  tierDef,
  type SubscriptionUsage,
} from "@/lib/subscriptions";

type UsageRow = {
  subscriptionTier: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  planGenerationsUsed: number;
  aiActionsUsed: number;
  usagePeriodStart: Date;
};

async function loadUsageRow(userId: string): Promise<UsageRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      subscriptionTier: users.subscriptionTier,
      subscriptionStatus: users.subscriptionStatus,
      stripeCustomerId: users.stripeCustomerId,
      planGenerationsUsed: users.planGenerationsUsed,
      aiActionsUsed: users.aiActionsUsed,
      usagePeriodStart: users.usagePeriodStart,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row || null;
}

function toSubscriptionUsage(row: UsageRow): SubscriptionUsage {
  const tier = tierDef(row.subscriptionTier);
  const expired = isPeriodExpired(row.usagePeriodStart);
  // Quotas only apply when managed AI is live for the tier.
  const limitsActive = tier.managedAi;
  return {
    tier: tier.id,
    status: row.subscriptionStatus || "inactive",
    hasBillingAccount: Boolean(row.stripeCustomerId),
    planGenerationsUsed: expired ? 0 : row.planGenerationsUsed,
    planGenerationsLimit: limitsActive ? tier.planGenerationsPerPeriod : null,
    aiActionsUsed: expired ? 0 : row.aiActionsUsed,
    aiActionsLimit: limitsActive ? tier.aiActionsPerPeriod : null,
    periodResetAt: (expired ? new Date() : periodResetsAt(row.usagePeriodStart)).toISOString(),
  };
}

export async function getSubscriptionUsage(userId: string): Promise<SubscriptionUsage | null> {
  const row = await loadUsageRow(userId);
  if (!row) return null;
  return toSubscriptionUsage(row);
}

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "tier" | "quota"; message: string; status: number };

/**
 * Reserves one unit of `kind` usage against the account's monthly quota,
 * incrementing atomically-ish (read-then-conditional-update — acceptable
 * given a single user isn't realistically firing concurrent generations).
 * Lazily rolls the usage period over if it has expired.
 */
async function reserve(userId: string, kind: "plan" | "action"): Promise<ReserveResult> {
  const row = await loadUsageRow(userId);
  if (!row) return { ok: false, reason: "not_found", message: "Account not found.", status: 404 };

  const tier = tierDef(row.subscriptionTier);
  if (!tier.managedAi) {
    return {
      ok: false,
      reason: "tier",
      status: 402,
      message:
        "Managed AI requires Operator or Architect. Add your OpenRouter key in Settings, or upgrade.",
    };
  }

  const limit = kind === "plan" ? tier.planGenerationsPerPeriod : tier.aiActionsPerPeriod;
  const expired = isPeriodExpired(row.usagePeriodStart);
  const currentPlan = expired ? 0 : row.planGenerationsUsed;
  const currentActions = expired ? 0 : row.aiActionsUsed;
  const current = kind === "plan" ? currentPlan : currentActions;

  if (limit != null && current >= limit) {
    const resetAt = periodResetsAt(expired ? new Date() : row.usagePeriodStart);
    const label = kind === "plan" ? "AI-generated plans" : "AI actions";
    return {
      ok: false,
      reason: "quota",
      status: 429,
      message: `You've used all ${limit} ${label} for this billing period. It resets ${resetAt.toLocaleDateString()}, or upgrade for more headroom.`,
    };
  }

  const db = getDb();
  const nextPlan = kind === "plan" ? currentPlan + 1 : currentPlan;
  const nextActions = kind === "action" ? currentActions + 1 : currentActions;
  await db
    .update(users)
    .set({
      planGenerationsUsed: nextPlan,
      aiActionsUsed: nextActions,
      usagePeriodStart: expired ? new Date() : row.usagePeriodStart,
    })
    .where(eq(users.id, userId));

  return { ok: true };
}

export function reservePlanGenerationQuota(userId: string): Promise<ReserveResult> {
  return reserve(userId, "plan");
}

export function reserveAiActionQuota(userId: string): Promise<ReserveResult> {
  return reserve(userId, "action");
}

/**
 * Read-only check used by the managed-AI proxy for calls that were already
 * accounted for elsewhere (e.g. the individual chat() calls inside a single
 * `generatePlan()` run, which were already counted once via
 * `reservePlanGenerationQuota` before generation started).
 */
export async function requireManagedAiTier(userId: string): Promise<ReserveResult> {
  const row = await loadUsageRow(userId);
  if (!row) return { ok: false, reason: "not_found", message: "Account not found.", status: 404 };
  const tier = tierDef(row.subscriptionTier);
  if (!tier.managedAi) {
    return {
      ok: false,
      reason: "tier",
      status: 402,
      message:
        "Managed AI requires Operator or Architect. Add your OpenRouter key in Settings, or upgrade.",
    };
  }
  return { ok: true };
}
