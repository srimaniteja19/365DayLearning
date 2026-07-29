import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Refrainly",
  description: "Terms for using Refrainly learning campaigns and Field Kit.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-inner">
        <p className="legal-kicker">REFRAINLY</p>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: July 29, 2026</p>

        <section className="legal-section">
          <h2>Agreement</h2>
          <p>
            By creating an account or using Refrainly at{" "}
            <a href="https://refrainly.dev">refrainly.dev</a>, you agree to these terms. If you
            do not agree, do not use the service.
          </p>
        </section>

        <section className="legal-section">
          <h2>The service</h2>
          <p>
            Refrainly provides multi-plan learning campaigns, progress tracking, spaced
            repetition, Field Kit notes and bookmarks, and optional AI helpers that run with
            your own provider key. Features may change as the product evolves. Paid plans are
            described on the site as “coming soon” until checkout is enabled.
          </p>
        </section>

        <section className="legal-section">
          <h2>Accounts</h2>
          <p>
            You must provide accurate sign-up information and keep your credentials secure. You
            are responsible for activity under your account. We may suspend or terminate accounts
            that abuse the service, attempt unauthorized access, or violate these terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>Your content</h2>
          <p>
            You retain ownership of notes, plans, and other content you create. You grant us a
            limited license to host and sync that content so the product can function. Do not
            upload unlawful material or content you do not have the right to use.
          </p>
        </section>

        <section className="legal-section">
          <h2>AI and third-party providers</h2>
          <p>
            When you use AI features with a bring-your-own-key setup, requests go to the provider
            you configure (for example OpenRouter). Those providers have their own terms and
            privacy policies. We do not guarantee model output accuracy; treat AI notes and
            quizzes as study aids, not professional advice.
          </p>
        </section>

        <section className="legal-section">
          <h2>Availability and disclaimer</h2>
          <p>
            The service is provided “as is.” We aim for reliability but do not warrant
            uninterrupted access. To the fullest extent permitted by law, we disclaim liability
            for indirect or consequential damages arising from use of the product. Learning
            outcomes depend on your effort and context.
          </p>
        </section>

        <section className="legal-section">
          <h2>Changes</h2>
          <p>
            We may update these terms. Continued use after changes are posted constitutes
            acceptance of the revised terms. Material changes will be reflected in the “Last
            updated” date above.
          </p>
        </section>

        <section className="legal-section">
          <h2>Contact</h2>
          <p>
            Questions about these terms: reach out via the contact channel on{" "}
            <a href="https://refrainly.dev">refrainly.dev</a> or the project repository.
          </p>
        </section>

        <p className="legal-back">
          <Link href="/">← Back to Refrainly</Link>
          {" · "}
          <Link href="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </main>
  );
}
