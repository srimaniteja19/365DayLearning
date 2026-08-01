import { describe, expect, it, vi, afterEach } from "vitest";
import { SubscriptionError } from "@/lib/providers/errors";
import {
  SUBSCRIPTION_TIERS,
  TIER_ORDER,
  USAGE_PERIOD_MS,
  isPeriodExpired,
  periodResetsAt,
  tierDef,
  fetchSubscriptionStatus,
  hasLiveStripeSubscription,
  reservePlanGeneration,
  requestUpgrade,
} from "@/lib/subscriptions";

describe("tier definitions", () => {
  it("orders tiers cheapest to most expensive", () => {
    expect(TIER_ORDER).toEqual(["free", "operator", "architect"]);
    const prices = TIER_ORDER.map((id) => SUBSCRIPTION_TIERS[id].priceMonthlyUsd);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("free tier includes a one-time managed AI allowance", () => {
    const free = SUBSCRIPTION_TIERS.free;
    expect(free.managedAi).toBe(true);
    expect(free.comingSoon).toBe(false);
    expect(free.planGenerationsPerPeriod).toBe(1);
    expect(free.aiActionsPerPeriod).toBe(10);
    expect(free.maxDaysManaged).toBe(90);
    expect(free.managedAllowanceWindow).toBe("lifetime");
    expect(free.maxCampaignDays).toBe(90);
    expect(free.activeCampaignLimit).toBe(1);
    expect(free.automaticResourceEnrichment).toBe(false);
    expect(free.generationConcurrency).toBe(3);
  });

  it("paid tiers are live with managed AI quotas", () => {
    const operator = SUBSCRIPTION_TIERS.operator;
    const architect = SUBSCRIPTION_TIERS.architect;
    expect(operator.managedAi).toBe(true);
    expect(architect.managedAi).toBe(true);
    expect(operator.comingSoon).toBe(false);
    expect(architect.comingSoon).toBe(false);
    expect(architect.planGenerationsPerPeriod!).toBeGreaterThan(operator.planGenerationsPerPeriod!);
    expect(architect.aiActionsPerPeriod!).toBeGreaterThan(operator.aiActionsPerPeriod!);
    expect(architect.priceMonthlyUsd).toBeGreaterThan(operator.priceMonthlyUsd);
    expect(operator.managedAllowanceWindow).toBe("rolling");
    expect(operator.maxCampaignDays).toBe(365);
    expect(operator.activeCampaignLimit).toBe(3);
    expect(operator.automaticResourceEnrichment).toBe(true);
    expect(operator.generationConcurrency).toBe(5);
    expect(architect.maxCampaignDays).toBe(730);
    expect(architect.activeCampaignLimit).toBeNull();
    expect(architect.generationConcurrency).toBe(6);
  });

  it("tierDef falls back to free for unknown/missing tiers", () => {
    expect(tierDef(undefined)).toBe(SUBSCRIPTION_TIERS.free);
    expect(tierDef(null)).toBe(SUBSCRIPTION_TIERS.free);
    expect(tierDef("not-a-real-tier")).toBe(SUBSCRIPTION_TIERS.free);
    expect(tierDef("architect")).toBe(SUBSCRIPTION_TIERS.architect);
  });
});

describe("usage period math", () => {
  it("is not expired right after it starts", () => {
    expect(isPeriodExpired(Date.now())).toBe(false);
  });

  it("is expired once USAGE_PERIOD_MS has elapsed", () => {
    expect(isPeriodExpired(Date.now() - USAGE_PERIOD_MS - 1000)).toBe(true);
  });

  it("treats unparseable dates as expired", () => {
    expect(isPeriodExpired("not-a-date")).toBe(true);
  });

  it("periodResetsAt is USAGE_PERIOD_MS after the start", () => {
    const start = Date.now();
    const resetAt = periodResetsAt(start);
    expect(resetAt.getTime() - start).toBe(USAGE_PERIOD_MS);
  });
});

describe("client fetch helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchSubscriptionStatus returns usage on success", async () => {
    const usage = {
      tier: "operator",
      status: "active",
      hasBillingAccount: true,
      planGenerationsUsed: 1,
      planGenerationsLimit: 3,
      aiActionsUsed: 10,
      aiActionsLimit: 150,
      managedAllowanceWindow: "rolling",
      periodResetAt: new Date().toISOString(),
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => usage })));
    const result = await fetchSubscriptionStatus();
    expect(result).toEqual({ ok: true, usage });
  });

  it("hasLiveStripeSubscription covers active, trialing, and past_due", () => {
    expect(hasLiveStripeSubscription("active")).toBe(true);
    expect(hasLiveStripeSubscription("trialing")).toBe(true);
    expect(hasLiveStripeSubscription("past_due")).toBe(true);
    expect(hasLiveStripeSubscription("canceled")).toBe(false);
    expect(hasLiveStripeSubscription(null)).toBe(false);
  });

  it("reservePlanGeneration resolves silently on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })));
    await expect(reservePlanGeneration(90)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/subscription/reserve-plan",
      expect.objectContaining({ body: JSON.stringify({ totalDays: 90 }) }),
    );
  });

  it("reservePlanGeneration throws SubscriptionError with the server message on rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "You've used all 3 AI-generated plans for this billing period." }),
      })),
    );
    await expect(reservePlanGeneration(91)).rejects.toBeInstanceOf(SubscriptionError);
    await expect(reservePlanGeneration(91)).rejects.toThrow(/used all 3 AI-generated plans/);
  });

  it("requestUpgrade returns the Stripe Checkout URL on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ url: "https://checkout.stripe.com/c/pay/cs_test_123" }),
      })),
    );
    const result = await requestUpgrade("operator");
    expect(result).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
  });
});
