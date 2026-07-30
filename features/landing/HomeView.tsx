// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { classNames } from "@/lib/classNames";
import { SUBSCRIPTION_TIERS, TIER_ORDER } from "@/lib/subscriptions";
import {
  DoodleUnderline,
  DoodleArrow,
  DoodleStar,
  DoodleBullet,
  DoodleCircledNumber,
} from "@/features/landing/doodle-assets";

const CAMPAIGN_STEPS = [
  {
    n: "01",
    title: "Start",
    copy: "Pick an example campaign, or generate a custom plan for any subject — psychology, economics, history, languages, crafts, tech, and more.",
  },
  {
    n: "02",
    title: "Show up",
    copy: "Daily Console — list, bento, or spine. Check topics. Write day notes.",
  },
  {
    n: "03",
    title: "Get a hand",
    copy: "Optional: Quiz me, generate notes, draft a LinkedIn post — with your own AI key.",
  },
  {
    n: "04",
    title: "Remember",
    copy: "Spaced repetition Review queue, Weekly recap, and On This Day resurfacing.",
  },
  {
    n: "05",
    title: "Catch the overflow",
    copy: "Rabbit holes go to Field Kit — not lost, not cluttering the campaign.",
  },
  {
    n: "06",
    title: "Progress",
    copy: "XP, levels, rank, streaks, and badges track the arc.",
  },
];

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
  const pickerRef = useRef(null);
  const reduceMotion = useReducedMotion();

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
          <span className="landing-hero-kicker">Daily learning journal</span>
          <p className="landing-brand-hero">REFRAINLY</p>
          {hasCampaign ? (
            <>
              <h1 id="landing-hero-title" className="landing-hero-title">
                Ready to pick up where you left off?
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
                Turn any subject into a daily learning habit
              </h1>
              <p className="landing-hero-lead">
                A <strong>daily campaign</strong> for any subject — day-by-day plans, real memory,
                and a Field Kit for every rabbit hole.
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
              <span className="landing-viz-op">MY LEARNING LOG</span>
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
            <motion.div
              className="landing-viz-slip landing-viz-slip-a"
              initial={{ rotate: 3 }}
              animate={reduceMotion ? undefined : { rotate: [3, 6, 3], y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              Loss aversion ≠ risk aversion
            </motion.div>
            <motion.div
              className="landing-viz-slip landing-viz-slip-b"
              initial={{ rotate: -4 }}
              animate={reduceMotion ? undefined : { rotate: [-4, -6, -4], x: [0, 4, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              Link · Kahneman ch. 26
            </motion.div>
            <motion.div
              className="landing-viz-slip landing-viz-slip-c"
              initial={{ rotate: 1.5 }}
              animate={reduceMotion ? undefined : { rotate: [1.5, 3.5, 1.5], y: [0, 4, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              Rabbit hole → keep
            </motion.div>
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
        <span className="landing-stamp">The problem</span>
        <h2 id="landing-problem-title" className="landing-section-title">
          Most tools dump content on you — or lock you into one path
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <ul className="landing-problem-list">
          <li>
            <DoodleBullet />
            <span>Content dumps with no finishable structure — or one rigid course you can&apos;t reshape.</span>
          </li>
          <li>
            <DoodleBullet />
            <span>Checkboxes without memory: nothing resurfaces, so yesterday&apos;s topics evaporate.</span>
          </li>
          <li>
            <DoodleBullet />
            <span>
              No clean split between day notes and rabbit holes — tangents either vanish or clutter
              the plan.
            </span>
          </li>
          <li>
            <DoodleBullet />
            <span>AI gated behind a vendor quota before you&apos;ve proven the loop works.</span>
          </li>
        </ul>
      </section>

      {/* 3. How it works */}
      <section
        id="how-it-works"
        className="landing-section landing-loop"
        aria-labelledby="landing-loop-title"
      >
        <span className="landing-stamp">The loop</span>
        <h2 id="landing-loop-title" className="landing-section-title">
          How a campaign runs
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <p className="landing-section-lead">Six steps. Skim the headlines — that&apos;s the loop.</p>
        <ol className="landing-loop-grid">
          {CAMPAIGN_STEPS.map((step, i) => (
            <motion.li
              key={step.n}
              className="landing-loop-step landing-doodle-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="landing-loop-step-inner">
                <DoodleCircledNumber n={step.n} />
                <h3 className="landing-loop-title">{step.title}</h3>
                <p className="landing-loop-copy">{step.copy}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* 4. Surfaces */}
      <section
        id="field-kit"
        className="landing-section landing-surfaces"
        aria-labelledby="landing-surfaces-title"
      >
        <span className="landing-stamp">Two notebooks</span>
        <h2 id="landing-surfaces-title" className="landing-section-title">
          Two notebooks. One home base.
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <p className="landing-section-lead landing-surfaces-callout">
          <strong>Day notes</strong> live inside a campaign day.{" "}
          <strong>Field Kit notes</strong> are for everything else — talks, tools, tips, and rabbit
          holes that don&apos;t belong to any single day. Same words, different jobs.
        </p>
        <div className="landing-surfaces-grid">
          <article className="landing-surface landing-surface-deck landing-doodle-card">
            <div className="landing-surface-inner">
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
            </div>
          </article>
          <article className="landing-surface landing-surface-kit landing-doodle-card">
            <div className="landing-surface-inner">
              <span className="landing-surface-stamp">Kit</span>
              <h3 className="landing-surface-title">Field Kit</h3>
              <p className="landing-surface-copy">
                Independent of any campaign. Always one click away — even before you start a plan.
              </p>
              <ul className="landing-surface-list">
                <li>
                  <strong>Notes</strong> — date-keyed slips, Chrono filters, tags (talk / paper /
                  tool / tip / course / other)
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
            </div>
          </article>
        </div>
      </section>

      {/* 5. AI */}
      <section
        id="ai"
        className="landing-section landing-ai"
        aria-labelledby="landing-ai-title"
      >
        <span className="landing-stamp">AI, your way</span>
        <h2 id="landing-ai-title" className="landing-section-title">
          Bring your own key. Keep the loop free.
        </h2>
        <DoodleUnderline className="landing-section-underline" />
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
        <DoodleUnderline className="landing-section-underline" />
        <p className="landing-section-lead">
          Tier names match XP ranks (Recruit / Operator / Architect). Paid plans check out monthly
          via Stripe — manage invoices and cancel anytime in the billing portal. An account is
          required to run campaigns and Field Kit.
        </p>

        <div className="landing-pricing-grid">
          {TIER_ORDER.map((id) => {
            const tier = SUBSCRIPTION_TIERS[id];
            const isFree = tier.priceMonthlyUsd === 0;
            return (
              <article
                key={id}
                className={classNames(
                  "landing-price-card",
                  `landing-price-card-${id}`,
                  isFree && "landing-price-card-free",
                  tier.comingSoon && "landing-price-card-soon",
                  "landing-doodle-card",
                )}
              >
                {isFree && <DoodleStar className="landing-price-star" />}
                {tier.comingSoon ? (
                  <span className="landing-price-badge">Coming soon</span>
                ) : (
                  <span className="landing-price-badge landing-price-badge-live">Live</span>
                )}
                <div className="landing-price-card-inner">
                  <h3 className="landing-price-rank">{tier.rankLabel}</h3>
                  <div className="landing-price-amount">
                    {isFree ? (
                      <>$0</>
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
                      {`Get ${tier.rankLabel}`}
                    </button>
                  )}
                  {isFree && (
                    <p className="landing-price-fine">Free forever on Recruit · no card for signup</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="landing-pricing-note">
          Prefer the in-app panel?{" "}
          <button type="button" className="landing-text-btn" onClick={onOpenPricing}>
            Open Plans
          </button>
          . All paid plans are billed monthly.
        </p>
      </section>

      {/* 7. Trust */}
      <section
        id="trust"
        className="landing-section landing-trust"
        aria-labelledby="landing-trust-title"
      >
        <span className="landing-stamp">The fine print</span>
        <h2 id="landing-trust-title" className="landing-section-title">
          Your data, spelled out
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <div className="landing-trust-grid">
          <article className="landing-trust-card landing-doodle-card">
            <h3>Account required</h3>
            <p>
              Sign up to run campaigns and Field Kit. Your plans, progress, notes, review state,
              learned slips, and bookmarks belong to your account.
            </p>
          </article>
          <article className="landing-trust-card landing-doodle-card">
            <h3>Cloud sync</h3>
            <p>
              Signed-in sessions sync the full snapshot across devices — so a long campaign can
              follow you from laptop to phone without starting over.
            </p>
          </article>
          <article className="landing-trust-card landing-doodle-card">
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
        <span className="landing-stamp">Who it&apos;s for</span>
        <h2 id="landing-audience-title" className="landing-section-title">
          Who it&apos;s for
        </h2>
        <DoodleUnderline className="landing-section-underline" />
        <div className="landing-audience-grid">
          <div className="landing-audience-for">
            <h3 className="landing-audience-label">For</h3>
            <ul>
              <li>
                <DoodleBullet />
                <span>
                  Anyone running a serious self-study arc — psychology, economics, history,
                  languages, arts, sciences, trades, tech, or something you invent yourself
                </span>
              </li>
              <li>
                <DoodleBullet />
                <span>People who want structure + recall + a place for messy off-plan learning</span>
              </li>
            </ul>
          </div>
          <div className="landing-audience-not">
            <h3 className="landing-audience-label">Not for</h3>
            <ul>
              <li>
                <DoodleBullet className="landing-li-bullet-not" />
                <span>Not a Coursera-style course platform — you build (or generate) the curriculum</span>
              </li>
              <li>
                <DoodleBullet className="landing-li-bullet-not" />
                <span>Not a Notion template</span>
              </li>
              <li>
                <DoodleBullet className="landing-li-bullet-not" />
                <span>Not a generic habit tracker</span>
              </li>
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
          <DoodleArrow className="landing-band-arrow" direction="down" />
          <div className="landing-band-copy">
            <h2 id="landing-final-title" className="landing-band-title">
              Run the campaign. Keep the rabbit holes.
            </h2>
            <p className="landing-band-lead">
              Create a free account — then pick a plan and start day one.
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
          <span>Progress saves automatically</span>
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
          Paid plans checkout via Stripe. See Privacy and Terms for accounts, data, and billing.
        </p>
      </footer>
    </div>
  );
}
