import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { deleteAllLearnedItems, deleteLearnedItem, upsertLearnedItem } from "@/lib/db/learnedItems";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";
import { sanitizeLearned } from "@/lib/learned";

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
  const payload = body as { dateKey?: unknown; item?: unknown } | null;
  const dateKey = typeof payload?.dateKey === "string" ? payload.dateKey : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ error: "dateKey must be YYYY-MM-DD." }, { status: 400 });
  }
  const sanitizedMap = sanitizeLearned({ [dateKey]: [payload?.item] });
  const item = sanitizedMap[dateKey]?.[0];
  if (!item) {
    return NextResponse.json({ error: "item is invalid." }, { status: 400 });
  }

  try {
    await upsertLearnedItem(userId, dateKey, item);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/learned", "POST failed", err);
    return NextResponse.json({ error: "Could not save entry." }, { status: 500 });
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
      await deleteAllLearnedItems(userId);
    } else if (id) {
      await deleteLearnedItem(userId, id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/learned", "DELETE failed", err);
    return NextResponse.json({ error: "Could not delete entry." }, { status: 500 });
  }
}
