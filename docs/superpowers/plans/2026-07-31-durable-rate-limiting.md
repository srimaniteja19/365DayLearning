# Durable Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory, per-instance rate limiter in `lib/httpGuard.ts` with an Upstash-Redis-backed durable limiter, falling back to today's in-memory behavior when no store is configured.

**Architecture:** `lib/httpGuard.ts`'s `isRateLimited()` becomes async. When `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, it delegates to a cached `@upstash/ratelimit` `Ratelimit` instance (sliding window, one instance per distinct `(max, windowMs)` pair). Otherwise it runs the existing in-memory sliding-window logic unchanged. The 5 call sites (`app/api/ai`, `app/api/auth/signup`, `app/api/learned/source`, `app/api/topic-resources`, `app/api/bookmarks/preview`) each add one `await`.

**Tech Stack:** Next.js Route Handlers (Node runtime), `@upstash/redis` + `@upstash/ratelimit` (new dependencies), Vitest (`environment: "node"`).

## Global Constraints

- Env vars: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (exactly these names — matches `Redis.fromEnv()`'s defaults and Vercel's Upstash Marketplace integration).
- No behavior change to any of the 5 call sites' key prefixes or max/window constants.
- No change to `isSameOrigin` or `clientIp`.
- The app must run correctly with the env vars absent (local dev) — falls back to the existing in-memory logic, unchanged.
- On an Upstash error, fail open (treat as not rate-limited) — rate limiting here is a cost/abuse guard, not a security gate.
- This task touches `lib/httpGuard.ts` (currently untested) and 5 route files (also untested) — this repo's `lib/*.test.ts` convention applies here (`environment: "node"`, Vitest), so this task follows TDD: write the test file first, watch it fail, then implement.

---

### Task 1: Async, Upstash-backed rate limiter with in-memory fallback

**Files:**
- Modify: `lib/httpGuard.ts` (full rewrite of the rate-limiting section; `isSameOrigin`/`clientIp` untouched)
- Create: `lib/httpGuard.test.ts`
- Modify: `app/api/ai/route.ts:66`
- Modify: `app/api/auth/signup/route.ts:30`
- Modify: `app/api/learned/source/route.ts:25`
- Modify: `app/api/topic-resources/route.ts:111`
- Modify: `app/api/bookmarks/preview/route.ts:184`
- Modify: `package.json` (via `npm install`, not hand-edited)

**Interfaces:**
- Produces: `hasRateLimitStore(): boolean` (new export), `isRateLimited(key: string, max: number, windowMs?: number): Promise<boolean>` (same name, now async — was sync). `isSameOrigin` and `clientIp` keep their existing signatures.
- Consumes (by the 5 route files): `isRateLimited` and `clientIp` from `@/lib/httpGuard`, unchanged import paths.

- [ ] **Step 1: Install dependencies**

```bash
npm install @upstash/ratelimit @upstash/redis
```

- [ ] **Step 2: Write the failing test file**

Create `lib/httpGuard.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function setStoreEnv() {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
}

describe("httpGuard rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    vi.doUnmock("@upstash/redis");
    vi.doUnmock("@upstash/ratelimit");
  });

  describe("fallback (no store configured)", () => {
    it("allows requests under the max", async () => {
      const { isRateLimited } = await import("@/lib/httpGuard");
      expect(await isRateLimited("k1", 3, 60_000)).toBe(false);
      expect(await isRateLimited("k1", 3, 60_000)).toBe(false);
      expect(await isRateLimited("k1", 3, 60_000)).toBe(false);
    });

    it("blocks once max is reached within the window", async () => {
      const { isRateLimited } = await import("@/lib/httpGuard");
      await isRateLimited("k2", 2, 60_000);
      await isRateLimited("k2", 2, 60_000);
      expect(await isRateLimited("k2", 2, 60_000)).toBe(true);
    });

    it("allows again after the window elapses", async () => {
      vi.useFakeTimers();
      const { isRateLimited } = await import("@/lib/httpGuard");
      await isRateLimited("k3", 1, 1_000);
      expect(await isRateLimited("k3", 1, 1_000)).toBe(true);
      vi.advanceTimersByTime(1_001);
      expect(await isRateLimited("k3", 1, 1_000)).toBe(false);
      vi.useRealTimers();
    });
  });

  describe("Upstash-backed store", () => {
    it("delegates to a Ratelimit instance when the store is configured", async () => {
      setStoreEnv();
      const limitMock = vi.fn().mockResolvedValue({ success: true });
      const slidingWindowMock = vi.fn().mockReturnValue("sliding-window-config");
      vi.doMock("@upstash/redis", () => ({
        Redis: { fromEnv: vi.fn().mockReturnValue({}) },
      }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(
          vi.fn().mockImplementation(() => ({ limit: limitMock })),
          { slidingWindow: slidingWindowMock },
        ),
      }));

      const { isRateLimited } = await import("@/lib/httpGuard");
      expect(await isRateLimited("k4", 5, 60_000)).toBe(false);
      expect(slidingWindowMock).toHaveBeenCalledWith(5, "60000 ms");
      expect(limitMock).toHaveBeenCalledWith("k4");
    });

    it("reuses the same Ratelimit instance for repeated calls with the same max/window", async () => {
      setStoreEnv();
      const limitMock = vi.fn().mockResolvedValue({ success: true });
      const RatelimitCtor = vi.fn().mockImplementation(() => ({ limit: limitMock }));
      vi.doMock("@upstash/redis", () => ({
        Redis: { fromEnv: vi.fn().mockReturnValue({}) },
      }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(RatelimitCtor, { slidingWindow: vi.fn() }),
      }));

      const { isRateLimited } = await import("@/lib/httpGuard");
      await isRateLimited("a", 5, 60_000);
      await isRateLimited("b", 5, 60_000);
      expect(RatelimitCtor).toHaveBeenCalledTimes(1);
    });

    it("returns true (limited) when the store reports failure", async () => {
      setStoreEnv();
      const limitMock = vi.fn().mockResolvedValue({ success: false });
      vi.doMock("@upstash/redis", () => ({
        Redis: { fromEnv: vi.fn().mockReturnValue({}) },
      }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(
          vi.fn().mockImplementation(() => ({ limit: limitMock })),
          { slidingWindow: vi.fn() },
        ),
      }));

      const { isRateLimited } = await import("@/lib/httpGuard");
      expect(await isRateLimited("k5", 5, 60_000)).toBe(true);
    });

    it("fails open (not limited) if the store throws", async () => {
      setStoreEnv();
      const limitMock = vi.fn().mockRejectedValue(new Error("upstash down"));
      vi.doMock("@upstash/redis", () => ({
        Redis: { fromEnv: vi.fn().mockReturnValue({}) },
      }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(
          vi.fn().mockImplementation(() => ({ limit: limitMock })),
          { slidingWindow: vi.fn() },
        ),
      }));
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { isRateLimited } = await import("@/lib/httpGuard");
      expect(await isRateLimited("k6", 5, 60_000)).toBe(false);
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  describe("hasRateLimitStore", () => {
    it("is false when env vars are absent", async () => {
      const { hasRateLimitStore } = await import("@/lib/httpGuard");
      expect(hasRateLimitStore()).toBe(false);
    });

    it("is true when both env vars are set", async () => {
      setStoreEnv();
      const { hasRateLimitStore } = await import("@/lib/httpGuard");
      expect(hasRateLimitStore()).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run the test file and confirm it fails**

Run: `npx vitest run lib/httpGuard.test.ts`
Expected: FAIL — `hasRateLimitStore` is not exported, and/or `isRateLimited` calls resolve to a value that doesn't match the fallback assertions (current implementation is sync, not async, and has no store-aware branch).

- [ ] **Step 4: Rewrite `lib/httpGuard.ts`**

Replace the whole file with:

```ts
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** Shared same-origin / rate-limit helpers for mutating API routes. */

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Session cookies ride along on cross-site requests, so state-changing
 * routes need an explicit same-origin check to prevent CSRF.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** True when an Upstash Redis store is configured for durable rate limiting. */
export function hasRateLimitStore(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) redisClient = Redis.fromEnv();
  return redisClient;
}

const limiters = new Map<string, Ratelimit>();
function getLimiter(max: number, windowMs: number): Ratelimit {
  const cacheKey = `${max}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

const rateBuckets = new Map<string, number[]>();

/**
 * In-memory sliding-window rate limit. Per-instance — used only as a
 * fallback when no durable store is configured (e.g. local dev).
 */
function isRateLimitedInMemory(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (rateBuckets.get(key) || []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    rateBuckets.set(key, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  if (rateBuckets.size > 10_000) {
    for (const [k, times] of rateBuckets) {
      if (!times.some((t) => t > cutoff)) rateBuckets.delete(k);
    }
  }
  return false;
}

/**
 * Sliding-window rate limit. Backed by Upstash Redis when configured
 * (durable, shared across instances); falls back to an in-memory limiter
 * otherwise. Fails open (not limited) if the Upstash call itself errors —
 * this guards cost/abuse, it is not a security gate.
 */
export async function isRateLimited(
  key: string,
  max: number,
  windowMs = 60_000,
): Promise<boolean> {
  if (!hasRateLimitStore()) {
    return isRateLimitedInMemory(key, max, windowMs);
  }
  try {
    const { success } = await getLimiter(max, windowMs).limit(key);
    return !success;
  } catch (err) {
    console.error("[httpGuard] rate limit store error, failing open", err);
    return false;
  }
}
```

- [ ] **Step 5: Run the test file and confirm it passes**

Run: `npx vitest run lib/httpGuard.test.ts`
Expected: PASS (all cases in `lib/httpGuard.test.ts`).

- [ ] **Step 6: Update the 5 call sites to await `isRateLimited`**

In `app/api/ai/route.ts:66`, change:
```ts
  if (isRateLimited(`ai:${clientIp(req)}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
```
to:
```ts
  if (await isRateLimited(`ai:${clientIp(req)}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
```

In `app/api/auth/signup/route.ts:30`, change:
```ts
  if (isRateLimited(`signup:${clientIp(req)}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
```
to:
```ts
  if (await isRateLimited(`signup:${clientIp(req)}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
```

In `app/api/learned/source/route.ts:25`, change:
```ts
  if (isRateLimited(`learned-source:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
```
to:
```ts
  if (await isRateLimited(`learned-source:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
```

In `app/api/topic-resources/route.ts:111`, change:
```ts
  if (isRateLimited(`topic-resources:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
```
to:
```ts
  if (await isRateLimited(`topic-resources:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
```

In `app/api/bookmarks/preview/route.ts:184`, change:
```ts
  if (isRateLimited(`bookmark-preview:${session.user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
```
to:
```ts
  if (await isRateLimited(`bookmark-preview:${session.user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
```

All 5 handlers are already `async function POST(...)`, so no other change is needed at each site.

- [ ] **Step 7: Typecheck, lint, and run the full test suite**

Run:
```bash
npm run typecheck
npm run lint
npm run test
```
Expected: all three pass, with `lib/httpGuard.test.ts` included in the test run (`npm run test` runs the full Vitest suite, which auto-discovers `**/*.test.ts`).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/httpGuard.ts lib/httpGuard.test.ts \
  app/api/ai/route.ts app/api/auth/signup/route.ts app/api/learned/source/route.ts \
  app/api/topic-resources/route.ts app/api/bookmarks/preview/route.ts
git commit -m "$(cat <<'EOF'
Move rate limiting to Upstash Redis, with in-memory fallback

The in-memory limiter resets on every redeploy and is scoped to a
single serverless instance, so it provides no real protection on
Vercel. This adds a durable, cross-instance limiter backed by
Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are configured,
falling back to the existing in-memory logic otherwise (e.g. local
dev with no Upstash account set up).
EOF
)"
```
