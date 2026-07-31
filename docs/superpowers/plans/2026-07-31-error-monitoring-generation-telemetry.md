# Error Monitoring + Generation Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize error logging into a structured, filterable shape (Vercel Observability, no new dependency), and capture four generation-quality rates — placeholder-day, failed-period, repair-call, and per-model failure (BYOK failover chain only) — via a client-collected telemetry summary reported to a new DB table, visible on a simple internal dashboard.

**Architecture:** Four independent-ish layers, built bottom-up: (1) a structured logging helper swapped into 11 existing call sites, (2) a client-side telemetry collector threaded through the existing generation call chain, (3) a server table + endpoint to receive one summary row per generation run, (4) an admin-gated dashboard page reading aggregates from that table.

**Tech Stack:** Next.js App Router route handlers, Drizzle ORM (Neon Postgres, schema-push workflow — no migration files in this repo), Vitest for unit tests, NextAuth `auth()` for session checks.

## Global Constraints

- No new external dependency (Sentry declined) — structured `console.error` JSON only.
- `generatePlan()`'s public behavior (retries, placeholders, failover) does not change — this is purely additive observation.
- Model-attempt telemetry covers only the BYOK failover chain in `chat()` (`lib/claude-client.ts`) — the managed-AI single-model path (`chatManaged`) is not instrumented, since it has no chain and doesn't consult the curated model lists.
- The telemetry POST from the client is fire-and-forget: network/validation failures there must never surface to the user or block plan generation.
- Schema changes are applied via `npm run db:push` (no `drizzle/migrations` directory exists in this repo).
- Admin dashboard access: `ADMIN_EMAILS` env var (comma-separated), checked against `session.user.email`; unauthorized requests get `notFound()` (404), not 403.
- No test file exists for any route handler in this repo today (`app/api/**/route.ts`) — the new endpoint follows that precedent; verify it manually via dev server, not with a new test file.

---

### Task 1: Structured error logging helper

**Files:**
- Create: `lib/logError.ts`
- Modify: `app/api/ai/route.ts:153`, `app/api/auth/signup/route.ts:65`, `app/api/state/route.ts:48,143`, `app/api/subscription/reserve-plan/route.ts:33`, `app/api/subscription/route.ts:24`, `app/api/topic-resources/route.ts:242`, `app/api/webhooks/stripe/route.ts:39,68,83,123`
- Test: `lib/logError.test.ts`

**Interfaces:**
- Produces: `logError(route: string, context: string, err: unknown, extra?: Record<string, unknown>): void`, exported from `lib/logError.ts`. Every later task in this plan that logs an error (Task 3's endpoint) uses this.

- [ ] **Step 1: Write the failing test**

```ts
// lib/logError.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { logError } from "@/lib/logError";

describe("logError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a single structured JSON line with route, context, message, and timestamp", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("api/test", "doing thing", new Error("boom"));
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("error");
    expect(parsed.route).toBe("api/test");
    expect(parsed.context).toBe("doing thing");
    expect(parsed.message).toBe("boom");
    expect(typeof parsed.stack).toBe("string");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("stringifies non-Error values and omits stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("api/test", "doing thing", "plain string error");
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.message).toBe("plain string error");
    expect(parsed.stack).toBeUndefined();
  });

  it("merges extra fields into the logged object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("api/test", "doing thing", new Error("boom"), { userId: "u1" });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.userId).toBe("u1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/logError.test.ts`
Expected: FAIL — `Cannot find module '@/lib/logError'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/logError.ts
export function logError(
  route: string,
  context: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      route,
      context,
      message,
      stack,
      ...extra,
      timestamp: new Date().toISOString(),
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/logError.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Replace the 11 existing call sites**

Each site currently looks like `console.error("[api/xyz] context", err);`. Replace with
`logError("api/xyz", "context", err);`, preserving the route/context text
that was in the original bracketed string (split it into the two
arguments). Add `import { logError } from "@/lib/logError";` to each file
that doesn't already import something from `@/lib/logError`.

Concretely:
- `app/api/ai/route.ts:153` — read the existing line first; convert its
  `console.error("[api/ai] <context>", err)` call to
  `logError("api/ai", "<context>", err)`.
- `app/api/auth/signup/route.ts:65` — same pattern, route `"api/auth/signup"`.
- `app/api/state/route.ts:48` (GET handler) and `:143` (PUT handler) — route
  `"api/state"`, contexts `"GET failed"` and `"PUT failed"` respectively
  (matches current bracketed text).
- `app/api/subscription/reserve-plan/route.ts:33` — route
  `"api/subscription/reserve-plan"`.
- `app/api/subscription/route.ts:24` — route `"api/subscription"`.
- `app/api/topic-resources/route.ts:242` — route `"api/topic-resources"`.
- `app/api/webhooks/stripe/route.ts:39,68,83,123` — route
  `"api/webhooks/stripe"`, four different contexts — read each call site to
  preserve its existing context text.

Do not change any control flow, response shape, or status codes — only the
logging call itself.

- [ ] **Step 6: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add lib/logError.ts lib/logError.test.ts app/api/ai/route.ts app/api/auth/signup/route.ts app/api/state/route.ts app/api/subscription/reserve-plan/route.ts app/api/subscription/route.ts app/api/topic-resources/route.ts app/api/webhooks/stripe/route.ts
git commit -m "$(cat <<'EOF'
Add structured error logging helper, wire into all API routes

Replaces plain console.error("[route] context", err) with a single
JSON line (route, context, message, stack, timestamp) so Vercel's
log explorer can filter by field instead of free-text grep. No new
dependency — Sentry was considered and declined.
EOF
)"
```

---

### Task 2: Generation telemetry collector + failover-chain instrumentation

**Files:**
- Create: `lib/generationTelemetry.ts`
- Modify: `lib/claude-client.ts`
- Test: `lib/generationTelemetry.test.ts`, and extend `lib/claude-client.failover.test.ts`

**Interfaces:**
- Consumes: nothing new — this task only adds a new type/function and wires it through `chat()`/`chatStructured()`'s existing internals.
- Produces:
  - `GenerationTelemetry` type and `newTelemetry(): GenerationTelemetry` from `lib/generationTelemetry.ts`:
    ```ts
    export type GenerationTelemetry = {
      repairCalls: number;
      modelOutcomes: Record<string, { attempts: number; failures: number }>;
    };
    export function newTelemetry(): GenerationTelemetry {
      return { repairCalls: 0, modelOutcomes: {} };
    }
    ```
  - `chat()`'s parameter type gains an optional `telemetry?: GenerationTelemetry` field.
  - `chatStructured()`'s `ChatStructuredOpts<T>` gains an optional
    `telemetry?: GenerationTelemetry` field, forwarded to both its `chat()`
    calls (initial + repair).
  - Task 3 relies on: `newTelemetry()`, the `GenerationTelemetry` type, and
    the fact that `chat`/`chatStructured` mutate a passed-in telemetry
    object in place (not return a new one).

- [ ] **Step 1: Write the failing test for the collector**

```ts
// lib/generationTelemetry.test.ts
import { describe, expect, it } from "vitest";
import { newTelemetry } from "@/lib/generationTelemetry";

describe("newTelemetry", () => {
  it("starts with zero repair calls and no model outcomes", () => {
    const t = newTelemetry();
    expect(t.repairCalls).toBe(0);
    expect(t.modelOutcomes).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/generationTelemetry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/generationTelemetry.ts`**

```ts
export type GenerationTelemetry = {
  repairCalls: number;
  modelOutcomes: Record<string, { attempts: number; failures: number }>;
};

export function newTelemetry(): GenerationTelemetry {
  return { repairCalls: 0, modelOutcomes: {} };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/generationTelemetry.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire `telemetry` through `chat()`'s BYOK failover loop**

In `lib/claude-client.ts`, add the import:

```ts
import type { GenerationTelemetry } from "@/lib/generationTelemetry";
```

Change `chat()`'s parameter type (currently
`Omit<ChatRequest, "prompt"> & { prompt: string; kind?: ChatKind }`) to also
allow `telemetry?: GenerationTelemetry`:

```ts
export async function chat(
  req: Omit<ChatRequest, "prompt"> & { prompt: string; kind?: ChatKind; telemetry?: GenerationTelemetry },
): Promise<string> {
```

Inside the BYOK loop (the `for (const model of chain)` block, currently
around lines 97-131), record an attempt before the `try`, and a failure
inside the `catch` when the error is failover-worthy — but only reachable
code paths that already exist. Read the current loop body first (it starts
`for (const model of chain) { if (skipFree...) continue; if (req.signal...) throw...; try { ... return text; } catch (err) { ... } }`)
and insert telemetry bookkeeping without changing any control flow:

```ts
  for (const model of chain) {
    if (skipFree && isFreeModelId(model)) continue;
    if (req.signal?.aborted) {
      throw req.signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    if (req.telemetry) {
      const outcome = req.telemetry.modelOutcomes[model] ?? { attempts: 0, failures: 0 };
      outcome.attempts += 1;
      req.telemetry.modelOutcomes[model] = outcome;
    }

    try {
      const text = await provider.chat(/* ...unchanged... */);
      if (model !== primary) {
        setSessionPreferredModel(model);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (err instanceof AuthError) throw err;
      if (!isFailoverWorthyError(err)) throw err;

      if (req.telemetry) {
        const outcome = req.telemetry.modelOutcomes[model];
        if (outcome) outcome.failures += 1;
      }

      if (shouldSkipRemainingFreeModels(err)) {
        skipFree = true;
      }
    }
  }
```

Note: a non-failover-worthy error (`throw err` before reaching the
telemetry-failure line) is intentionally *not* counted as a failure here —
`isFailoverWorthyError` gates whether the chain even continues, and an
attempt that threw something the chain doesn't retry on (e.g. an
`AuthError`) isn't a signal about the *model's* reliability, it's a
config/auth problem. This matches the design's framing: the rate exists to
tune the curated model list, which only cares about failover-worthy
failures.

Do not add telemetry recording to `chatManaged()` — per the design, the
managed-AI single-model path has no chain and isn't instrumented.

- [ ] **Step 6: Wire `telemetry` through `chatStructured()`'s repair path**

In `ChatStructuredOpts<T>`, add `telemetry?: GenerationTelemetry`. In
`chatStructured()`, forward `opts.telemetry` on both `chat()` calls (the
initial one and the one inside the repair closure), and increment
`repairCalls` at the point the repair closure is invoked:

```ts
export async function chatStructured<T>(opts: ChatStructuredOpts<T>): Promise<T> {
  const raw = await chat({
    system: opts.system,
    prompt: opts.prompt,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    signal: opts.signal,
    kind: opts.kind,
    structured: opts.structured,
    telemetry: opts.telemetry,
  });
  return opts.parse(raw, opts.schema, async (error, bad) => {
    if (opts.telemetry) opts.telemetry.repairCalls += 1;
    const repairPrompt =
      opts.repairPrompt?.(error, bad) ||
      `Fix this into valid JSON matching the required schema.
Parser error: ${error}
Broken input:
${bad.slice(0, 8000)}
Return corrected JSON only. No markdown.`;
    return chat({
      system: "You repair malformed JSON. Return only the corrected JSON object.",
      prompt: repairPrompt,
      maxTokens: Math.min(opts.maxTokens, 4000),
      temperature: 0,
      signal: opts.signal,
      kind: opts.kind,
      structured: opts.structured,
      telemetry: opts.telemetry,
    });
  });
}
```

- [ ] **Step 7: Add failover-chain telemetry tests**

Append to `lib/claude-client.failover.test.ts` (reuses the existing
`vi.stubGlobal("fetch", ...)` mocking pattern already in that file — read
the file first for the exact mock-response shape it expects):

```ts
  it("records per-model attempt and failure counts on telemetry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || "{}")) as { model?: string };
        const model = body.model || "";
        if (model.endsWith(":free") || model === "openrouter/free") {
          return {
            ok: false,
            status: 429,
            headers: { get: () => null },
            text: async () =>
              JSON.stringify({
                error: { message: "Rate limit exceeded: free-models-per-day. Add 10 credits", code: 429 },
              }),
            clone() {
              return this;
            },
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => JSON.stringify({ choices: [{ message: { content: "ok-from-paid" } }] }),
          clone() {
            return this;
          },
        };
      }),
    );

    const { newTelemetry } = await import("@/lib/generationTelemetry");
    const telemetry = newTelemetry();
    await chat({ prompt: "hi", maxTokens: 5, telemetry });

    expect(telemetry.modelOutcomes["openrouter/free"]).toEqual({ attempts: 1, failures: 1 });
    expect(telemetry.modelOutcomes["deepseek/deepseek-v4-flash"]).toEqual({ attempts: 1, failures: 0 });
  });

  it("does not record telemetry for non-failover-worthy errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        headers: { get: () => null },
        text: async () => "unauthorized",
        clone() {
          return this;
        },
      })),
    );

    const { newTelemetry } = await import("@/lib/generationTelemetry");
    const telemetry = newTelemetry();
    await expect(chat({ prompt: "hi", maxTokens: 5, telemetry })).rejects.toBeInstanceOf(AuthError);
    expect(telemetry.modelOutcomes["openrouter/free"]).toEqual({ attempts: 1, failures: 0 });
  });
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run lib/generationTelemetry.test.ts lib/claude-client.failover.test.ts`
Expected: PASS (all tests, including the 2 pre-existing ones in the failover file).

- [ ] **Step 9: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add lib/generationTelemetry.ts lib/generationTelemetry.test.ts lib/claude-client.ts lib/claude-client.failover.test.ts
git commit -m "$(cat <<'EOF'
Add generation telemetry collector, wire into BYOK failover chain

Threads an optional GenerationTelemetry object through chat()'s
model-failover loop and chatStructured()'s repair path, recording
per-model attempt/failure counts and repair-call counts. Scoped to
the BYOK chain only — the managed-AI single-model path has no chain
and doesn't consult the curated model lists this exists to help tune.
EOF
)"
```

---

### Task 3: `generationRuns` table + telemetry endpoint

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `app/api/telemetry/generation/route.ts`

**Interfaces:**
- Consumes: `logError` (Task 1), `hasDatabase`/`getDb` (`lib/db/client.ts`), `isSameOrigin` (`lib/httpGuard.ts`), `auth` (`@/auth`), `generationRuns` (this task's own schema addition).
- Produces: `generationRuns` Drizzle table (used by Task 4's dashboard
  queries); `POST /api/telemetry/generation` endpoint accepting
  `{ totalDays, placeholderDays, totalPeriods, failedPeriods, repairCalls, modelOutcomes }`
  and returning `{ ok: true }` on success.

- [ ] **Step 1: Add the `generationRuns` table**

In `lib/db/schema.ts`, add (after the existing `users` table, so the
`references(() => users.id)` below it resolves):

```ts
export const generationRuns = pgTable("generation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  totalDays: integer("total_days").notNull(),
  placeholderDays: integer("placeholder_days").notNull(),
  totalPeriods: integer("total_periods").notNull(),
  failedPeriods: integer("failed_periods").notNull(),
  repairCalls: integer("repair_calls").notNull(),
  modelOutcomes: jsonb("model_outcomes").notNull(),
});
```

(All of `pgTable`, `uuid`, `timestamp`, `integer`, `jsonb` are already
imported at the top of this file.)

- [ ] **Step 2: Push the schema change**

Run: `npm run db:push`
Expected: drizzle-kit reports the new `generation_runs` table being
created, applies cleanly against `DATABASE_URL`.

- [ ] **Step 3: Write the endpoint**

```ts
// app/api/telemetry/generation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb, hasDatabase } from "@/lib/db/client";
import { generationRuns } from "@/lib/db/schema";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";

type ModelOutcomes = Record<string, { attempts: number; failures: number }>;

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function parseModelOutcomes(v: unknown): ModelOutcomes | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: ModelOutcomes = {};
  for (const [model, val] of Object.entries(v as Record<string, unknown>)) {
    if (!val || typeof val !== "object") return null;
    const { attempts, failures } = val as Record<string, unknown>;
    if (!isNonNegativeInt(attempts) || !isNonNegativeInt(failures)) return null;
    out[model] = { attempts, failures };
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Telemetry is not configured." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown> | null;
  const totalDays = payload?.totalDays;
  const placeholderDays = payload?.placeholderDays;
  const totalPeriods = payload?.totalPeriods;
  const failedPeriods = payload?.failedPeriods;
  const repairCalls = payload?.repairCalls;
  const modelOutcomes = parseModelOutcomes(payload?.modelOutcomes);

  if (
    !isNonNegativeInt(totalDays) ||
    !isNonNegativeInt(placeholderDays) ||
    !isNonNegativeInt(totalPeriods) ||
    !isNonNegativeInt(failedPeriods) ||
    !isNonNegativeInt(repairCalls) ||
    !modelOutcomes
  ) {
    return NextResponse.json({ error: "Invalid telemetry payload." }, { status: 400 });
  }

  try {
    const db = getDb();
    await db.insert(generationRuns).values({
      userId,
      totalDays,
      placeholderDays,
      totalPeriods,
      failedPeriods,
      repairCalls,
      modelOutcomes,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/telemetry/generation", "POST failed", err);
    return NextResponse.json({ error: "Could not record telemetry." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Manual verification via dev server**

No route-handler test file exists anywhere in this repo today, so this
follows the existing precedent — verify by hand:

1. Run `npm run dev`, sign in with a test account.
2. In the browser devtools console (while signed in, same-origin), run:
   ```js
   fetch("/api/telemetry/generation", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       totalDays: 30, placeholderDays: 2, totalPeriods: 5, failedPeriods: 1,
       repairCalls: 3, modelOutcomes: { "deepseek/deepseek-v4-flash": { attempts: 5, failures: 1 } },
     }),
   }).then((r) => r.json()).then(console.log);
   ```
   Confirm it logs `{ ok: true }`.
3. Confirm a row landed: `npm run db:studio`, open `generation_runs`, check
   the new row's fields match what was sent and `userId` matches the signed-in
   account.
4. Repeat the fetch with a missing field (e.g. omit `repairCalls`) and
   confirm a 400 with `{ error: "Invalid telemetry payload." }`.
5. Sign out and repeat the original fetch; confirm a 401.

Write what you observed for each of the 5 checks into your report.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts app/api/telemetry/generation/route.ts
git commit -m "$(cat <<'EOF'
Add generationRuns table and POST /api/telemetry/generation endpoint

One row per generation run, reported by the client after a run
completes. Validates shape, requires a signed-in session, no rate
limiting (already scarce upstream via AI-action quotas).
EOF
)"
```

---

### Task 4: Report telemetry from `generatePlan()`'s only caller

**Files:**
- Modify: `lib/planGeneration.ts`, `features/planBuilder/PlanBuilder.tsx`

**Interfaces:**
- Consumes: `newTelemetry`, `GenerationTelemetry` (Task 2); the
  `telemetry` param now accepted by `chatStructured` (Task 2).
- Produces: `generatePlan()`'s return type changes from `Promise<Plan>` to
  `Promise<{ plan: Plan; telemetry: GenerationTelemetry }>`. This task's
  own change to `PlanBuilder.tsx:136` is the only call site (confirmed via
  repo-wide search — do not assume there are others; if your search turns
  up a second call site, stop and report it before proceeding, since it's
  not accounted for in this plan).

- [ ] **Step 1: Thread telemetry through `generatePlan()`**

In `lib/planGeneration.ts`, add the import:

```ts
import { newTelemetry, type GenerationTelemetry } from "@/lib/generationTelemetry";
```

At the top of `generatePlan()` (after the existing `const { draft, signal, onProgress } = opts;` line), create the collector:

```ts
  const telemetry = newTelemetry();
```

Pass `telemetry` into every `chatStructured` call made on this collector's
behalf. `generatePlan()` calls `fetchOutline()` and `fetchPeriodDays()`,
which are the functions that actually call `chatStructured` (around lines
924+ and the period-fetching function — read both function bodies first to
find their `chatStructured({...})` call sites). Change both functions'
signatures to accept an optional `telemetry?: GenerationTelemetry`
parameter, forward it into their `chatStructured({ ..., telemetry })` call,
and update `generatePlan()`'s calls to them to pass `telemetry`:

```ts
const rawOutline = await fetchOutline(draft, meta, skeleton, signal, telemetry);
```

```ts
fetchPeriodDays({
  draft,
  meta,
  period,
  topicsSoFar: topicsSnapshot,
  signal,
  telemetry,
})
```

(There are two call sites to `fetchPeriodDays` in `generatePlan()` — the
initial batch fetch and the retry-on-`shouldRetryPeriod` fetch. Add
`telemetry` to both.)

Finally, change the function's return statement (currently
`return { id: planId, ... };`) to include the plan alongside telemetry and
the three summary counts `generatePlan()` already has on hand at this point
(`outline.length` for total periods, `progress.failedPeriods.length`, and
the placeholder count reusing the same `/needs review/i` check already
computed a few lines above as `hasPlaceholders` — recount per-day here since
the rate needs a day count, not a boolean):

```ts
  return {
    plan: {
      id: planId,
      name: draft.name.trim() || "CUSTOM PLAN",
      subtitle: draft.subtitle.trim() || `${draft.totalDays}-day custom campaign`,
      builtin: false,
      createdAt: Date.now(),
      totalDays: draft.totalDays,
      topicsPerDay: draft.topicsPerDay,
      accentRole: "auto",
      periodScopes,
      days: progress.days,
      meta,
      status: progress.failedPeriods.length || hasPlaceholders ? "draft" : "ready",
    },
    telemetry,
    totalPeriods: outline.length,
    failedPeriods: progress.failedPeriods.length,
    placeholderDays: progress.days.filter((d) =>
      d.topics.some((t) => /needs review/i.test(t)),
    ).length,
  };
```

and update the function's declared return type from `Promise<Plan>` to
`Promise<{ plan: Plan; telemetry: GenerationTelemetry; totalPeriods: number; failedPeriods: number; placeholderDays: number }>`.

- [ ] **Step 2: Update `PlanBuilder.tsx`'s call site**

In `features/planBuilder/PlanBuilder.tsx`, check whether this file runs
under `// @ts-nocheck` (like the rest of the DualTrack UI layer) — if so,
`npm run typecheck` won't catch a mismatched destructure here, so get this
right by reading the current code carefully. Change:

```ts
      const plan = await generatePlan({
        draft: current,
        signal: ac.signal,
        resume: /* ...unchanged... */,
        onProgress: /* ...unchanged... */,
      });
      clearGenDraft();
      setRunning(false);
      setEditablePlan(sanitizePlanDays(plan));
      setStep(4);
```

to:

```ts
      const { plan, telemetry, totalPeriods, failedPeriods, placeholderDays } = await generatePlan({
        draft: current,
        signal: ac.signal,
        resume: /* ...unchanged... */,
        onProgress: /* ...unchanged... */,
      });
      clearGenDraft();
      setRunning(false);
      setEditablePlan(sanitizePlanDays(plan));
      setStep(4);
      fetch("/api/telemetry/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalDays: plan.totalDays,
          placeholderDays,
          totalPeriods,
          failedPeriods,
          repairCalls: telemetry.repairCalls,
          modelOutcomes: telemetry.modelOutcomes,
        }),
      }).catch(() => {});
```

Place the `fetch(...)` call after `setStep(4)` so it never delays the UI
transition — it is fire-and-forget and its `.catch(() => {})` means a
failure here is silent, matching the design (telemetry must never affect
plan generation or surface an error to the user).

- [ ] **Step 3: Update `lib/planGeneration.test.ts` for the new return shape**

Read `lib/planGeneration.test.ts` first — it very likely asserts on
`generatePlan()`'s return value directly as a `Plan` (e.g.
`expect(result.days)...` or `expect(result.status)...`). Update every such
assertion to destructure `{ plan }` first (e.g. `const { plan } = await generatePlan(...)`, then `expect(plan.days)...`), without changing what's
actually being asserted.

- [ ] **Step 4: Run tests, lint, typecheck**

Run: `npx vitest run lib/planGeneration.test.ts && npm run lint && npm run typecheck`
Expected: `planGeneration.test.ts` passes with the updated destructuring;
lint/typecheck clean. (If `PlanBuilder.tsx` is under `// @ts-nocheck`,
typecheck won't cover Step 2's edit — lint is what matters there.)

- [ ] **Step 5: Manual verification via dev server**

1. Run `npm run dev`, sign in, go through the plan builder to generate a
   real plan (any size).
2. After generation completes and the plan preview appears (step 4 of the
   builder), check `npm run db:studio` → `generation_runs` → confirm a new
   row appeared with plausible values (`totalDays` matches what you
   configured, `totalPeriods` > 0, `modelOutcomes` has at least one model
   key with `attempts >= 1`).
3. If you have a BYOK OpenRouter key configured in Settings, note whether
   `modelOutcomes` reflects the model(s) actually used; if using managed AI
   (no BYOK key), confirm `modelOutcomes` is `{}` (empty) — this is
   expected per the design (managed path isn't instrumented).

Write what you observed into your report.

- [ ] **Step 6: Commit**

```bash
git add lib/planGeneration.ts lib/planGeneration.test.ts features/planBuilder/PlanBuilder.tsx
git commit -m "$(cat <<'EOF'
Report generation telemetry after each plan generation run

generatePlan() now returns totalPeriods/failedPeriods/placeholderDays
alongside the plan and telemetry collector, computed once from data
it already has rather than recomputed by the caller. PlanBuilder.tsx
fires a fire-and-forget POST to /api/telemetry/generation after a
successful run; failures there are swallowed and never affect the UI.
EOF
)"
```

---

### Task 5: Admin telemetry dashboard

**Files:**
- Create: `app/admin/telemetry/page.tsx`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `auth` (`@/auth`), `getDb`/`hasDatabase` (`lib/db/client.ts`),
  `generationRuns` (Task 3's schema), `notFound` (`next/navigation`).
- Produces: nothing consumed by later tasks — this is the last task in the
  plan.

- [ ] **Step 1: Document `ADMIN_EMAILS` in `.env.example`**

Add, after the existing Upstash block at the end of the file:

```
# Optional: comma-separated emails allowed to view /admin/telemetry
# (generation-quality dashboard: placeholder-day rate, failed-period rate,
# repair-call rate, per-model failure rate). Unset = dashboard 404s for
# everyone.
# ADMIN_EMAILS=you@example.com
```

- [ ] **Step 2: Write the dashboard page**

```tsx
// app/admin/telemetry/page.tsx
import { notFound } from "next/navigation";
import { gte } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, hasDatabase } from "@/lib/db/client";
import { generationRuns } from "@/lib/db/schema";

export const metadata = {
  robots: { index: false, follow: false },
};

const WINDOWS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export default async function AdminTelemetryPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const session = await auth();
  if (!isAllowed(session?.user?.email)) notFound();
  if (!hasDatabase()) notFound();

  const { window: windowParam } = await searchParams;
  const windowKey = windowParam && WINDOWS[windowParam] ? windowParam : "7d";
  const since = new Date(Date.now() - WINDOWS[windowKey]);

  const db = getDb();
  const rows = await db
    .select()
    .from(generationRuns)
    .where(gte(generationRuns.createdAt, since));

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
```

- [ ] **Step 3: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Manual verification via dev server**

1. Run `npm run dev` without `ADMIN_EMAILS` set; sign in; visit
   `/admin/telemetry`. Confirm it 404s.
2. Set `ADMIN_EMAILS` in `.env.local` to your signed-in test account's
   email, restart the dev server, revisit `/admin/telemetry`. Confirm it
   loads and shows the rows written during Task 3/4's verification.
3. Click each of the `24h` / `7d` / `30d` links, confirm the row count and
   rates change appropriately (or stay the same if all your test rows are
   recent).
4. Confirm the per-model table shows a row per model that appeared in
   `modelOutcomes` across your test runs, with a sane rate.

Write what you observed into your report.

- [ ] **Step 5: Commit**

```bash
git add app/admin/telemetry/page.tsx .env.example
git commit -m "$(cat <<'EOF'
Add admin-gated generation telemetry dashboard

Shows placeholder-day, failed-period, and repair-call rates plus
per-model failure rate over a selectable 24h/7d/30d window, gated by
ADMIN_EMAILS. Unauthorized or unconfigured requests 404 rather than
403, to avoid confirming the route's existence.
EOF
)"
```
