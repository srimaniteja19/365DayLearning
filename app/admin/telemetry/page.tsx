import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { gte } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, hasDatabase } from "@/lib/db/client";
import { generationRuns } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/admin";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const WINDOWS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function since(windowMs: number): Date {
  return new Date(Date.now() - windowMs);
}

export default async function AdminTelemetryPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) notFound();
  if (!hasDatabase()) notFound();

  const { window: windowParam } = await searchParams;
  const windowKey = windowParam && WINDOWS[windowParam] ? windowParam : "7d";

  const db = getDb();
  const rows = await db
    .select()
    .from(generationRuns)
    .where(gte(generationRuns.createdAt, since(WINDOWS[windowKey])));

  let totalDays = 0;
  let placeholderDays = 0;
  let totalPeriods = 0;
  let failedPeriods = 0;
  let repairCalls = 0;
  const modelTotals: Record<string, { attempts: number; failures: number }> = {};

  for (const row of rows) {
    totalDays += row.totalDays;
    placeholderDays += row.placeholderDays;
    totalPeriods += row.totalPeriods;
    failedPeriods += row.failedPeriods;
    repairCalls += row.repairCalls;
    const outcomes = row.modelOutcomes as Record<string, { attempts: number; failures: number }>;
    for (const [model, o] of Object.entries(outcomes || {})) {
      const acc = modelTotals[model] ?? { attempts: 0, failures: 0 };
      acc.attempts += o.attempts;
      acc.failures += o.failures;
      modelTotals[model] = acc;
    }
  }

  const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—");

  const modelRows = Object.entries(modelTotals)
    .map(([model, o]) => ({ model, ...o, rate: o.attempts > 0 ? o.failures / o.attempts : 0 }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <main style={{ padding: "2rem", fontFamily: "monospace", maxWidth: 900 }}>
      <h1>Generation telemetry</h1>
      <nav style={{ marginBottom: "1rem" }}>
        {Object.keys(WINDOWS).map((w) => (
          <a key={w} href={`?window=${w}`} style={{ marginRight: "1rem", fontWeight: w === windowKey ? "bold" : "normal" }}>
            {w}
          </a>
        ))}
      </nav>
      <p>{rows.length} generation run(s) in the last {windowKey}.</p>
      <table cellPadding={6} style={{ borderCollapse: "collapse", marginBottom: "2rem" }}>
        <tbody>
          <tr><td>Placeholder-day rate</td><td>{pct(placeholderDays, totalDays)}</td></tr>
          <tr><td>Failed-period rate</td><td>{pct(failedPeriods, totalPeriods)}</td></tr>
          <tr><td>Repair-call rate</td><td>{pct(repairCalls, totalPeriods)}</td></tr>
        </tbody>
      </table>
      <h2>Per-model failure rate (BYOK failover chain)</h2>
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr><th align="left">Model</th><th align="left">Attempts</th><th align="left">Failures</th><th align="left">Rate</th></tr>
        </thead>
        <tbody>
          {modelRows.map((r) => (
            <tr key={r.model}>
              <td>{r.model}</td>
              <td>{r.attempts}</td>
              <td>{r.failures}</td>
              <td>{(r.rate * 100).toFixed(1)}%</td>
            </tr>
          ))}
          {modelRows.length === 0 && (
            <tr><td colSpan={4}>No model outcomes recorded in this window.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
