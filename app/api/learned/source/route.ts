import { NextRequest, NextResponse } from "next/server";
import { normalizeBookmarkUrl } from "@/lib/bookmarks";
import {
  extractSourcesForUrls,
  SOURCE_MAX_URLS,
  type SourceContent,
} from "@/lib/sourceContent";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const rateBuckets = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (rateBuckets.get(ip) || []).filter((t) => t > cutoff);
  if (hits.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  if (rateBuckets.size > 10_000) {
    for (const [key, times] of rateBuckets) {
      if (!times.some((t) => t > cutoff)) rateBuckets.delete(key);
    }
  }
  return false;
}

function isSameOrigin(req: NextRequest): boolean {
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

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { urls?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawList: string[] = [];
  if (Array.isArray(body.urls)) {
    for (const u of body.urls) {
      if (typeof u === "string") rawList.push(u);
    }
  } else if (typeof body.url === "string") {
    rawList.push(body.url);
  }

  const urls = rawList
    .map((u) => normalizeBookmarkUrl(u))
    .filter((u): u is string => Boolean(u))
    .slice(0, SOURCE_MAX_URLS);

  if (!urls.length) {
    return NextResponse.json({ error: "No valid URLs" }, { status: 400 });
  }

  const sources: SourceContent[] = await extractSourcesForUrls(urls);
  return NextResponse.json({ sources });
}
