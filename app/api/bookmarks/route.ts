import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sanitizeBookmarks } from "@/lib/bookmarks";
import { hasDatabase } from "@/lib/db/client";
import { deleteAllBookmarkItems, deleteBookmarkItem, upsertBookmarkItem } from "@/lib/db/bookmarkItems";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
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
  const payload = body as { item?: unknown } | null;
  const item = sanitizeBookmarks([payload?.item])[0];
  if (!item) {
    return NextResponse.json({ error: "item is invalid." }, { status: 400 });
  }

  try {
    await upsertBookmarkItem(userId, item);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/bookmarks", "POST failed", err);
    return NextResponse.json({ error: "Could not save bookmark." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all") === "true";
  if ((id && all) || (!id && !all)) {
    return NextResponse.json({ error: "Specify exactly one of id or all=true." }, { status: 400 });
  }

  try {
    if (all) {
      await deleteAllBookmarkItems(userId);
    } else if (id) {
      await deleteBookmarkItem(userId, id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/bookmarks", "DELETE failed", err);
    return NextResponse.json({ error: "Could not delete bookmark." }, { status: 500 });
  }
}
