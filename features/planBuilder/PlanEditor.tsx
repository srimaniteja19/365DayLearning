"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Plan } from "@/lib/types";
import { classNames } from "@/lib/classNames";
import { Icon } from "@/components/Icon";
import {
  deleteDay,
  findDuplicateTopics,
  insertDayAfter,
  moveDay,
  normalizeTopic,
  primaryPeriodScope,
  regenerateDay,
  sanitizePlanDays,
  updateDomain,
  updatePeriodTheme,
  updateTopic,
  validateEditablePlan,
} from "@/lib/planEdit";
import { ProviderError } from "@/lib/providers/errors";

type Props = {
  plan: Plan;
  onChange: (plan: Plan) => void;
  onSave: (plan: Plan) => void;
  onBack: () => void;
};

export function PlanEditor({ plan, onChange, onSave, onBack }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [regenDay, setRegenDay] = useState<number | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState("");

  // One-shot repair for corrupted topic strings (e.g. "[object Object]").
  useEffect(() => {
    const cleaned = sanitizePlanDays(plan);
    if (cleaned !== plan) onChange(cleaned);
    // Only on mount / when plan id changes — avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  const issues = useMemo(() => validateEditablePlan(plan), [plan]);
  const dupMap = useMemo(() => findDuplicateTopics(plan.days), [plan.days]);
  const domainIds =
    plan.meta.domains?.map((d) => d.id) ||
    Array.from(new Set(plan.days.flatMap((d) => d.domains)));
  const periodScope = primaryPeriodScope(plan);
  const canSave = issues.length === 0;

  const isDup = (topic: string) => {
    const hits = dupMap.get(normalizeTopic(topic));
    return !!(hits && hits.length > 1);
  };

  const runRegen = async (dayNum: number) => {
    setRegenBusy(true);
    setRegenError("");
    try {
      const next = await regenerateDay(plan, dayNum, regenInstruction);
      onChange(next);
      setRegenDay(null);
      setRegenInstruction("");
    } catch (err) {
      setRegenError(
        err instanceof ProviderError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Regenerate failed",
      );
    } finally {
      setRegenBusy(false);
    }
  };

  const handleSave = () => {
    const cleaned = sanitizePlanDays({
      ...plan,
      status: "ready",
      totalDays: plan.days.length,
    });
    const remaining = validateEditablePlan(cleaned);
    if (remaining.length) {
      if (cleaned !== plan) onChange(cleaned);
      return;
    }
    onSave(cleaned);
  };

  return (
    <div className="plan-editor">
      <div className="builder-estimate">
        <div className="gen-label">Edit before saving</div>
        <p className="panel-copy">
          <strong>{plan.name}</strong> · {plan.days.length} days · {plan.topicsPerDay} topics/day
          {plan.status === "draft" ? " · draft" : ""}
        </p>
      </div>

      <div className="gen-field">
        <label className="gen-label">Plan name</label>
        <input
          className="settings-input"
          value={plan.name}
          onChange={(e) => onChange({ ...plan, name: e.target.value, status: "draft" })}
        />
      </div>
      <div className="gen-field">
        <label className="gen-label">Subtitle</label>
        <input
          className="settings-input"
          value={plan.subtitle}
          onChange={(e) => onChange({ ...plan, subtitle: e.target.value, status: "draft" })}
        />
      </div>

      {periodScope && periodScope.periods.length > 0 && (
        <div className="gen-field">
          <label className="gen-label">Period themes ({periodScope.key})</label>
          <div className="builder-domains">
            {periodScope.periods.map((p, i) => (
              <div key={`${p.label}-${i}`} className="builder-domain-row">
                <span className="builder-domain-label">
                  {p.label} · {p.start}–{p.end}
                </span>
                <input
                  className="settings-input"
                  value={p.sub}
                  onChange={(e) =>
                    onChange(updatePeriodTheme(plan, periodScope.key, i, e.target.value))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="editor-table-wrap">
        <table className="editor-table">
          <thead>
            <tr>
              <th className="editor-col-drag" />
              <th className="editor-col-day">Day</th>
              <th>Topics</th>
              <th className="editor-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plan.days.map((d, index) => (
              <tr
                key={d.id}
                className={classNames(dragIndex === index && "editor-row-dragging")}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null) return;
                  onChange(moveDay(plan, dragIndex, index));
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <td className="editor-col-drag" title="Drag to reorder">
                  ⋮⋮
                </td>
                <td className="editor-col-day">
                  <span className="editor-day-num">{String(d.day).padStart(3, "0")}</span>
                </td>
                <td>
                  <div className="editor-topics">
                    {d.topics.map((t, ti) => (
                      <div key={ti} className="editor-topic-row">
                        <input
                          className={classNames(
                            "settings-input",
                            isDup(t) && "editor-input-dup",
                          )}
                          value={t}
                          onChange={(e) =>
                            onChange(updateTopic(plan, d.day, ti, e.target.value))
                          }
                        />
                        <select
                          className="settings-input editor-domain-select"
                          value={d.domains[ti] || domainIds[0]}
                          onChange={(e) =>
                            onChange(updateDomain(plan, d.day, ti, e.target.value))
                          }
                        >
                          {domainIds.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  {regenDay === d.day && (
                    <div className="editor-regen">
                      <input
                        className="settings-input"
                        value={regenInstruction}
                        onChange={(e) => setRegenInstruction(e.target.value)}
                        placeholder='e.g. more about habit formation, or swap in a worked example'
                        autoFocus
                      />
                      <div className="panel-actions">
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={regenBusy}
                          onClick={() => runRegen(d.day)}
                        >
                          {regenBusy ? "Regenerating…" : "Regenerate"}
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            setRegenDay(null);
                            setRegenError("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      {regenError && <div className="panel-error">{regenError}</div>}
                    </div>
                  )}
                </td>
                <td className="editor-col-actions">
                  <button
                    type="button"
                    className="secondary-btn editor-icon-btn"
                    title="Insert day after"
                    onClick={() => onChange(insertDayAfter(plan, d.day))}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="secondary-btn editor-icon-btn"
                    title="Regenerate day"
                    onClick={() => {
                      setRegenDay(d.day);
                      setRegenInstruction("");
                      setRegenError("");
                    }}
                  >
                    <Icon.Rotate size={12} />
                  </button>
                  <button
                    type="button"
                    className="secondary-btn editor-icon-btn"
                    title="Delete day"
                    onClick={() => onChange(deleteDay(plan, d.day))}
                  >
                    <Icon.X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {issues.length > 0 && (
        <ul className="builder-errors">
          {issues.map((issue, i) => (
            <li key={`${issue.code}-${i}`}>{issue.message}</li>
          ))}
        </ul>
      )}

      <div className="panel-actions builder-actions">
        <button type="button" className="secondary-btn" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="primary-btn"
          disabled={!canSave}
          onClick={handleSave}
        >
          Save plan
        </button>
        {!canSave && (
          <span className="gen-hint">Fix {issues.length} issue{issues.length === 1 ? "" : "s"} to save</span>
        )}
      </div>
    </div>
  );
}
