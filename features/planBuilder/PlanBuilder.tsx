"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { classNames } from "@/lib/classNames";
import { Icon } from "@/components/Icon";
import {
  type BuilderDraft,
  type BuilderStep,
  BUILDER_DOMAIN_COLORS,
  colorForDomainIndex,
  defaultBuilderDraft,
  draftToPlanRequest,
  estimateGeneration,
  slugifyDomain,
  validateContent,
  validateShape,
} from "@/lib/planBuilder";
import type { Plan, PlanGrouping, PlanRequest } from "@/lib/types";
import {
  clearGenDraft,
  generatePlan,
  loadGenDraft,
  saveGenDraft,
  type GenProgress,
} from "@/lib/planGeneration";
import { suggestDomainsFromGoal } from "@/lib/domainSuggest";
import { ProviderError } from "@/lib/providers/errors";
import { PlanEditor } from "@/features/planBuilder/PlanEditor";

const DAY_PRESETS = [30, 45, 90, 180, 365];
const GROUPING_OPTS: Array<{ key: PlanGrouping; label: string; hint: string }> = [
  { key: "none", label: "None", hint: "All days only" },
  { key: "weekly", label: "Weekly", hint: "Week navigator" },
  { key: "monthly", label: "Monthly", hint: "Month buckets" },
  { key: "quarterly-monthly", label: "Quarter + month", hint: "Full period tree" },
];
const WEIGHTS = ["small", "medium", "large"] as const;

type Props = {
  onClose: () => void;
  onSaveDraft?: (meta: PlanRequest) => void;
  onComplete?: (plan: Plan) => void;
};

export function PlanBuilder({ onClose, onSaveDraft, onComplete }: Props) {
  const [step, setStep] = useState<BuilderStep>(1);
  const [draft, setDraft] = useState<BuilderDraft>(defaultBuilderDraft);
  const [newDomain, setNewDomain] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [gen, setGen] = useState<GenProgress | null>(null);
  const [genError, setGenError] = useState("");
  const [running, setRunning] = useState(false);
  const [editablePlan, setEditablePlan] = useState<Plan | null>(null);
  const [suggestingDomains, setSuggestingDomains] = useState(false);
  const [domainSuggestError, setDomainSuggestError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const domainSuggestAbortRef = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const shapeErrors = useMemo(() => validateShape(draft), [draft]);
  const contentErrors = useMemo(() => validateContent(draft), [draft]);
  const estimate = useMemo(() => estimateGeneration(draft), [draft]);

  const dirty =
    draft.name.trim() !== "" ||
    draft.goal.trim() !== "" ||
    running ||
    !!editablePlan;

  const patch = (partial: Partial<BuilderDraft>) => setDraft((d) => ({ ...d, ...partial }));

  const advance = () => {
    if (step === 1 && shapeErrors.length === 0) setStep(2);
    else if (step === 2 && contentErrors.length === 0) {
      onSaveDraft?.(draftToPlanRequest(draft));
      setStep(3);
    }
  };

  const back = () => {
    if (running) return;
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) {
      setEditablePlan(null);
      setStep(3);
    }
  };

  useEffect(() => {
    const saved = loadGenDraft();
    if (saved?.draft) {
      setDraft(saved.draft);
      setGen(saved.progress);
      if (saved.progress?.phase === "cancelled" || saved.progress?.phase === "error") {
        setStep(3);
      }
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (running) {
          setConfirmClose(true);
          return;
        }
        if (dirty && !confirmClose) setConfirmClose(true);
        else onClose();
        return;
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !running) {
        e.preventDefault();
        if (step < 3) advance();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const startGenerate = async (resume = false) => {
    setGenError("");
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const current = draftRef.current;
    try {
      const plan = await generatePlan({
        draft: current,
        signal: ac.signal,
        resume:
          resume && gen?.outline
            ? {
                outline: gen.outline,
                days: gen.days,
                periodIndex: gen.periodIndex,
                failedPeriods: gen.failedPeriods,
              }
            : undefined,
        onProgress: (p) => {
          setGen(p);
          saveGenDraft({ draft: current, progress: p, updatedAt: Date.now() });
        },
      });
      clearGenDraft();
      setRunning(false);
      setEditablePlan(plan);
      setStep(4);
    } catch (err) {
      setRunning(false);
      if (err instanceof DOMException && err.name === "AbortError") {
        setGen((p) =>
          p
            ? { ...p, phase: "cancelled", message: "Cancelled — you can resume" }
            : p,
        );
        return;
      }
      const msg =
        err instanceof ProviderError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Generation failed";
      setGenError(msg);
      setGen((p) => (p ? { ...p, phase: "error", message: msg } : p));
    }
  };

  const cancelGenerate = () => {
    abortRef.current?.abort();
  };

  const addDomain = () => {
    const label = newDomain.trim();
    if (!label) return;
    let id = slugifyDomain(label);
    const existing = new Set(draft.domains.map((d) => d.id));
    let n = 2;
    while (existing.has(id)) {
      id = `${slugifyDomain(label)}-${n++}`;
    }
    patch({
      domains: [
        ...draft.domains,
        {
          id,
          label,
          weight: "medium",
          color: colorForDomainIndex(draft.domains.length),
        },
      ],
    });
    setNewDomain("");
  };

  const suggestDomains = async () => {
    if (!draft.goal.trim() || suggestingDomains || running) return;
    domainSuggestAbortRef.current?.abort();
    const ac = new AbortController();
    domainSuggestAbortRef.current = ac;
    setSuggestingDomains(true);
    setDomainSuggestError("");
    try {
      const domains = await suggestDomainsFromGoal({
        goal: draft.goal,
        level: draft.level,
        exclusions: draft.exclusionsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        signal: ac.signal,
      });
      patch({ domains });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg =
        err instanceof ProviderError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not suggest domains.";
      setDomainSuggestError(msg);
    } finally {
      setSuggestingDomains(false);
    }
  };

  return (
    <div className="plan-builder">
      <div className="builder-steps">
        {[
          { n: 1, label: "Shape" },
          { n: 2, label: "Content" },
          { n: 3, label: "Generate" },
          { n: 4, label: "Edit" },
        ].map((s) => (
          <div
            key={s.n}
            className={classNames(
              "builder-step",
              step === s.n && "builder-step-active",
              step > s.n && "builder-step-done",
            )}
          >
            <span className="builder-step-num">{s.n}</span>
            <span className="builder-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {confirmClose && (
        <div className="builder-confirm">
          <p className="panel-copy">
            {running
              ? "Cancel generation in flight? You can resume later."
              : "Discard this draft and close?"}
          </p>
          <div className="panel-actions">
            <button type="button" className="secondary-btn" onClick={() => setConfirmClose(false)}>
              {running ? "Keep going" : "Keep editing"}
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                if (running) {
                  cancelGenerate();
                  setConfirmClose(false);
                } else {
                  onClose();
                }
              }}
            >
              {running ? "Cancel run" : "Discard"}
            </button>
          </div>
        </div>
      )}

      {!confirmClose && step === 1 && (
        <div className="builder-pane">
          <div className="gen-field">
            <label className="gen-label">Plan name</label>
            <input
              className="settings-input"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="OPERATION CUSTOMSTACK"
              autoFocus
            />
          </div>
          <div className="gen-field">
            <label className="gen-label">Subtitle</label>
            <input
              className="settings-input"
              value={draft.subtitle}
              onChange={(e) => patch({ subtitle: e.target.value })}
              placeholder="90-day backend depth campaign"
            />
          </div>
          <div className="gen-field">
            <label className="gen-label">Total days</label>
            <div className="seg-row">
              {DAY_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={classNames("seg-btn", draft.totalDays === n && "seg-btn-active")}
                  onClick={() => patch({ totalDays: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              className="settings-input"
              type="number"
              min={1}
              max={730}
              value={draft.totalDays}
              onChange={(e) => patch({ totalDays: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="gen-field">
            <label className="gen-label">Topics per day</label>
            <div className="seg-row">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={classNames("seg-btn", draft.topicsPerDay === n && "seg-btn-active")}
                  onClick={() => patch({ topicsPerDay: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="gen-field">
            <label className="gen-label">Grouping</label>
            <div className="seg-row">
              {GROUPING_OPTS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={classNames("seg-btn", draft.grouping === g.key && "seg-btn-active")}
                  onClick={() => patch({ grouping: g.key })}
                  title={g.hint}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="gen-hint">
              Builds the period navigator scopes (week / month / quarter) for this plan.
            </div>
          </div>
          {shapeErrors.length > 0 && (
            <ul className="builder-errors">
              {shapeErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!confirmClose && step === 2 && (
        <div className="builder-pane">
          <div className="gen-field">
            <label className="gen-label">Goal</label>
            <textarea
              className="settings-input builder-textarea"
              rows={3}
              value={draft.goal}
              onChange={(e) => {
                patch({ goal: e.target.value });
                if (domainSuggestError) setDomainSuggestError("");
              }}
              placeholder="Become a Staff-level backend engineer focused on NestJS and distributed systems"
              autoFocus
            />
          </div>
          <div className="gen-field">
            <label className="gen-label">Current level</label>
            <input
              className="settings-input"
              value={draft.level}
              onChange={(e) => patch({ level: e.target.value })}
              placeholder="Mid-level, solid NestJS, light AWS"
            />
          </div>
          <div className="gen-field">
            <label className="gen-label">Exclusions (one per line)</label>
            <textarea
              className="settings-input builder-textarea"
              rows={3}
              value={draft.exclusionsText}
              onChange={(e) => patch({ exclusionsText: e.target.value })}
              placeholder={"Intro to HTML\nBasic Git commands"}
            />
            <div className="gen-hint">Topics too basic to include.</div>
          </div>
          <div className="gen-field">
            <div className="builder-domain-head">
              <label className="gen-label">Domains & weights</label>
              <button
                type="button"
                className="secondary-btn builder-domain-suggest"
                onClick={suggestDomains}
                disabled={!draft.goal.trim() || suggestingDomains || running}
                title={
                  draft.goal.trim()
                    ? "Suggest domains from your goal"
                    : "Add a goal first"
                }
              >
                <Icon.Sparkle size={13} />
                {suggestingDomains ? "Suggesting…" : "Suggest with AI"}
              </button>
            </div>
            <div className="gen-hint">
              Start empty — generate from your goal, or add domains by hand. Adjust weights after.
            </div>
            <div className="builder-domains">
              {draft.domains.length === 0 && !suggestingDomains && (
                <div className="builder-domains-empty">
                  No domains yet. Use Suggest with AI once your goal is set, or add one below.
                </div>
              )}
              {draft.domains.map((d, idx) => (
                <div key={d.id} className="builder-domain-row">
                  <button
                    type="button"
                    className="builder-domain-swatch"
                    style={{ background: d.color }}
                    title="Cycle color"
                    onClick={() => {
                      const next = [...draft.domains];
                      const color =
                        BUILDER_DOMAIN_COLORS[
                          (BUILDER_DOMAIN_COLORS.indexOf(d.color) +
                            1 +
                            BUILDER_DOMAIN_COLORS.length) %
                            BUILDER_DOMAIN_COLORS.length
                        ];
                      next[idx] = { ...d, color };
                      patch({ domains: next });
                    }}
                  />
                  <span className="builder-domain-label">{d.label}</span>
                  <div className="seg-row">
                    {WEIGHTS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={classNames("seg-btn", d.weight === w && "seg-btn-active")}
                        onClick={() => {
                          const next = [...draft.domains];
                          next[idx] = { ...d, weight: w };
                          patch({ domains: next });
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="builder-domain-remove"
                    onClick={() =>
                      patch({ domains: draft.domains.filter((x) => x.id !== d.id) })
                    }
                    aria-label={`Remove ${d.label}`}
                  >
                    <Icon.X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="settings-key-row">
              <input
                className="settings-input"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Add domain…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDomain();
                  }
                }}
              />
              <button type="button" className="secondary-btn" onClick={addDomain}>
                Add
              </button>
            </div>
            {domainSuggestError && (
              <div className="builder-errors" role="alert">
                {domainSuggestError}
              </div>
            )}
          </div>
          <div className="gen-field">
            <label className="gen-label">Must-include topics (optional, one per line)</label>
            <textarea
              className="settings-input builder-textarea"
              rows={3}
              value={draft.mustIncludeText}
              onChange={(e) => patch({ mustIncludeText: e.target.value })}
              placeholder={"DynamoDB single-table design\nNestJS CQRS"}
            />
          </div>
          {contentErrors.length > 0 && (
            <ul className="builder-errors">
              {contentErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!confirmClose && step === 3 && (
        <div className="builder-pane">
          <div className="builder-estimate">
            <div className="gen-label">Generate</div>
            <p className="panel-copy">
              <strong>{draft.name || "Untitled plan"}</strong> · {draft.totalDays} days ·{" "}
              {estimate.topicCount} topics · ~{estimate.apiCalls} API calls ({estimate.periods}{" "}
              period batches + outline)
            </p>
            <p className="gen-hint">
              Uses your AI settings. Outline first, then one call per period. Cost depends on the
              model.
            </p>
          </div>

          {gen && (
            <div className="builder-progress">
              <div className="builder-progress-meta">
                <span className="gen-label">
                  {gen.phase === "outline"
                    ? "Outline"
                    : gen.phase === "periods"
                      ? `Period ${Math.min(gen.periodIndex + 1, Math.max(gen.periodTotal, 1))} of ${gen.periodTotal || "…"}`
                      : gen.phase.toUpperCase()}
                </span>
                <span className="gen-hint">{gen.message}</span>
              </div>
              <div className="builder-progress-track">
                <div
                  className="builder-progress-fill"
                  style={{
                    width:
                      gen.phase === "done"
                        ? "100%"
                        : gen.periodTotal
                          ? `${Math.round((gen.periodIndex / gen.periodTotal) * 100)}%`
                          : gen.phase === "outline"
                            ? "8%"
                            : "0%",
                  }}
                />
              </div>
              {gen.topicsSoFar.length > 0 && (
                <div className="builder-topic-stream">
                  {gen.topicsSoFar.slice(-12).map((t, i) => (
                    <div key={`${t}-${i}`} className="builder-topic-chip">
                      {t}
                    </div>
                  ))}
                </div>
              )}
              {gen.failedPeriods.length > 0 && (
                <div className="gen-hint">
                  Periods needing attention:{" "}
                  {gen.failedPeriods
                    .filter((i) => i >= 0)
                    .map((i) => i + 1)
                    .join(", ") || "some days were backfilled"}
                </div>
              )}
            </div>
          )}

          {genError && <div className="panel-error">{genError}</div>}
        </div>
      )}

      {!confirmClose && step === 4 && editablePlan && (
        <PlanEditor
          plan={editablePlan}
          onChange={setEditablePlan}
          onBack={back}
          onSave={(plan) => onComplete?.(plan)}
        />
      )}

      {!confirmClose && step < 4 && (
        <div className="panel-actions builder-actions">
          {step > 1 ? (
            <button type="button" className="secondary-btn" onClick={back} disabled={running}>
              Back
            </button>
          ) : (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => (dirty ? setConfirmClose(true) : onClose())}
            >
              Cancel
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="primary-btn"
              disabled={step === 1 ? shapeErrors.length > 0 : contentErrors.length > 0}
              onClick={advance}
            >
              Continue
            </button>
          ) : running ? (
            <button type="button" className="secondary-btn" onClick={cancelGenerate}>
              Cancel generation
            </button>
          ) : gen?.phase === "cancelled" || (gen?.phase === "error" && gen.outline) ? (
            <>
              <button type="button" className="secondary-btn" onClick={() => startGenerate(false)}>
                Restart
              </button>
              <button type="button" className="primary-btn" onClick={() => startGenerate(true)}>
                Resume
              </button>
            </>
          ) : (
            <button type="button" className="primary-btn" onClick={() => startGenerate(false)}>
              Generate plan
            </button>
          )}
          <span className="gen-hint builder-kbd">Esc close · ⌘/Ctrl+Enter continue</span>
        </div>
      )}
    </div>
  );
}
