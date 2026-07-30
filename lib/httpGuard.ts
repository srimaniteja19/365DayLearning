import type { NextRequest } from "next/server";

/** Shared same-origin / rate-limit helpers for mutating API routes. */

const rateBuckets = new Map<string, number[]>();

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

/**
 * Sliding-window rate limit. In-memory: resets on redeploy and is
 * per-instance — acceptable at current single-region scale.
 */
export function isRateLimited(key: string, max: number, windowMs = 60_000): boolean {
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
