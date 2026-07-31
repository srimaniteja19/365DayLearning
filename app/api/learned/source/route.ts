import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeBookmarkUrl } from "@/lib/bookmarks";
import { clientIp, isRateLimited, isSameOrigin } from "@/lib/httpGuard";
import {
  extractSourcesForUrls,
  SOURCE_MAX_URLS,
  type SourceContent,
} from "@/lib/sourceContent";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (await isRateLimited(`learned-source:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
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
