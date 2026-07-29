"use client";

import type { CSSProperties } from "react";
import { classNames } from "@/lib/classNames";

/** Field Ops bone — thick border, soft shimmer. */
export function Bone({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={classNames("ops-bone", className)} style={style} aria-hidden="true" />;
}

/** Full-app shell while IndexedDB / snapshot hydrate. */
export function AppHydrateSkeleton() {
  return (
    <div className="hydrate-shell" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Restoring your Field Ops progress…</span>

      <header className="hydrate-topbar">
        <div className="hydrate-brand">
          <Bone className="ops-bone-mark" />
          <div className="hydrate-brand-stack">
            <Bone className="ops-bone-kicker" />
            <Bone className="ops-bone-title" />
          </div>
        </div>
        <div className="hydrate-topbar-right">
          <Bone className="ops-bone-chip" />
          <Bone className="ops-bone-chip" />
          <Bone className="ops-bone-chip ops-bone-wide" />
        </div>
      </header>

      <div className="hydrate-switcher">
        <Bone className="ops-bone-tab" />
        <Bone className="ops-bone-tab" />
        <Bone className="ops-bone-tab ops-bone-tab-new" />
      </div>
      <div className="hydrate-hero">
        <div className="hydrate-hero-copy">
          <Bone className="ops-bone-stamp" />
          <Bone className="ops-bone-hero-title" />
          <Bone className="ops-bone-line" />
          <Bone className="ops-bone-line ops-bone-short" />
        </div>
        <Bone className="ops-bone-pct" />
      </div>
      <div className="hydrate-tabs">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="ops-bone-view-tab" />
        ))}
      </div>
      <div className="hydrate-days">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="hydrate-day-row">
            <Bone className="ops-bone-day-num" />
            <div className="hydrate-day-body">
              <Bone className="ops-bone-line" />
              <div className="hydrate-topic-pills">
                <Bone className="ops-bone-pill" />
                <Bone className="ops-bone-pill ops-bone-pill-short" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hydrate-status">
        <span className="hydrate-status-dot" />
        Restoring progress…
      </div>
    </div>
  );
}

/** Pricing “This period” usage placeholder — avoids footer jump. */
export function PricingUsageSkeleton() {
  return (
    <div className="pricing-usage pricing-usage-skeleton" role="status" aria-busy="true">
      <span className="sr-only">Loading usage…</span>
      <div className="pricing-usage-title">This period</div>
      {[0, 1].map((i) => (
        <div key={i} className="pricing-usage-row">
          <div className="pricing-usage-label">
            <Bone className="ops-bone-usage-label" />
            <Bone className="ops-bone-usage-val" />
          </div>
          <div className="pricing-usage-track pricing-usage-track-skel">
            <Bone className="ops-bone-usage-fill" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Account modal while NextAuth session resolves. */
export function AccountSessionSkeleton() {
  return (
    <div className="account-panel account-skel" role="status" aria-busy="true">
      <span className="sr-only">Checking your session…</span>
      <div className="account-signed account-signed-skel">
        <Bone className="ops-bone-avatar" />
        <div className="account-signed-body">
          <Bone className="ops-bone-kicker" />
          <Bone className="ops-bone-line ops-bone-mid" />
          <Bone className="ops-bone-line ops-bone-short" />
        </div>
      </div>
      <Bone className="ops-bone-sync" />
      <Bone className="ops-bone-btn ops-bone-btn-block" />
      <Bone className="ops-bone-btn ops-bone-btn-block ops-bone-btn-ghost" />
    </div>
  );
}
