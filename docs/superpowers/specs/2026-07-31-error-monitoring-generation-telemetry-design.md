# Error monitoring + generation telemetry

## Problem

Two related gaps:

1. **No error monitoring.** All error handling across API routes
   (`app/api/**/route.ts`) is a plain `console.error("[route] context", err)` —
   11 call sites, no structured fields, no way to search/filter beyond raw
   text grep in Vercel's log explorer.
2. **No visibility into plan generation quality.** `generatePlan()`
   (`lib/planGeneration.ts:742`) runs client-side in the browser
   (invoked from `features/planBuilder/PlanBuilder.tsx:136`) and has a
   "never-fail guarantee": it always returns a usable plan, padding any gaps
   with placeholder topics (`placeholderTopic()`, `planGeneration.ts:291`)
   and marking unrecoverable periods as `failedPeriods`
   (`planGeneration.ts:854`) rather than throwing. That guarantee is
   invisible today — there is no way to tell whether it's firing rarely (good)
   or constantly (the curated model lists need retuning, or something
   upstream is broken).

## Important discovery: where the generation logic actually runs

`generatePlan()`, `chatStructured()` (`lib/claude-client.ts:171`), and the
model failover loop inside `chat()` (`lib/claude-client.ts:75`) all run
**client-side in the browser** — there is no server-side entry point that
sees a whole generation run. This shapes the telemetry design: counters must
be collected in the browser during the run and reported to the server in one
summary call at the end, not written to the DB inline from server code.

It also narrows what "per-model failure rate in the failover chain" can mean:
the failover loop over `buildModelFailoverChain()`
(`lib/providers/openrouter.ts:150`) only runs for **BYOK users** (their own
OpenRouter key in Settings). Managed-AI users (paid tier, no BYOK key) go
through `chatManaged()` (`claude-client.ts:35`), which makes exactly one
`fetch("/api/ai")` call to a single server-selected model
(`app/api/ai/route.ts:104`, `process.env.OPENROUTER_MODEL` or
`OPENROUTER_DEFAULT_MODEL`) — there is no chain to fail over across. This is
actually the right scope: the curated model lists
(`OPENROUTER_CURATED_MODELS`, `OPENROUTER_PAID_FAILOVER`,
`lib/providers/openrouter.ts:24,125`) — the thing this telemetry exists to
help tune — are only ever consulted in the BYOK chain. Model-attempt
telemetry is scoped to that chain only.

## Goal

- Standardize error logging into a structured, filterable shape using
  Vercel's built-in log explorer — no new external dependency (Sentry was
  considered and explicitly declined).
- Capture four generation-quality signals as real rates (not raw counts):
  placeholder-day rate, failed-period rate, repair-call rate, and per-model
  failure rate within the BYOK failover chain.
- Surface those rates on a simple internal dashboard page.

## Design

### 1. Structured error logging

New `lib/logError.ts`:

```ts
export function logError(route: string, context: string, err: unknown, extra?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(JSON.stringify({
    level: "error",
    route,
    context,
    message,
    stack,
    ...extra,
    timestamp: new Date().toISOString(),
  }));
}
```

Replace all 11 existing `console.error("[route] context", err)` call sites
(`app/api/ai/route.ts:153`, `app/api/auth/signup/route.ts:65`,
`app/api/state/route.ts:48,143`,
`app/api/subscription/reserve-plan/route.ts:33`,
`app/api/subscription/route.ts:24`,
`app/api/topic-resources/route.ts:242`,
`app/api/webhooks/stripe/route.ts:39,68,83,123`) with `logError(...)` calls.

This is a scoped-down interpretation of "error monitoring" — it makes
Vercel's existing log explorer usable for filtering/searching by route or
context, but it is **not** alerting, grouping, or deduplication. Getting
those would require Sentry or an equivalent SDK, which was explicitly
declined in favor of zero new dependencies. Worth knowing going in.

### 2. Generation telemetry collection (client-side)

A telemetry collector is threaded through a single generation run:

```ts
// lib/generationTelemetry.ts
export type GenerationTelemetry = {
  repairCalls: number;
  modelOutcomes: Record<string, { attempts: number; failures: number }>;
};

export function newTelemetry(): GenerationTelemetry {
  return { repairCalls: 0, modelOutcomes: {} };
}
```

- `chat()`'s BYOK failover loop (`claude-client.ts:97-131`) takes an optional
  `telemetry?: GenerationTelemetry` on its request type and, per attempt,
  increments `modelOutcomes[model].attempts` and, on a failover-worthy
  failure, `modelOutcomes[model].failures`. Not touched on the managed path
  (`chatManaged`) — no chain exists there, per the discovery above.
- `chatStructured()`'s repair closure (`claude-client.ts:181-198`) increments
  `telemetry.repairCalls` each time it's invoked (i.e. each time
  `parseJsonWithRepair`'s `repair` callback fires — `planGeneration.ts:524`).
- `generatePlan()` creates one `GenerationTelemetry` via `newTelemetry()` at
  the top, threads it through every `chatStructured` call it makes
  (`fetchOutline`, `fetchPeriodDays`), and returns it alongside the `Plan` —
  changing `generatePlan`'s return type to
  `Promise<{ plan: Plan; telemetry: GenerationTelemetry }>`. (Only caller is
  `PlanBuilder.tsx:136` — a contained change.)

At the end of a run, `PlanBuilder.tsx` fires a **fire-and-forget**
`POST /api/telemetry/generation` — errors are swallowed
(`.catch(() => {})`), since telemetry must never affect plan generation or
surface an error to the user. Body:

```ts
{
  totalDays: number;        // plan.totalDays
  placeholderDays: number;  // count of days with a "needs review" topic
  totalPeriods: number;     // outline.length
  failedPeriods: number;    // progress.failedPeriods.length
  repairCalls: number;      // telemetry.repairCalls
  modelOutcomes: Record<string, { attempts: number; failures: number }>;
}
```

### 3. Server: `generationRuns` table + endpoint

New table in `lib/db/schema.ts`, following existing conventions (`uuid`
primary key, `timestamp` with timezone, `jsonb` for the model breakdown):

```ts
export const generationRuns = pgTable("generation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  totalDays: integer("total_days").notNull(),
  placeholderDays: integer("placeholder_days").notNull(),
  totalPeriods: integer("total_periods").notNull(),
  failedPeriods: integer("failed_periods").notNull(),
  repairCalls: integer("repair_calls").notNull(),
  modelOutcomes: jsonb("model_outcomes").notNull(),
});
```

`POST /api/telemetry/generation` (`app/api/telemetry/generation/route.ts`),
following `app/api/state/route.ts`'s conventions: requires `hasDatabase()`,
`isSameOrigin(req)`, and a signed-in session (`auth()` → `session.user.id`);
validates the body shape (numbers non-negative, `modelOutcomes` a plain
object of `{attempts, failures}` pairs — reuse the same
manual-narrowing-from-`unknown` style `app/api/state/route.ts` already uses,
no new validation library); inserts one row; returns `{ ok: true }`. No rate
limiting — generation runs are already scarce (gated upstream by AI-action
quotas), and each run produces at most one telemetry POST.

Schema change is applied via `npm run db:push` (this repo has no
`drizzle/migrations` directory — schema changes are pushed directly, per the
existing scripts in `package.json`), not `db:generate`.

### 4. Admin dashboard

New page at `app/admin/telemetry/page.tsx` (server component). Gated by a
new `ADMIN_EMAILS` env var (comma-separated), checked against
`session.user.email` from `auth()` — anyone not on the list gets a 404 (not
a 403, to avoid confirming the route's existence). Add `ADMIN_EMAILS` to
`.env.example` with a comment.

Queries `generationRuns` for a selectable window (last 24h / 7d / 30d,
via a query param, defaulting to 7d) and computes, in the page itself
(no new aggregation library — a handful of `SUM`s):

- Placeholder-day rate: `SUM(placeholderDays) / SUM(totalDays)`
- Failed-period rate: `SUM(failedPeriods) / SUM(totalPeriods)`
- Repair-call rate: `SUM(repairCalls) / SUM(totalPeriods)`
- Per-model failure rate: sum `modelOutcomes` across all rows in JS
  (`attempts`/`failures` per model key), then `failures/attempts` per model,
  sorted worst-first.

Plain HTML table, no charting library — matches "two days including the
dashboard."

## Non-goals

- No Sentry/Bugsnag/equivalent — declined; structured logging into Vercel's
  existing log explorer only.
- No alerting/paging on error thresholds — would need a paid tool or manual
  Vercel Monitoring configuration (dashboard config, not code; out of scope).
- No per-event granular telemetry rows (e.g. one row per placeholder day) —
  one summary row per generation run, per your choice.
- No `isAdmin` DB column / role system — `ADMIN_EMAILS` env var only.
- No telemetry for the managed-AI single-model path's outcome — only the
  BYOK failover chain is instrumented, since that's the only place the
  curated model lists are actually exercised.
- No changes to `generatePlan()`'s retry/placeholder/failover *behavior* —
  purely additive observation of the existing logic.

## Testing

- `lib/generationTelemetry.ts` and the `chat()`/`chatStructured()`
  instrumentation are plain functions — unit-testable the same way
  `lib/claude-client.failover.test.ts` already tests the failover loop
  (mock the chain, assert `modelOutcomes` shape after simulated
  successes/failures).
- `app/api/telemetry/generation/route.ts` is a standard route handler —
  testable the same way other API routes in this repo are (check for
  existing route test patterns during planning; if none exist, manual
  verification via dev server is consistent with the rest of this codebase).
- `app/admin/telemetry/page.tsx` and `PlanBuilder.tsx`'s fire-and-forget call
  are UI — manual verification via dev server (seed a few `generationRuns`
  rows directly via SQL or by running a real generation, then load the
  dashboard page).
