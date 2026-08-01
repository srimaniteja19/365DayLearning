"use client";

import React from "react";
import { Icon } from "@/components/Icon";
import { Tip } from "@/components/Tip";
import { classNames } from "@/lib/classNames";

export type BadgeStatus = {
  badge: {
    id: string;
    label: string;
    description: string;
    tier: "bronze" | "silver" | "gold" | "platinum";
  };
  unlocked: boolean;
  current: number;
  target: number;
};

export type BadgesPanelProps = {
  statuses: BadgeStatus[];
  onClose?: () => void;
};

export function BadgesPanel({ statuses, onClose }: BadgesPanelProps) {
  const unlockedCount = statuses.filter((s) => s.unlocked).length;
  return (
    <div className="settings-panel badges-panel">
      <p className="panel-copy">
        {unlockedCount} of {statuses.length} unlocked — earned automatically from your progress,
        streaks, reviews, and journal. No extra steps needed.
      </p>
      <div className="badges-grid">
        {statuses.map((s) => (
          <Tip
            key={s.badge.id}
            content={
              s.unlocked
                ? `${s.badge.description} · Unlocked.`
                : `${s.badge.description}${s.target > 1 ? ` · ${s.current}/${s.target}` : ""}`
            }
            stamp={String(s.badge.tier).toUpperCase()}
            tone={s.unlocked ? "mint" : s.badge.tier === "gold" ? "lemon" : s.badge.tier === "silver" ? "sky" : "coral"}
            side="top"
            maxWidth={260}
          >
            <div
              className={classNames(
                "badge-card",
                `badge-tier-${s.badge.tier}`,
                s.unlocked && "badge-card-unlocked",
              )}
              tabIndex={0}
            >
              <div className="badge-card-icon">
                <Icon.Medal size={20} />
              </div>
              <div className="badge-card-label">{s.badge.label}</div>
              <div className="badge-card-desc">{s.badge.description}</div>
              {!s.unlocked && s.target > 1 && (
                <>
                  <div className="badge-card-progress">
                    <div
                      className="badge-card-progress-fill"
                      style={{ width: `${Math.round((s.current / s.target) * 100)}%` }}
                    />
                  </div>
                  <div className="badge-card-progress-label">
                    {s.current}/{s.target}
                  </div>
                </>
              )}
            </div>
          </Tip>
        ))}
      </div>
      <div className="panel-actions">
        <button className="secondary-btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
