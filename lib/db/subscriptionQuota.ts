import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/admin";
import {
  isPeriodExpired,
  periodResetsAt,
  tierDef,
  type SubscriptionUsage,
} from "@/lib/subscriptions";

type UsageRow = {
  email: string;
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
      email: users.email,
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
  if (!row) return null;

  if (isAdminEmail(row.email) && row.subscriptionTier !== "architect") {
    try {
      await db.update(users).set({ subscriptionTier: "architect", subscriptionStatus: "active" }).where(eq(users.id, userId));
      row.subscriptionTier = "architect";
      row.subscriptionStatus = "active";
    } catch { /* ignore */ }
  }

  return row;
}

function toSubscriptionUsage(row: UsageRow): SubscriptionUsage {
  const isAdmin = isAdminEmail(row.email);
  const tier = tierDef(isAdmin ? "architect" : row.subscriptionTier);
  const isLifetime = !isAdmin && tier.managedAllowanceWindow === "lifetime";
  const expired = isPeriodExpired(row.usagePeriodStart);
  return {
    tier: tier.id,
    status: isAdmin ? "active" : row.subscriptionStatus || "inactive",
    hasBillingAccount: Boolean(row.stripeCustomerId),
    planGenerationsUsed: isAdmin ? 0 : isLifetime ? row.freePlanGenerationsUsed : expired ? 0 : row.planGenerationsUsed,
    planGenerationsLimit: isAdmin ? null : tier.planGenerationsPerPeriod,
    aiActionsUsed: isAdmin ? 0 : isLifetime ? row.freeAiActionsUsed : expired ? 0 : row.aiActionsUsed,
    aiActionsLimit: isAdmin ? null : tier.aiActionsPerPeriod,
    managedAllowanceWindow: isAdmin ? "rolling" : tier.managedAllowanceWindow,
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

async function reserve(
  userId: string,
  kind: "plan" | "action",
  totalDays?: number,
): Promise<ReserveResult> {
  const row = await loadUsageRow(userId);
  if (!row) return { ok: false, reason: "not_found", message: "Account not found.", status: 404 };

  if (isAdminEmail(row.email)) {
    return { ok: true };
  }

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

export async function requireManagedAiAccess(userId: string): Promise<ReserveResult> {
  const row = await loadUsageRow(userId);
  if (!row) return { ok: false, reason: "not_found", message: "Account not found.", status: 404 };
  if (isAdminEmail(row.email)) return { ok: true };
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

export async function requireManagedAiQuota(userId: string): Promise<ReserveResult> {
  const access = await requireManagedAiAccess(userId);
  if (!access.ok) return access;
  const row = await loadUsageRow(userId);
  if (!row) return { ok: false, reason: "not_found", message: "Account not found.", status: 404 };
  if (isAdminEmail(row.email)) return { ok: true };
  const tier = tierDef(row.subscriptionTier);
  if (tier.managedAllowanceWindow === "lifetime") {
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
