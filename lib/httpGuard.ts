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
  if (origin.startsWith("chrome-extension://")) return true;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

let warnedPartialConfig = false;

/** True when an Upstash Redis store is configured for durable rate limiting. */
export function hasRateLimitStore(): boolean {
  const hasUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  if (hasUrl !== hasToken && !warnedPartialConfig) {
    warnedPartialConfig = true;
    console.warn(
      "[httpGuard] only one of UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN is set — " +
        "rate limiting is running in in-memory fallback mode due to partial Upstash configuration",
    );
  }
  return hasUrl && hasToken;
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
      // Bound worst-case added latency during an Upstash outage so guarded
      // requests (login, signup, /api/ai, ...) don't eat the function's
      // whole timeout budget waiting on retries.
      timeout: 1_000,
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

/** Consecutive Upstash `.limit()` failures before escalating log severity. */
const CONSECUTIVE_FAILURE_ESCALATION_THRESHOLD = 5;
let consecutiveStoreFailures = 0;
let warnedPersistentFailure = false;

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
    consecutiveStoreFailures = 0;
    warnedPersistentFailure = false;
    return !success;
  } catch (err) {
    consecutiveStoreFailures += 1;
    if (consecutiveStoreFailures >= CONSECUTIVE_FAILURE_ESCALATION_THRESHOLD) {
      if (!warnedPersistentFailure) {
        warnedPersistentFailure = true;
        console.error(
          `[httpGuard] rate limit store has failed ${consecutiveStoreFailures} consecutive times — ` +
            "fail-open may be masking a persistent outage or misconfiguration",
          err,
        );
      }
    } else {
      console.error("[httpGuard] rate limit store error, failing open", err);
    }
    return false;
  }
}
