"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { classNames } from "@/lib/classNames";
import { SUBSCRIPTION_TIERS, TIER_ORDER } from "@/lib/subscriptions";
import type { Plan } from "@/lib/types";

const CAMPAIGN_STEPS = [
  {
    n: "01",
    title: "Start",
    copy: "Pick an example campaign or generate a custom plan for any subject.",
  },
  {
    n: "02",
    title: "Show up",
    copy: "Daily Console — list, bento, or spine. Check topics. Write day notes.",
  },
  {
    n: "03",
    title: "Get a hand",
    copy: "Optional quiz, notes, and LinkedIn drafts — with your own AI key.",
  },
  {
    n: "04",
    title: "Remember",
    copy: "Review queue, Weekly recap, and On This Day resurfacing.",
  },
  {
    n: "05",
    title: "Catch overflow",
    copy: "Rabbit holes go to Field Kit — kept, not cluttering the campaign.",
  },
  {
    n: "06",
    title: "Progress",
    copy: "XP, levels, rank, streaks, and badges track the arc.",
  },
];

const CLAIMS = [
  {
    stamp: "Structure",
    title: "Finishable campaigns",
    copy: "Day-by-day plans you can run, reshape, or generate — not an endless content dump.",
  },
  {
    stamp: "Memory",
    title: "Topics that come back",
    copy: "Spaced repetition Review, Weekly recap, and On This Day so yesterday does not evaporate.",
  },
  {
    stamp: "Overflow",
    title: "Rabbit holes have a home",
    copy: "Field Kit holds talks, tools, tips, and tangents — separate from the day’s campaign notes.",
  },
];

const FAQS = [
  {
    q: "Do I need to pay for an AI subscription?",
    a: "No. The free Recruit tier includes full multi-plan campaigns, spaced repetition, day notes, bookmarks, and BYOK AI (paste your OpenRouter API key in Settings). Paid tiers (Operator and Architect) add managed server-side AI quotas if you don't use your own key.",
  },
  {
    q: "How does cloud sync work?",
    a: "Sign in with Google or email/password. Refrainly saves your snapshot (plans, progress, notes, SRS, journal) in Neon Postgres and keeps all your devices in step.",
  },
  {
    q: "Where is my API key stored?",
    a: "Keys stay in tab memory by default. If you enable 'Remember key on this device', it is saved in browser localStorage only — never to Neon or backups.",
  },
  {
    q: "Can I export my learning history?",
    a: "Yes. Export markdown study notes, export a full JSON backup snapshot, or share individual plans.",
  },
];

function scrollToId(id: string) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export type HomeViewProps = {
  hasCampaign?: boolean;
  summary?: {
    name: string;
    streak: number;
    xp: number;
    level: number;
    rank: string;
    daysComplete: number;
    totalDays: number;
  } | null;
  examples?: Plan[];
  onAddExample?: (plan: Plan) => void;
  onOpenBuilder?: () => void;
  onOpenAccount?: () => void;
  accountLabel?: string;
  onRequireAuth?: (onAuthenticated?: () => void) => void;
  onStartWithAccount?: (onAuthenticated?: () => void) => void;
  onGoDashboard?: () => void;
  onOpenPricing?: () => void;
  onOpenKit?: (tab?: string) => void;
  learnedCount?: number;
  bookmarkCount?: number;
};

/**
 * Marketing landing + cold-start plan picker.
 * Neobrutalism poster stack. Primary CTA requires sign-in / sign-up.
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
}: HomeViewProps) {
  const [started, setStarted] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (started && pickerRef.current) {
      pickerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [started]);

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

  const proofTiles = hasCampaign && summary
    ? [
        { val: String(summary.streak), label: "day streak" },
        { val: summary.xp.toLocaleString(), label: "XP" },
        { val: `LV ${summary.level}`, label: summary.rank },
        { val: `${summary.daysComplete}/${summary.totalDays}`, label: "days" },
      ]
    : [
        { val: "12", label: "day streak" },
        { val: "1,840", label: "XP" },
        { val: "LV 4", label: "Operator" },
        { val: "Kit", label: "rabbit holes" },
      ];

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

      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero-copy">
          <p className="landing-brand-hero">REFRAINLY</p>
          {hasCampaign ? (
            <>
              <h1 id="landing-hero-title" className="landing-hero-title">
                Pick up where you left off
              </h1>
              <p className="landing-hero-lead">
                Continue <strong>{summary?.name || "Campaign"}</strong> — {summary?.daysComplete ?? 0} of{" "}
                {summary?.totalDays ?? 0} days done.
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
                Turn any subject into a daily campaign
              </h1>
              <p className="landing-hero-lead">
                Day-by-day plans, real memory, and a Field Kit for every rabbit hole.
              </p>
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
              <span className="landing-viz-op">NEXT DISPATCH</span>
              <span className="landing-viz-live">DAY 012</span>
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
        </div>
      </section>

      <section className="landing-stats" aria-label={hasCampaign ? "Your progress" : "Sample progress"}>
        {proofTiles.map((tile, i) => (
          <div key={tile.label} className="landing-stat" style={{ "--i": i } as React.CSSProperties}>
            <span className="landing-stat-val">{tile.val}</span>
            <span className="landing-stat-label">{tile.label}</span>
          </div>
        ))}
      </section>

      <section className="landing-section landing-claims" aria-labelledby="landing-claims-title">
        <span className="landing-stamp">What it is</span>
        <h2 id="landing-claims-title" className="landing-section-title">
          Structure. Memory. Overflow.
        </h2>
        <p className="landing-section-lead">
          One campaign loop — not a course warehouse, not a blank notes app.
        </p>
        <div className="landing-claims-grid">
          {CLAIMS.map((c) => (
            <article key={c.stamp} className="landing-neo-card landing-claim">
              <span className="landing-claim-stamp">{c.stamp}</span>
              <h3 className="landing-claim-title">{c.title}</h3>
              <p className="landing-claim-copy">{c.copy}</p>
            </article>
          ))}
        </div>
        <p className="landing-claims-footnote">
          Not a Coursera clone. Not a Notion template. Not a generic habit tracker.
        </p>
      </section>

      <section
        id="how-it-works"
        className="landing-section landing-loop"
        aria-labelledby="landing-loop-title"
      >
        <span className="landing-stamp">The loop</span>
        <h2 id="landing-loop-title" className="landing-section-title">
          How a campaign runs
        </h2>
        <p className="landing-section-lead">Six steps. Skim the headlines.</p>
        <ol className="landing-loop-grid">
          {CAMPAIGN_STEPS.map((step, i) => (
            <motion.li
              key={step.n}
              className="landing-loop-step landing-neo-card"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="landing-loop-step-inner">
                <span className="landing-loop-num">{step.n}</span>
                <h3 className="landing-loop-title">{step.title}</h3>
                <p className="landing-loop-copy">{step.copy}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      <section
        id="field-kit"
        className="landing-section landing-surfaces"
        aria-labelledby="landing-surfaces-title"
      >
        <span className="landing-stamp">Two surfaces</span>
        <h2 id="landing-surfaces-title" className="landing-section-title">
          Deck and Field Kit
        </h2>
        <p className="landing-section-lead">
          <strong>Day notes</strong> live inside a campaign day.{" "}
          <strong>Field Kit</strong> is for everything else.
        </p>
        <div className="landing-surfaces-grid">
          <article className="landing-surface landing-surface-deck landing-neo-card">
            <div className="landing-surface-bar landing-surface-bar-yellow">Deck</div>
            <div className="landing-surface-inner">
              <h3 className="landing-surface-title">Campaign Deck</h3>
              <p className="landing-surface-copy">
                Active plan hero, filters, and views — Console, Grid, Review, Weekly, Analytics.
              </p>
              <ul className="landing-surface-list">
                <li>Topic clears + day notes</li>
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
          <article className="landing-surface landing-surface-kit landing-neo-card">
            <div className="landing-surface-bar landing-surface-bar-violet">Kit</div>
            <div className="landing-surface-inner">
              <h3 className="landing-surface-title">Field Kit</h3>
              <p className="landing-surface-copy">
                Independent of any campaign. Always one click away — even before you start a plan.
              </p>
              <ul className="landing-surface-list">
                <li>
                  <strong>Notes</strong> — date-keyed slips, Chrono, tags
                </li>
                <li>
                  <strong>Bookmarks</strong> — video, articles, repos, docs
                </li>
                <li>
                  <strong>Lens</strong> — search across both
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

      <section id="ai" className="landing-section landing-ai" aria-labelledby="landing-ai-title">
        <span className="landing-stamp">AI</span>
        <h2 id="landing-ai-title" className="landing-section-title">
          Start with managed AI. Bring your own key anytime.
        </h2>
        <div className="landing-ai-grid">
          <div className="landing-ai-card landing-ai-card-main landing-neo-card">
            <h3 className="landing-ai-card-title">Recruit · managed trial + BYOK</h3>
            <p className="landing-ai-card-copy">
              Start with 1 managed plan generation up to 90 days and 10 managed AI actions — no
              key required. Add your own key anytime for unlimited use on your credits.
            </p>
            <ul className="landing-ai-list">
              <li>Key stays in memory by default</li>
              <li>Optional remember-on-device</li>
              <li>Managed trial is lifetime, not monthly</li>
            </ul>
          </div>
          <div className="landing-ai-card landing-neo-card">
            <h3 className="landing-ai-card-title">Managed AI · live</h3>
            <p className="landing-ai-card-copy">
              Operator and Architect include larger monthly managed quotas. Paid tiers keep BYOK too.
            </p>
            <button
              type="button"
              className="landing-surface-cta landing-ai-link"
              onClick={() => scrollToId("pricing")}
            >
              See plans
            </button>
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="landing-section landing-pricing"
        aria-labelledby="landing-pricing-title"
      >
        <span className="landing-stamp">Pricing</span>
        <h2 id="landing-pricing-title" className="landing-section-title">
          Start free. Upgrade with Stripe.
        </h2>
        <p className="landing-section-lead">
          Recruit / Operator / Architect. Paid plans bill monthly via Stripe — cancel anytime in the
          portal.
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
                  "landing-neo-card",
                  `landing-price-card-${id}`,
                  isFree && "landing-price-card-free",
                  tier.comingSoon && "landing-price-card-soon",
                )}
              >
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
                        <li>1 managed plan (up to 90 days) + 10 actions, lifetime</li>
                        <li>Bring-your-own-key AI, unlimited</li>
                        <li>1 active campaign · manual resource generation</li>
                        <li>Cloud sync · export / import</li>
                        <li>Multi-plan switcher, themes, badges</li>
                      </>
                    ) : id === "operator" ? (
                      <>
                        <li>Everything in Recruit</li>
                        <li>Managed AI — 3 plan gens + 150 actions / month</li>
                        <li>3 active campaigns · up to 365 days</li>
                        <li>Automatic resource enrichment · faster generation</li>
                        <li>No key required for those quotas</li>
                        <li>BYOK remains available</li>
                        <li>Stripe checkout · billing portal</li>
                      </>
                    ) : (
                      <>
                        <li>Everything in Operator</li>
                        <li>Managed AI — 5 plan gens + 400 actions / month</li>
                        <li>Unlimited campaigns · up to 730 days</li>
                        <li>Automatic resource enrichment · fastest generation</li>
                        <li>Highest managed allowance</li>
                        <li>BYOK remains available</li>
                        <li>Stripe checkout · billing portal</li>
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
          <article className="landing-trust-card landing-neo-card">
            <h3>Account required</h3>
            <p>
              Sign up to run campaigns and Field Kit. Plans, progress, notes, review state, and
              bookmarks belong to your account.
            </p>
          </article>
          <article className="landing-trust-card landing-neo-card">
            <h3>Cloud sync</h3>
            <p>
              Signed-in sessions sync the full snapshot across devices — laptop to phone without
              starting over.
            </p>
          </article>
          <article className="landing-trust-card landing-neo-card">
            <h3>Export · import</h3>
            <p>
              Export markdown notes, a full backup, or a plan-only share file. Import supports{" "}
              <strong>merge</strong> or <strong>replace</strong>. Exports never include AI keys.
            </p>
          </article>
        </div>
      </section>

      {(started || hasCampaign) && (
        <section className="landing-picker" ref={pickerRef} id="start">
          <div className="landing-picker-head">
            <h2 className="landing-picker-title">
              {hasCampaign ? "Add a campaign" : "Start your first campaign"}
            </h2>
            <p className="landing-picker-lead">
              Start with an example — or build a custom plan for any subject.
            </p>
          </div>
          <div className="landing-picker-grid">
            {(examples || []).map((p, i) => (
              <article
                key={p.id}
                className={classNames(
                  "landing-plan",
                  "landing-neo-card",
                  i % 2 === 0 ? "landing-plan-a" : "landing-plan-b",
                )}
              >
                <div className="landing-plan-meta">{p.totalDays} days · example</div>
                <h3 className="landing-plan-name">{p.name}</h3>
                <p className="landing-plan-sub">{p.subtitle}</p>
                {(p as unknown as { blurb?: string }).blurb && (
                  <p className="landing-plan-blurb">{(p as unknown as { blurb?: string }).blurb}</p>
                )}
                <button type="button" className="landing-plan-btn" onClick={() => onAddExample?.(p)}>
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

      <section className="landing-faq" aria-labelledby="landing-faq-title">
        <div className="landing-section-head">
          <span className="landing-kicker">Questions & Answers</span>
          <h2 id="landing-faq-title" className="landing-section-title">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="landing-faq-grid">
          {FAQS.map((faq, idx) => (
            <article key={idx} className="landing-faq-card">
              <h3 className="landing-faq-q">{faq.q}</h3>
              <p className="landing-faq-a">{faq.a}</p>
            </article>
          ))}
        </div>
      </section>

      {!hasCampaign && (
        <section className="landing-band" aria-labelledby="landing-final-title">
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
