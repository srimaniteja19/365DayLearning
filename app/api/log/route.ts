import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import {
  deleteAllTopicCompletions,
  deleteTopicCompletion,
  deleteTopicCompletionsByPlanPrefix,
  upsertTopicCompletion,
} from "@/lib/db/topicCompletions";
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
  const payload = body as { day?: unknown; topicIndex?: unknown } | null;
  const day = typeof payload?.day === "string" ? payload.day.trim() : "";
  const topicIndex =
    typeof payload?.topicIndex === "number" && Number.isInteger(payload.topicIndex)
      ? payload.topicIndex
      : null;
  if (!day || topicIndex === null || topicIndex < 0) {
    return NextResponse.json({ error: "day and topicIndex are required." }, { status: 400 });
  }

  try {
    await upsertTopicCompletion(userId, day, topicIndex, new Date());
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/log", "POST failed", err);
    return NextResponse.json({ error: "Could not save completion." }, { status: 500 });
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
  const day = searchParams.get("day");
  const topicIndexRaw = searchParams.get("topicIndex");
  const planId = searchParams.get("planId");
  const all = searchParams.get("all") === "true";

  const modesSpecified = [day && topicIndexRaw != null, !!planId, all].filter(Boolean).length;
  if (modesSpecified !== 1) {
    return NextResponse.json(
      { error: "Specify exactly one of (day + topicIndex), planId, or all=true." },
      { status: 400 },
    );
  }

  try {
    if (all) {
      await deleteAllTopicCompletions(userId);
    } else if (planId) {
      await deleteTopicCompletionsByPlanPrefix(userId, planId);
    } else {
      const topicIndex = Number(topicIndexRaw);
      if (!day || !Number.isInteger(topicIndex)) {
        return NextResponse.json({ error: "Invalid day/topicIndex." }, { status: 400 });
      }
      await deleteTopicCompletion(userId, day, topicIndex);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/log", "DELETE failed", err);
    return NextResponse.json({ error: "Could not delete completion." }, { status: 500 });
  }
}
