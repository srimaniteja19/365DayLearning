import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Refrainly",
  description: "How Refrainly handles accounts, learning data, and AI keys.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-inner">
        <p className="legal-kicker">REFRAINLY</p>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: July 29, 2026</p>

        <section className="legal-section">
          <h2>What this covers</h2>
          <p>
            Refrainly is a learning console at{" "}
            <a href="https://refrainly.dev">refrainly.dev</a>. This policy describes what we
            collect when you create an account and use the product.
          </p>
        </section>

        <section className="legal-section">
          <h2>Account information</h2>
          <p>
            When you sign up we store the credentials needed to authenticate you (for example
            email and a hashed password). We use that information to sign you in and sync your
            learning data across devices.
          </p>
        </section>

        <section className="legal-section">
          <h2>Learning data</h2>
          <p>
            Campaigns, progress, notes, spaced-repetition state, Field Kit slips, and bookmarks
            sync to our database when you are signed in so your work follows you. The same data
            may also be stored locally in your browser for offline-friendly use.
          </p>
        </section>

        <section className="legal-section">
          <h2>AI keys (bring-your-own-key)</h2>
          <p>
            If you paste an OpenRouter (or similar) API key in Settings, that key is used from
            your browser to call the provider. By default it stays in memory for the session.
            If you choose “Remember this key on this device,” it is stored only in your browser
            local storage — not in our cloud snapshot. Exports never include credentials.
          </p>
        </section>

        <section className="legal-section">
          <h2>Payments</h2>
          <p>
            Paid checkout is not live yet. We do not collect payment card details on the site
            today. When billing ships, this policy will be updated to describe the processor and
            what billing data we receive.
          </p>
        </section>

        <section className="legal-section">
          <h2>Analytics and cookies</h2>
          <p>
            We use session cookies / storage needed for authentication. We do not sell personal
            information. If we add product analytics later, we will describe them here.
          </p>
        </section>

        <section className="legal-section">
          <h2>Your choices</h2>
          <p>
            You can export your data from the app, clear local data from Settings where available,
            and request account deletion by contacting us. Deleting an account removes associated
            cloud snapshots we control; browser storage on each device may need a local clear.
          </p>
        </section>

        <section className="legal-section">
          <h2>Contact</h2>
          <p>
            Questions about privacy: reach out via the contact channel listed on{" "}
            <a href="https://refrainly.dev">refrainly.dev</a> or the project repository.
          </p>
        </section>

        <p className="legal-back">
          <Link href="/">← Back to Refrainly</Link>
          {" · "}
          <Link href="/terms">Terms of Service</Link>
        </p>
      </div>
    </main>
  );
}
