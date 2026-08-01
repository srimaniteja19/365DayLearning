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
  freePlanGenerationsUsed: number;
  freeAiActionsUsed: number;
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
      freePlanGenerationsUsed: users.freePlanGenerationsUsed,
      freeAiActionsUsed: users.freeAiActionsUsed,
      usagePeriodStart: users.usagePeriodStart,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row || null;
}

function toSubscriptionUsage(row: UsageRow): SubscriptionUsage {
  const tier = tierDef(row.subscriptionTier);
  const isLifetime = tier.managedAllowanceWindow === "lifetime";
  const expired = isPeriodExpired(row.usagePeriodStart);
  return {
    tier: tier.id,
    status: row.subscriptionStatus || "inactive",
    hasBillingAccount: Boolean(row.stripeCustomerId),
    planGenerationsUsed: isLifetime ? row.freePlanGenerationsUsed : expired ? 0 : row.planGenerationsUsed,
    planGenerationsLimit: tier.planGenerationsPerPeriod,
    aiActionsUsed: isLifetime ? row.freeAiActionsUsed : expired ? 0 : row.aiActionsUsed,
    aiActionsLimit: tier.aiActionsPerPeriod,
    managedAllowanceWindow: tier.managedAllowanceWindow,
    periodResetAt: isLifetime
      ? null
      : (expired ? new Date() : periodResetsAt(row.usagePeriodStart)).toISOString(),
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
 * Reserves one unit of `kind` usage against the account's managed quota,
 * incrementing atomically-ish (read-then-conditional-update — acceptable
 * given a single user isn't realistically firing concurrent generations).
 * Lazily rolls the usage period over if it has expired.
 */
async function reserve(
  userId: string,
  kind: "plan" | "action",
  totalDays?: number,
): Promise<ReserveResult> {
  const row = await loadUsageRow(userId);
  if (!row) return { ok: false, reason: "not_found", message: "Account not found.", status: 404 };

  const tier = tierDef(row.subscriptionTier);
  if (!tier.managedAi) {
    return {
      ok: false,
      reason: "tier",
      status: 402,
      message:
        "Managed AI is not available for this account. Add your OpenRouter key instead.",
    };
  }

  const isLifetime = tier.managedAllowanceWindow === "lifetime";
  if (kind === "plan" && isLifetime && tier.maxDaysManaged != null && (totalDays == null || totalDays > tier.maxDaysManaged)) {
    return {
      ok: false,
      reason: "quota",
      status: 402,
      message: `Recruit's managed plan trial is limited to ${tier.maxDaysManaged} days. Add your OpenRouter key or upgrade for longer campaigns.`,
    };
  }

  const limit = kind === "plan" ? tier.planGenerationsPerPeriod : tier.aiActionsPerPeriod;
  const expired = isPeriodExpired(row.usagePeriodStart);
  const currentPlan = isLifetime ? row.freePlanGenerationsUsed : expired ? 0 : row.planGenerationsUsed;
  const currentActions = isLifetime ? row.freeAiActionsUsed : expired ? 0 : row.aiActionsUsed;
  const current = kind === "plan" ? currentPlan : currentActions;

  if (limit != null && current >= limit) {
    const label = kind === "plan" ? "AI-generated plans" : "AI actions";
    return {
      ok: false,
      reason: "quota",
      status: 429,
      message: isLifetime
        ? `You've used your ${limit} lifetime managed ${label}. Add your OpenRouter key or upgrade for more headroom.`
        : `You've used all ${limit} ${label} for this billing period. It resets ${periodResetsAt(expired ? new Date() : row.usagePeriodStart).toLocaleDateString()}, or upgrade for more headroom.`,
    };
  }

  const db = getDb();
  const nextPlan = kind === "plan" ? currentPlan + 1 : currentPlan;
  const nextActions = kind === "action" ? currentActions + 1 : currentActions;
  await db
    .update(users)
    .set({
      ...(isLifetime
        ? {
            freePlanGenerationsUsed: nextPlan,
            freeAiActionsUsed: nextActions,
          }
        : {
            planGenerationsUsed: nextPlan,
            aiActionsUsed: nextActions,
            usagePeriodStart: expired ? new Date() : row.usagePeriodStart,
          }),
    })
    .where(eq(users.id, userId));

  return { ok: true };
}

export function reservePlanGenerationQuota(userId: string, totalDays: number): Promise<ReserveResult> {
  return reserve(userId, "plan", totalDays);
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
export async function requireManagedAiAccess(userId: string): Promise<ReserveResult> {
  const row = await loadUsageRow(userId);
  if (!row) return { ok: false, reason: "not_found", message: "Account not found.", status: 404 };
  const tier = tierDef(row.subscriptionTier);
  if (!tier.managedAi) {
    return {
      ok: false,
      reason: "tier",
      status: 402,
      message:
        "Managed AI is not available for this account. Add your OpenRouter key instead.",
    };
  }
  return { ok: true };
}

/**
 * Read-only check for `/api/ai` plan calls. A plan run reserves its quota
 * first, so Recruit must have exactly its one reservation before its period
 * calls are allowed through the proxy.
 */
export async function requireManagedAiQuota(userId: string): Promise<ReserveResult> {
  const access = await requireManagedAiAccess(userId);
  if (!access.ok) return access;
  const row = await loadUsageRow(userId);
  if (!row) return { ok: false, reason: "not_found", message: "Account not found.", status: 404 };
  const tier = tierDef(row.subscriptionTier);
  if (tier.managedAllowanceWindow === "lifetime") {
    // A plan run reserves its one slot before it makes its individual proxy
    // calls. Allow that reserved run through, but never permit a second run.
    const limit = tier.planGenerationsPerPeriod || 0;
    if (row.freePlanGenerationsUsed < 1 || row.freePlanGenerationsUsed > limit) {
      return {
        ok: false,
        reason: "quota",
        status: 429,
        message: "You've used your lifetime managed plan trial. Add your OpenRouter key or upgrade for more headroom.",
      };
    }
  }
  return { ok: true };
}
