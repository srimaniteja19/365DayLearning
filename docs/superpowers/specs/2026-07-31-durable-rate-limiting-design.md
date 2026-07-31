# Move rate limiting to a durable (Upstash) store

## Problem

`lib/httpGuard.ts`'s `isRateLimited()` is an in-memory `Map`-based sliding-window
limiter. It resets on every redeploy and is scoped to a single serverless instance —
on Vercel, concurrent cold starts each get their own empty map, so the limit is
trivially bypassed under any real load. This is a known, already-documented
limitation (`docs/APPLICATION_DOCUMENTATION.md` §21).

The highest-stakes call site is `POST /api/ai` (`app/api/ai/route.ts`), which proxies
to OpenRouter using the server's own `OPENROUTER_API_KEY` — i.e. the operator's money.
When a signed-in user hits it, a DB-backed subscription quota (`reserveAiActionQuota`)
provides a durable backstop, but the in-memory IP rate limiter is the first line of
defense against request floods *before* that quota check runs, and it currently
provides none of that defense across instances.

Four other routes share the same limiter: `app/api/auth/signup/route.ts`,
`app/api/learned/source/route.ts`, `app/api/topic-resources/route.ts`,
`app/api/bookmarks/preview/route.ts`.

## Goals

- Make the rate limit durable and shared across serverless instances/regions.
- Zero setup required for local development — the app must keep working without an
  Upstash account.
- No behavior change to the 5 call sites beyond making the call awaited — same keys,
  same per-route max/window values.

## Design

### Store

Upstash Redis via `@upstash/redis` (REST-based client, no persistent TCP connection —
fits serverless/edge) and `@upstash/ratelimit` (Upstash's own rate-limiting library,
sliding-window algorithm already implemented and tested — not hand-rolled).

`Redis.fromEnv()` reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. These
are the same variable names whether the database is connected via Vercel's Upstash
Marketplace integration or a standalone Upstash account — no custom env parsing.

### `lib/httpGuard.ts` changes

- `hasRateLimitStore(): boolean` — `!!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN`, mirroring the existing `hasDatabase()` pattern in `lib/db/client.ts`.
- `isRateLimited(key: string, max: number, windowMs = 60_000): Promise<boolean>` — now async (was sync). Behavior:
  - If `hasRateLimitStore()`: look up (or lazily create) a cached `Ratelimit` instance keyed by `` `${max}:${windowMs}` `` (a `Map<string, Ratelimit>` module-level cache — the 5 call sites use 5 distinct max values, all on a 60s window, so this caps at 5 instances). Call `.limit(key)` on it. On success, not limited; on failure, limited.
  - If an Upstash call throws (network error, outage): log via `console.error` and treat as **not limited** (fail open). Rate limiting is a best-effort cost/abuse guard here, not a security gate — the existing in-memory limiter already accepts a weaker guarantee than a hard block, and blocking all real users because Upstash hiccupped would be worse than the abuse case it's guarding against.
  - If `!hasRateLimitStore()`: run today's existing in-memory sliding-window logic, byte-for-byte unchanged, wrapped to return a resolved value from an async function.
- The Redis client itself is constructed lazily (only when `hasRateLimitStore()` is true) so `Redis.fromEnv()` never throws in environments without the env vars set (e.g. local dev, CI).

### Call site changes

All 5 call sites change identically: add `await` in front of the existing
`isRateLimited(...)` call (their enclosing route handlers are already `async`). No
other changes — same key prefixes (`ai:`, `signup:`, `learned-source:`,
`topic-resources:`, `bookmark-preview:`), same max/window constants.

### Dependencies

Add `@upstash/ratelimit` and `@upstash/redis` to `package.json` dependencies.

### Testing

New `lib/httpGuard.test.ts` (none exists today):
- Fallback path (no env vars set): exercises the existing in-memory logic — under the
  configured max, allow; at/over max within the window, block; after the window
  elapses, allow again.
- Upstash path: mock `@upstash/redis` and `@upstash/ratelimit` (matching this repo's
  existing `vi.mock` conventions in other `lib/*.test.ts` files) to verify
  `hasRateLimitStore()` gating, that a `Ratelimit` instance is created once and reused
  for repeated calls with the same `(max, windowMs)`, and that a thrown error from
  `.limit()` results in "not limited" (fail open) rather than throwing.

## Non-goals

- No change to per-route max/window values or key naming.
- No change to `isSameOrigin`, `clientIp`, or any other `httpGuard.ts` export.
- No provisioning of the actual Upstash database — that's an external account/env-var
  setup step outside this change. The app must run correctly both before and after
  that setup exists.
