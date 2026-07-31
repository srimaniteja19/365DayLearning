import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, hasDatabase } from "@/lib/db/client";
import { userState } from "@/lib/db/schema";
import { sanitizeAppSnapshot } from "@/lib/exportImport";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";
import { SCHEMA_VERSION } from "@/lib/types";

// A serialized AppSnapshot (plans + progress + notes + srs + learned journal
// etc.) for a very active user is still well under this — this cap just
// guards against pathological payloads.
const MAX_SNAPSHOT_CHARS = 5_000_000;

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(userState)
      .where(eq(userState.userId, userId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ snapshot: null, updatedAt: null });
    }
    return NextResponse.json({
      snapshot: row.snapshot,
      updatedAt: toIso(row.updatedAt),
    });
  } catch (err) {
    logError("api/state", "GET failed", err);
    return NextResponse.json({ error: "Could not load cloud data." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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
    const text = await req.text();
    if (text.length > MAX_SNAPSHOT_CHARS) {
      return NextResponse.json({ error: "Snapshot payload is too large." }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as { snapshot?: unknown; baseUpdatedAt?: unknown } | null;
  const snapshot = sanitizeAppSnapshot(payload?.snapshot);
  if (!snapshot) {
    return NextResponse.json({ error: "snapshot is required and must be a valid AppSnapshot." }, { status: 400 });
  }

  const baseUpdatedAt =
    typeof payload?.baseUpdatedAt === "string" && payload.baseUpdatedAt.trim()
      ? payload.baseUpdatedAt.trim()
      : null;

  try {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(userState)
      .where(eq(userState.userId, userId))
      .limit(1);

    if (existing) {
      const serverAt = toIso(existing.updatedAt);

      const conflictResponse = (reason: string, message: string) =>
        NextResponse.json(
          {
            error: "conflict",
            reason,
            message,
            snapshot: sanitizeAppSnapshot(existing.snapshot) || existing.snapshot,
            updatedAt: serverAt,
          },
          { status: 409 },
        );

      // Requires terminal-stale-client handling in flushCloudSnapshot
      // (components/dualtrack/DualTrackConsole.tsx) before SCHEMA_VERSION is
      // ever incremented past its current value — today, any 409 (including
      // this one) is treated as retryable and the client just adopts the
      // server snapshot and retries. For a schema-version conflict that can
      // never succeed (the client's SCHEMA_VERSION constant is baked into its
      // JS bundle and won't change), that turns into an infinite retry loop
      // that silently discards local edits. See the final-review discussion
      // in docs/superpowers/plans/2026-07-31-schema-version-guard.md history
      // for detail.
      if (snapshot.meta.schemaVersion < SCHEMA_VERSION) {
        return conflictResponse(
          "schema-version",
          "Your app version is out of date. Reloaded the latest copy — please refresh.",
        );
      }

      if (baseUpdatedAt != null && serverAt && serverAt !== baseUpdatedAt) {
        return conflictResponse("stale-base", "Cloud data changed on another device. Reloaded the latest copy.");
      }
    }

    const now = new Date();
    await db
      .insert(userState)
      .values({ userId, snapshot, updatedAt: now })
      .onConflictDoUpdate({
        target: userState.userId,
        set: { snapshot, updatedAt: now },
      });
    return NextResponse.json({ ok: true, updatedAt: now.toISOString() });
  } catch (err) {
    logError("api/state", "PUT failed", err);
    return NextResponse.json({ error: "Could not save cloud data." }, { status: 500 });
  }
}
