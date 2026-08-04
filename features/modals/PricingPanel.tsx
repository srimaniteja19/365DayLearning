"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { PricingUsageSkeleton } from "@/components/Skeleton";
import { classNames } from "@/lib/classNames";
import {
  SUBSCRIPTION_TIERS,
  TIER_ORDER,
  fetchSubscriptionStatus,
  openBillingPortal,
  requestUpgrade,
  type SubscriptionTier,
  type SubscriptionUsage,
} from "@/lib/subscriptions";

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const isUnlimited = limit === null || limit === undefined;
  const pct = isUnlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="pricing-usage-row">
      <div className="pricing-usage-label">
        <span>{label}</span>
        <span>
          {used}/{isUnlimited ? "∞" : limit}
        </span>
      </div>
      <div className="pricing-usage-track">
        <div
          className={classNames("pricing-usage-fill", !isUnlimited && pct >= 100 && "pricing-usage-fill-full")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export type PricingPanelProps = {
  onClose?: () => void;
  onOpenAccount?: () => void;
  refreshToken?: number;
};

export function PricingPanel({ onOpenAccount, refreshToken = 0 }: PricingPanelProps) {
  const { data: session } = useSession();
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [pendingTier, setPendingTier] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user) {
      return;
    }
    setLoadingUsage(true);
    fetchSubscriptionStatus().then((res) => {
      if (cancelled) return;
      setLoadingUsage(false);
      if (res.ok) setUsage(res.usage);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user, refreshToken]);

  const effectiveUsage = session?.user ? usage : null;
  const currentTier = effectiveUsage?.tier || (session?.user ? "free" : null);
  const pastDue = effectiveUsage?.status === "past_due";

  const handleUpgrade = async (tierId: SubscriptionTier) => {
    if (!session?.user) {
      onOpenAccount?.();
      return;
    }
    setPendingTier(tierId);
    setNotice(null);
    const result = await requestUpgrade(tierId);
    setPendingTier(null);
    if (result.ok && result.url) {
      window.location.assign(result.url);
      return;
    }
    setNotice(result.error || "Could not start checkout.");
  };

  const handlePortal = async () => {
    setNotice(null);
    const result = await openBillingPortal();
    if (result.ok && result.url) {
      window.location.assign(result.url);
      return;
    }
    setNotice(result.error || "Could not open billing portal.");
  };

  return (
    <div className="pricing-panel">
      <div className="pricing-intro">
        <p className="pricing-intro-lead">
          Recruit includes a one-time managed AI trial; add your OpenRouter key anytime for
          unlimited BYOK use. Operator and Architect add monthly managed quotas.
        </p>
      </div>

      {pastDue && (
        <div className="pricing-notice" role="status">
          Payment failed — update your card to keep managed AI. Your plan stays active while
          Stripe retries.
        </div>
      )}

      {notice && (
        <div className="pricing-notice pricing-notice-err" role="alert">
          {notice}
        </div>
      )}

      <div className="pricing-grid">
        {TIER_ORDER.map((id) => {
          const tier = SUBSCRIPTION_TIERS[id];
          const isCurrent = currentTier === id;
          return (
            <div
              key={id}
              className={classNames(
                "pricing-card",
                `pricing-card-${id}`,
                isCurrent && "pricing-card-current",
                tier.comingSoon && "pricing-card-soon",
              )}
            >
              {isCurrent && <div className="pricing-card-badge">{pastDue ? "Past due" : "Current"}</div>}
              {tier.comingSoon && !isCurrent && (
                <div className="pricing-card-badge pricing-card-badge-soon">Coming soon</div>
              )}
              <div className="pricing-card-rank">{tier.rankLabel}</div>
              <div className="pricing-card-price">
                {tier.priceMonthlyUsd === 0 ? (
                  <>Free</>
                ) : (
                  <>
                    <span className="pricing-card-amount">${tier.priceMonthlyUsd}</span>
                    <span className="pricing-card-period">/mo</span>
                  </>
                )}
              </div>
              <p className="pricing-card-tagline">{tier.tagline}</p>
              <ul className="pricing-card-features">
                {tier.features.map((f) => (
                  <li key={f}>
                    <Icon.Check size={13} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {id === "free" ? (
                <div className="pricing-card-static">
                  {isCurrent ? "Your plan" : "Always available"}
                </div>
              ) : tier.comingSoon ? (
                <div className="pricing-card-static">Coming soon</div>
              ) : pastDue && isCurrent ? (
                <button type="button" className="pricing-card-btn" onClick={handlePortal}>
                  Update payment method
                </button>
              ) : (
                <button
                  type="button"
                  className="pricing-card-btn"
                  disabled={(isCurrent && !pastDue) || pendingTier === id}
                  onClick={() => handleUpgrade(id)}
                >
                  {isCurrent
                    ? "Active"
                    : pendingTier === id
                      ? "Connecting…"
                      : "Choose tier"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {session?.user && (
        <div className="pricing-usage-section">
          <h4 className="pricing-usage-title">Managed AI Usage</h4>
          {loadingUsage ? (
            <PricingUsageSkeleton />
          ) : usage ? (
            <div className="pricing-usage-box">
              <UsageBar
                label="Plan generations"
                used={usage.planGenerationsUsed}
                limit={usage.planGenerationsLimit}
              />
              <UsageBar
                label="AI actions (notes, quizzes)"
                used={usage.aiActionsUsed}
                limit={usage.aiActionsLimit}
              />
              {usage.status && usage.status !== "active" && (
                <div className="pricing-usage-footer">
                  <span>Status: {usage.status}</span>
                  <button type="button" className="pricing-portal-link" onClick={handlePortal}>
                    Manage subscription →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="pricing-usage-empty">Could not load usage status.</p>
          )}
        </div>
      )}
    </div>
  );
}
