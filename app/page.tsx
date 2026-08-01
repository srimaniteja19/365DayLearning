import type { Metadata } from "next";
import { auth } from "@/auth";
import { LandingCta } from "@/features/landing/LandingCta";
import { SUBSCRIPTION_TIERS, TIER_ORDER } from "@/lib/subscriptions";
import { LANDING_THEME, themeVars } from "@/theme/themes";
import { classNames } from "@/lib/classNames";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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

const CAMPAIGN_STEPS = [
  { n: "01", title: "Start", copy: "Pick an example campaign or generate a custom plan for any subject." },
  { n: "02", title: "Show up", copy: "Daily Console — list, bento, or spine. Check topics. Write day notes." },
  { n: "03", title: "Get a hand", copy: "Optional quiz, notes, and LinkedIn drafts — with your own AI key." },
  { n: "04", title: "Remember", copy: "Review queue, Weekly recap, and On This Day resurfacing." },
  { n: "05", title: "Catch overflow", copy: "Rabbit holes go to Field Kit — kept, not cluttering the campaign." },
  { n: "06", title: "Progress", copy: "XP, levels, rank, streaks, and badges track the arc." },
];

export default async function HomePage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  const homeStyle = {
    ...themeVars(LANDING_THEME),
    "--sans": "var(--font-inter), sans-serif",
    "--display": "var(--font-space), sans-serif",
    "--mono": "var(--font-jetbrains), ui-monospace, monospace",
  };

  return (
    <div
      className={classNames("app-root", "landing-root", "theme-neo", "is-light")}
      style={homeStyle}
    >
      <div className="landing">
        <header className="landing-nav">
          <div className="landing-brand" aria-label="Refrainly">
            <span className="landing-brand-mark" aria-hidden="true" />
            <span className="landing-brand-text">REFRAINLY</span>
          </div>
          <div className="landing-nav-actions">
            <a className="landing-nav-link" href="#pricing">
              Pricing
            </a>
            <LandingCta
              loggedIn={loggedIn}
              label="Sign in"
              signedInLabel="Go to dashboard →"
              defaultMode="signin"
              className="landing-nav-cta"
            />
          </div>
        </header>

        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-hero-copy">
            <p className="landing-brand-hero">REFRAINLY</p>
            <h1 id="landing-hero-title" className="landing-hero-title">
              Turn any subject into a daily campaign
            </h1>
            <p className="landing-hero-lead">
              Day-by-day plans, real memory, and a Field Kit for every rabbit hole.
            </p>
            <div className="landing-hero-actions">
              <LandingCta
                loggedIn={loggedIn}
                label="Create free account"
                signedInLabel="Go to dashboard"
                defaultMode="signup"
                className="landing-cta"
              />
              <a className="landing-cta-ghost" href="#pricing">
                View pricing
              </a>
            </div>
            <p className="landing-hero-fine">Free Recruit tier · sign in required · syncs across devices</p>
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

        <section className="landing-stats" aria-label="Sample progress">
          {[
            { val: "12", label: "day streak" },
            { val: "1,840", label: "XP" },
            { val: "LV 4", label: "Operator" },
            { val: "Kit", label: "rabbit holes" },
          ].map((tile, i) => (
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

        <section id="how-it-works" className="landing-section landing-loop" aria-labelledby="landing-loop-title">
          <span className="landing-stamp">The loop</span>
          <h2 id="landing-loop-title" className="landing-section-title">
            How a campaign runs
          </h2>
          <p className="landing-section-lead">Six steps. Skim the headlines.</p>
          <ol className="landing-loop-grid">
            {CAMPAIGN_STEPS.map((step) => (
              <li key={step.n} className="landing-loop-step landing-neo-card">
                <div className="landing-loop-step-inner">
                  <span className="landing-loop-num">{step.n}</span>
                  <h3 className="landing-loop-title">{step.title}</h3>
                  <p className="landing-loop-copy">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="field-kit" className="landing-section landing-surfaces" aria-labelledby="landing-surfaces-title">
          <span className="landing-stamp">Two surfaces</span>
          <h2 id="landing-surfaces-title" className="landing-section-title">
            Deck and Field Kit
          </h2>
          <p className="landing-section-lead">
            <strong>Day notes</strong> live inside a campaign day. <strong>Field Kit</strong> is for
            everything else.
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
              <a className="landing-surface-cta landing-ai-link" href="#pricing">
                See plans
              </a>
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-pricing" aria-labelledby="landing-pricing-title">
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
                  )}
                >
                  <span className="landing-price-badge landing-price-badge-live">Live</span>
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
                      {tier.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <LandingCta
                      loggedIn={loggedIn}
                      label={isFree ? "Create free account" : `Get ${tier.rankLabel}`}
                      signedInLabel="Open dashboard"
                      defaultMode="signup"
                      className={isFree ? "landing-cta landing-price-cta" : "landing-surface-cta landing-price-cta"}
                    />
                    {isFree && (
                      <p className="landing-price-fine">Free forever on Recruit · no card for signup</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="trust" className="landing-section landing-trust" aria-labelledby="landing-trust-title">
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

        <section className="landing-band" aria-labelledby="landing-final-title">
          <div className="landing-band-copy">
            <h2 id="landing-final-title" className="landing-band-title">
              Run the campaign. Keep the rabbit holes.
            </h2>
            <p className="landing-band-lead">
              Create a free account — then pick a plan and start day one.
            </p>
          </div>
          <LandingCta
            loggedIn={loggedIn}
            label="Create free account"
            signedInLabel="Go to dashboard"
            defaultMode="signup"
            className="landing-cta landing-cta-band"
          />
        </section>

        <footer className="landing-footer">
          <div className="landing-footer-brand">
            <span>REFRAINLY</span>
            <span className="landing-footer-dot" aria-hidden="true" />
            <span>Progress saves automatically</span>
          </div>
          <nav className="landing-footer-nav" aria-label="Footer">
            <a className="landing-footer-link" href="#pricing">
              Pricing
            </a>
            <LandingCta
              loggedIn={loggedIn}
              label="Sign in"
              signedInLabel="Open dashboard"
              defaultMode="signin"
              className="landing-footer-link"
            />
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
    </div>
  );
}
