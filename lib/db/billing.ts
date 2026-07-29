import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { SubscriptionTier } from "@/lib/subscriptions";

export type BillingFields = {
  id: string;
  email: string;
  name: string | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export async function getUserBilling(userId: string): Promise<BillingFields | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      subscriptionTier: users.subscriptionTier,
      subscriptionStatus: users.subscriptionStatus,
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row || null;
}

export async function getUserByStripeCustomerId(
  customerId: string,
): Promise<BillingFields | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      subscriptionTier: users.subscriptionTier,
      subscriptionStatus: users.subscriptionStatus,
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
    })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return row || null;
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const db = getDb();
  await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
}

export async function applySubscriptionState(input: {
  userId: string;
  tier: SubscriptionTier;
  status: string;
  stripeSubscriptionId: string | null;
  /** When true, reset usage counters for a new paid period. */
  resetUsage?: boolean;
}): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({
      subscriptionTier: input.tier,
      subscriptionStatus: input.status,
      stripeSubscriptionId: input.stripeSubscriptionId,
      ...(input.resetUsage
        ? {
            planGenerationsUsed: 0,
            aiActionsUsed: 0,
            usagePeriodStart: new Date(),
          }
        : {}),
    })
    .where(eq(users.id, input.userId));
}
