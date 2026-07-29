// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { classNames } from "@/lib/classNames";
import { SUBSCRIPTION_TIERS, TIER_ORDER } from "@/lib/subscriptions";

const CAMPAIGN_STEPS = [
  {
    n: "01",
    title: "Start",
    copy: "Pick an example campaign, or generate a custom plan for any subject — psychology, economics, history, languages, crafts, tech, and more.",
  },
  {
    n: "02",
    title: "Execute",
    copy: "Daily Console — list, bento, or spine. Check topics. Write day notes.",
  },
  {
    n: "03",
    title: "Assist",
    copy: "Optional: Quiz me, generate notes, draft a LinkedIn post — with your own AI key.",
  },
  {
    n: "04",
    title: "Remember",
    copy: "Spaced repetition Review queue, Weekly recap, and On This Day resurfacing.",
  },
  {
    n: "05",
    title: "Capture overflow",
    copy: "Rabbit holes go to Field Kit — not lost, not cluttering the campaign.",
  },
  {
    n: "06",
    title: "Progress",
    copy: "XP, levels, rank, streaks, and badges track the arc.",
  },
];

/** Planned annual = 10× monthly (≈2 months free). Display only — checkout not live. */
function plannedAnnual(monthlyUsd) {
  if (!monthlyUsd) return { yearly: 0, effectiveMonthly: 0, savePct: 0 };
  const yearly = monthlyUsd * 10;
  const effectiveMonthly = yearly / 12;
  const savePct = Math.round((1 - effectiveMonthly / monthlyUsd) * 100);
  return { yearly, effectiveMonthly, savePct };
}

function scrollToId(id) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Marketing landing + cold-start plan picker.
 * Primary CTA requires sign-in / sign-up.
 */
export function HomeView({
  hasCampaign,
  summary,
  examples,
  onAddExample,
  onOpenBuilder,
  onOpenAccount,
  accountLabel,
  onRequireAuth,
  onStartWithAccount,
  onGoDashboard,
  onOpenPricing,
  onOpenKit,
  learnedCount = 0,
  bookmarkCount = 0,
}) {
  const [started, setStarted] = useState(false);
  const [billing, setBilling] = useState("annual");
  const pickerRef = useRef(null);

  useEffect(() => {
    if (started && pickerRef.current) {
      pickerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [started]);

  /** Require account, then reveal plan picker. */
  const startAccount = () => {
    const go = () => setStarted(true);
    if (typeof onStartWithAccount === "function") {
      onStartWithAccount(go);
      return;
    }
    onRequireAuth?.(go);
  };

  const buildCustom = () => {
    const go = () => onOpenBuilder?.();
    if (typeof onStartWithAccount === "function") {
      onStartWithAccount(go);
      return;
    }
    onRequireAuth?.(go);
  };

  const openFieldKit = () => onOpenKit?.("learned");

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand" aria-label="Refrainly">
          <span className="landing-brand-mark" aria-hidden="true" />
          <span className="landing-brand-text">REFRAINLY</span>
        </div>
        <div className="landing-nav-actions">
          {onOpenKit && (
            <button
              type="button"
              className="landing-nav-link landing-nav-kit"
              onClick={openFieldKit}
            >
              Field kit
              {(learnedCount > 0 || bookmarkCount > 0) && (
                <span className="landing-nav-kit-count">{learnedCount + bookmarkCount}</span>
              )}
            </button>
          )}
          {hasCampaign && (
            <button type="button" className="landing-nav-link landing-nav-dash" onClick={onGoDashboard}>
              Dashboard
            </button>
          )}
          <button type="button" className="landing-nav-link" onClick={() => scrollToId("pricing")}>
            Pricing
          </button>
          <button type="button" className="landing-nav-cta" onClick={onOpenAccount}>
            {accountLabel ? "Account" : "Sign in"}
          </button>
        </div>
      </header>

      {/* 1. Hero */}
      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero-mesh" aria-hidden="true" />
        <div className="landing-hero-copy">
          <span className="landing-hero-kicker">Briefing · Field ops</span>
          <p className="landing-brand-hero">REFRAINLY</p>
          {hasCampaign ? (
            <>
              <h1 id="landing-hero-title" className="landing-hero-title">
                Ready for today&apos;s mission?
              </h1>
              <p className="landing-hero-lead">
                Continue <strong>{summary.name}</strong> — {summary.daysComplete} of{" "}
                {summary.totalDays} days done.
              </p>
              <div className="landing-hero-actions">
                <button type="button" className="landing-cta" onClick={onGoDashboard}>
                  Go to dashboard
                </button>
                <button type="button" className="landing-cta-ghost" onClick={startAccount}>
                  Add another plan
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 id="landing-hero-title" className="landing-hero-title">
                Field Ops for daily learning campaigns
              </h1>
              <p className="landing-hero-lead">
                A <strong>campaign runner</strong> for any subject — day-by-day plans, real memory,
                and a Field Kit for everything off-plan.
              </p>
              <div className="landing-hero-subjects" aria-hidden="true">
                {["Psychology", "Economics", "History", "Languages", "Music", "Tech"].map((s) => (
                  <span key={s} className="landing-hero-chip">{s}</span>
                ))}
              </div>
              <div className="landing-hero-actions">
                <button type="button" className="landing-cta" onClick={startAccount}>
                  Create free account
                </button>
                <button
                  type="button"
                  className="landing-cta-ghost"
                  onClick={() => scrollToId("pricing")}
                >
                  View pricing
                </button>
              </div>
              <p className="landing-hero-fine">Free Recruit tier · sign in required · syncs across devices</p>
            </>
          )}
        </div>

        <div className="landing-hero-viz" aria-hidden="true">
          <div className="landing-viz-board">
            <div className="landing-viz-top">
              <span className="landing-viz-op">OPERATION MINDFIELD</span>
              <span className="landing-viz-live">
                <span className="landing-viz-live-dot" />
                LIVE
              </span>
            </div>
            <div className="landing-viz-progress">
              <div className="landing-viz-progress-meta">
                <span>Day 12 / 30</span>
                <span>40%</span>
              </div>
              <div className="landing-viz-bar">
                <span className="landing-viz-bar-fill" />
              </div>
            </div>
            <ul className="landing-viz-days">
              <li className="landing-viz-day is-done">
                <span className="landing-viz-day-n">10</span>
                <span className="landing-viz-day-t">Deliberate practice</span>
                <span className="landing-viz-check" />
              </li>
              <li className="landing-viz-day is-done">
                <span className="landing-viz-day-n">11</span>
                <span className="landing-viz-day-t">Spaced repetition</span>
                <span className="landing-viz-check" />
              </li>
              <li className="landing-viz-day is-active">
                <span className="landing-viz-day-n">12</span>
                <span className="landing-viz-day-t">Retrieval practice</span>
                <span className="landing-viz-now">NOW</span>
              </li>
              <li className="landing-viz-day">
                <span className="landing-viz-day-n">13</span>
                <span className="landing-viz-day-t">Metacognition</span>
              </li>
            </ul>
          </div>
          <div className="landing-viz-kit">
            <span className="landing-viz-kit-label">Field Kit</span>
            <div className="landing-viz-slip landing-viz-slip-a">
              Loss aversion ≠ risk aversion
            </div>
            <div className="landing-viz-slip landing-viz-slip-b">
              Link · Kahneman ch. 26
            </div>
            <div className="landing-viz-slip landing-viz-slip-c">
              Rabbit hole → keep
            </div>
          </div>
          <span className="landing-viz-stamp">DAY 12</span>
        </div>
      </section>

      {hasCampaign && summary && (
        <section className="landing-stats" aria-label="Your progress">
          <div className="landing-stat" style={{ "--i": 0 }}>
            <span className="landing-stat-val">{summary.streak}</span>
            <span className="landing-stat-label">day streak</span>
          </div>
          <div className="landing-stat" style={{ "--i": 1 }}>
            <span className="landing-stat-val">{summary.xp.toLocaleString()}</span>
            <span className="landing-stat-label">XP</span>
          </div>
          <div className="landing-stat" style={{ "--i": 2 }}>
            <span className="landing-stat-val">LV {summary.level}</span>
            <span className="landing-stat-label">{summary.rank}</span>
          </div>
          <div className="landing-stat" style={{ "--i": 3 }}>
            <span className="landing-stat-val">
              {summary.daysComplete}/{summary.totalDays}
            </span>
            <span className="landing-stat-label">days</span>
          </div>
        </section>
      )}

      {/* 2. Problem */}
      <section className="landing-section landing-problem" aria-labelledby="landing-problem-title">
        <span className="landing-stamp">Problem</span>
        <h2 id="landing-problem-title" className="landing-section-title">
          Most tools dump content or lock you in
        </h2>
        <ul className="landing-problem-list">
          <li>Content dumps with no finishable structure — or one rigid course you can&apos;t reshape.</li>
          <li>
            Checkboxes without memory: nothing resurfaces, so yesterday&apos;s topics evaporate.
          </li>
          <li>
            No clean split between day notes and rabbit holes — tangents either vanish or clutter
            the plan.
          </li>
          <li>AI gated behind a vendor quota before you&apos;ve proven the loop works.</li>
        </ul>
      </section>

      {/* 3. How it works */}
      <section
        id="how-it-works"
        className="landing-section landing-loop"
        aria-labelledby="landing-loop-title"
      >
        <span className="landing-stamp">Mechanism</span>
        <h2 id="landing-loop-title" className="landing-section-title">
          How a campaign runs
        </h2>
        <p className="landing-section-lead">Six steps. Skim the headlines — that&apos;s the loop.</p>
        <ol className="landing-loop-grid">
          {CAMPAIGN_STEPS.map((step) => (
            <li key={step.n} className="landing-loop-step">
              <span className="landing-loop-n" aria-hidden="true">
                {step.n}
              </span>
              <h3 className="landing-loop-title">{step.title}</h3>
              <p className="landing-loop-copy">{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Surfaces */}
      <section
        id="field-kit"
        className="landing-section landing-surfaces"
        aria-labelledby="landing-surfaces-title"
      >
        <span className="landing-stamp">Surfaces</span>
        <h2 id="landing-surfaces-title" className="landing-section-title">
          Two surfaces. One ops deck.
        </h2>
        <p className="landing-section-lead landing-surfaces-callout">
          <strong>Day notes</strong> live inside a campaign day.{" "}
          <strong>Field Kit notes</strong> are for everything else — talks, tools, tips, and rabbit
          holes that don&apos;t belong to any single day. Same words, different jobs.
        </p>
        <div className="landing-surfaces-grid">
          <article className="landing-surface landing-surface-deck">
            <span className="landing-surface-stamp">Deck</span>
            <h3 className="landing-surface-title">Campaign Deck</h3>
            <p className="landing-surface-copy">
              Your daily driver: active plan hero, Field Ops filters, and views — Console, Grid,
              Review, Weekly, Analytics.
            </p>
            <ul className="landing-surface-list">
              <li>Topic clears + day notes on each mission</li>
              <li>Review queue (spaced repetition)</li>
              <li>XP, streaks, On This Day</li>
            </ul>
            {hasCampaign && (
              <button type="button" className="landing-surface-cta" onClick={onGoDashboard}>
                Open dashboard
              </button>
            )}
          </article>
          <article className="landing-surface landing-surface-kit">
            <span className="landing-surface-stamp">Kit</span>
            <h3 className="landing-surface-title">Field Kit</h3>
            <p className="landing-surface-copy">
              Independent of any campaign. Always one click away — even before you start a plan.
            </p>
            <ul className="landing-surface-list">
              <li>
                <strong>Notes</strong> — date-keyed slips, Chrono filters, tags (talk / paper / tool
                / tip / course / other)
              </li>
              <li>
                <strong>Bookmarks</strong> — YouTube, Vimeo, articles, repos, docs
              </li>
              <li>
                <strong>Lens</strong> — search across Notes and Bookmarks
              </li>
            </ul>
            {onOpenKit && (
              <button type="button" className="landing-surface-cta" onClick={openFieldKit}>
                Open Field Kit
              </button>
            )}
          </article>
        </div>
      </section>

      {/* 5. AI */}
      <section
        id="ai"
        className="landing-section landing-ai"
        aria-labelledby="landing-ai-title"
      >
        <span className="landing-stamp">AI</span>
        <h2 id="landing-ai-title" className="landing-section-title">
          Bring your own key. Keep the loop free.
        </h2>
        <div className="landing-ai-grid">
          <div className="landing-ai-card landing-ai-card-main">
            <h3 className="landing-ai-card-title">Recruit · bring your own key (live)</h3>
            <p className="landing-ai-card-copy">
              Add your own AI key in Settings. Quiz, study notes, LinkedIn drafts, plan
              generation, and Field Kit polish run on <em>your</em> credits — no vendor lock-in, no
              quota wall on day one.
            </p>
            <ul className="landing-ai-list">
              <li>Key stays in memory by default (cleared when the tab closes)</li>
              <li>Optional “remember on this device” if you want persistence</li>
              <li>Without a key, the full campaign loop still works — AI panels degrade gracefully</li>
            </ul>
          </div>
          <div className="landing-ai-card">
            <h3 className="landing-ai-card-title">Managed AI · live</h3>
            <p className="landing-ai-card-copy">
              Operator and Architect include managed AI (no key required) with monthly quotas.
              Paid tiers keep bring-your-own-key too — managed AI is an option, not a replacement.
            </p>
            <button type="button" className="landing-surface-cta landing-ai-link" onClick={() => scrollToId("pricing")}>
              See plans
            </button>
          </div>
        </div>
      </section>

      {/* 6. Pricing */}
      <section
        id="pricing"
        className="landing-section landing-pricing"
        aria-labelledby="landing-pricing-title"
      >
        <span className="landing-stamp">Pricing</span>
        <h2 id="landing-pricing-title" className="landing-section-title">
          Start free with an account. Upgrade anytime with Stripe.
        </h2>
        <p className="landing-section-lead">
          Tier names match XP ranks (Recruit / Operator / Architect). Annual is the default view —
          pair a subscription term with a long campaign when checkout goes live.{" "}
          <strong>Checkout is not connected yet</strong> for paid tiers. An account is required to
          run campaigns and Field Kit.
        </p>

        <div className="landing-billing" role="group" aria-label="Billing period">
          <button
            type="button"
            className={classNames("landing-billing-btn", billing === "monthly" && "is-on")}
            aria-pressed={billing === "monthly"}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={classNames("landing-billing-btn", billing === "annual" && "is-on")}
            aria-pressed={billing === "annual"}
            onClick={() => setBilling("annual")}
          >
            Annual
            <span className="landing-billing-save">better for 365-day arcs</span>
          </button>
        </div>

        <div className="landing-pricing-grid">
          {TIER_ORDER.map((id) => {
            const tier = SUBSCRIPTION_TIERS[id];
            const annual = plannedAnnual(tier.priceMonthlyUsd);
            const isFree = tier.priceMonthlyUsd === 0;
            const showAnnual = billing === "annual" && !isFree;
            return (
              <article
                key={id}
                className={classNames(
                  "landing-price-card",
                  `landing-price-card-${id}`,
                  isFree && "landing-price-card-free",
                  tier.comingSoon && "landing-price-card-soon",
                )}
              >
                {tier.comingSoon && (
                  <span className="landing-price-badge">Coming soon</span>
                )}
                {!tier.comingSoon && (
                  <span className="landing-price-badge landing-price-badge-live">Live</span>
                )}
                <h3 className="landing-price-rank">{tier.rankLabel}</h3>
                <div className="landing-price-amount">
                  {isFree ? (
                    <>$0</>
                  ) : showAnnual ? (
                    <>
                      <span className="landing-price-num">${annual.yearly}</span>
                      <span className="landing-price-per">/yr</span>
                      <span className="landing-price-eff">
                        ≈ ${annual.effectiveMonthly.toFixed(2)}/mo · save {annual.savePct}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="landing-price-num">${tier.priceMonthlyUsd}</span>
                      <span className="landing-price-per">/mo</span>
                    </>
                  )}
                </div>
                <p className="landing-price-tagline">{tier.tagline}</p>
                <ul className="landing-price-features">
                  {isFree ? (
                    <>
                      <li>Free account — full campaign loop</li>
                      <li>Console, XP, Review queue, Field Kit</li>
                      <li>Bring-your-own-key AI (unlimited on your credits)</li>
                      <li>Cloud sync · export / import</li>
                      <li>Multi-plan switcher, themes, badges</li>
                    </>
                  ) : id === "operator" ? (
                    <>
                      <li>Everything in Recruit</li>
                      <li>Managed AI — 3 plan gens + 150 actions / month</li>
                      <li>No key required for those quotas</li>
                      <li>Bring-your-own-key remains available</li>
                      <li>Stripe checkout · invoices · billing portal</li>
                    </>
                  ) : (
                    <>
                      <li>Everything in Operator</li>
                      <li>Managed AI — 5 plan gens + 400 actions / month</li>
                      <li>Highest managed allowance</li>
                      <li>Bring-your-own-key remains available</li>
                      <li>Stripe checkout · invoices · billing portal</li>
                    </>
                  )}
                </ul>
                {isFree ? (
                  <button type="button" className="landing-cta landing-price-cta" onClick={startAccount}>
                    Create free account
                  </button>
                ) : (
                  <button
                    type="button"
                    className="landing-surface-cta landing-price-cta"
                    onClick={onOpenPricing}
                  >
                    {billing === "annual" ? "See monthly checkout" : `Get ${tier.rankLabel}`}
                  </button>
                )}
                {isFree && (
                  <p className="landing-price-fine">Free forever on Recruit · no card for signup</p>
                )}
              </article>
            );
          })}
        </div>
        <p className="landing-pricing-note">
          Prefer the in-app panel?{" "}
          <button type="button" className="landing-text-btn" onClick={onOpenPricing}>
            Open Plans
          </button>
          . Checkout is monthly for now — annual figures are illustrative (10× monthly).
        </p>
      </section>

      {/* 7. Trust */}
      <section
        id="trust"
        className="landing-section landing-trust"
        aria-labelledby="landing-trust-title"
      >
        <span className="landing-stamp">Trust</span>
        <h2 id="landing-trust-title" className="landing-section-title">
          Your data, spelled out
        </h2>
        <div className="landing-trust-grid">
          <article className="landing-trust-card">
            <h3>Account required</h3>
            <p>
              Sign up to run campaigns and Field Kit. Your plans, progress, notes, review state,
              learned slips, and bookmarks belong to your account.
            </p>
          </article>
          <article className="landing-trust-card">
            <h3>Cloud sync</h3>
            <p>
              Signed-in sessions sync the full snapshot across devices — so a long campaign can
              follow you from laptop to phone without starting over.
            </p>
          </article>
          <article className="landing-trust-card">
            <h3>Export · import</h3>
            <p>
              Export markdown notes, a full backup, or a plan-only share file. Import supports{" "}
              <strong>merge</strong> or <strong>replace</strong>. Exports never include your AI
              keys.
            </p>
          </article>
        </div>
      </section>

      {/* 8. Audience */}
      <section className="landing-section landing-audience" aria-labelledby="landing-audience-title">
        <span className="landing-stamp">Fit</span>
        <h2 id="landing-audience-title" className="landing-section-title">
          Who it&apos;s for
        </h2>
        <div className="landing-audience-grid">
          <div className="landing-audience-for">
            <h3 className="landing-audience-label">For</h3>
            <ul>
              <li>
                Anyone running a serious self-study arc — psychology, economics, history,
                languages, arts, sciences, trades, tech, or something you invent yourself
              </li>
              <li>People who want structure + recall + a place for messy off-plan learning</li>
            </ul>
          </div>
          <div className="landing-audience-not">
            <h3 className="landing-audience-label">Not for</h3>
            <ul>
              <li>Not a Coursera-style course platform — you build (or generate) the curriculum</li>
              <li>Not a Notion template</li>
              <li>Not a generic habit tracker</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Plan picker (conversion) */}
      {(started || hasCampaign) && (
        <section className="landing-picker" ref={pickerRef} id="start">
          <div className="landing-picker-head">
            <h2 className="landing-picker-title">
              {hasCampaign ? "Add a campaign" : "Start your first campaign"}
            </h2>
            <p className="landing-picker-lead">
              Start with an example — psychology &amp; decision science, a year of systems depth, or an AI
              sprint — or build a custom plan for any subject.
            </p>
          </div>
          <div className="landing-picker-grid">
            {(examples || []).map((p, i) => (
              <article
                key={p.id}
                className={classNames("landing-plan", i % 2 === 0 ? "landing-plan-a" : "landing-plan-b")}
              >
                <div className="landing-plan-meta">{p.totalDays} days · example</div>
                <h3 className="landing-plan-name">{p.name}</h3>
                <p className="landing-plan-sub">{p.subtitle}</p>
                {p.blurb && <p className="landing-plan-blurb">{p.blurb}</p>}
                <button type="button" className="landing-plan-btn" onClick={() => onAddExample(p.id)}>
                  Add plan
                </button>
              </article>
            ))}
          </div>
          <div className="landing-picker-or">
            <span>or</span>
          </div>
          <button type="button" className="landing-cta-ghost landing-picker-custom" onClick={buildCustom}>
            Build a custom plan
          </button>
        </section>
      )}

      {/* 10. Final CTA */}
      {!hasCampaign && (
        <section className="landing-band" aria-labelledby="landing-final-title">
          <div className="landing-band-copy">
            <h2 id="landing-final-title" className="landing-band-title">
              Run the campaign. Keep the rabbit holes.
            </h2>
            <p className="landing-band-lead">
              Create a free account — then pick a plan and open Field Ops.
            </p>
          </div>
          <button type="button" className="landing-cta landing-cta-band" onClick={startAccount}>
            Create free account
          </button>
        </section>
      )}

      {/* 11. Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span>REFRAINLY</span>
          <span className="landing-footer-dot" aria-hidden="true" />
          <span>Field Ops · progress saves automatically</span>
        </div>
        <nav className="landing-footer-nav" aria-label="Footer">
          <button type="button" className="landing-footer-link" onClick={() => scrollToId("pricing")}>
            Pricing
          </button>
          {onOpenKit && (
            <button type="button" className="landing-footer-link" onClick={openFieldKit}>
              Field Kit
            </button>
          )}
          <button type="button" className="landing-footer-link" onClick={onOpenAccount}>
            {accountLabel ? "Account" : "Sign in"}
          </button>
          <a className="landing-footer-link" href="/privacy">
            Privacy
          </a>
          <a className="landing-footer-link" href="/terms">
            Terms
          </a>
        </nav>
        <p className="landing-footer-legal">
          Paid checkout is not live yet. See Privacy and Terms for how accounts and data work today.
        </p>
      </footer>
    </div>
  );
}
