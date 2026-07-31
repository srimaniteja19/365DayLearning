import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb, hasDatabase } from "@/lib/db/client";
import { generationRuns } from "@/lib/db/schema";
import { isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";

type ModelOutcomes = Record<string, { attempts: number; failures: number }>;

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function parseModelOutcomes(v: unknown): ModelOutcomes | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: ModelOutcomes = {};
  for (const [model, val] of Object.entries(v as Record<string, unknown>)) {
    if (!val || typeof val !== "object") return null;
    const { attempts, failures } = val as Record<string, unknown>;
    if (!isNonNegativeInt(attempts) || !isNonNegativeInt(failures)) return null;
    out[model] = { attempts, failures };
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Telemetry is not configured." }, { status: 503 });
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

  const payload = body as Record<string, unknown> | null;
  const totalDays = payload?.totalDays;
  const placeholderDays = payload?.placeholderDays;
  const totalPeriods = payload?.totalPeriods;
  const failedPeriods = payload?.failedPeriods;
  const repairCalls = payload?.repairCalls;
  const modelOutcomes = parseModelOutcomes(payload?.modelOutcomes);

  if (
    !isNonNegativeInt(totalDays) ||
    !isNonNegativeInt(placeholderDays) ||
    !isNonNegativeInt(totalPeriods) ||
    !isNonNegativeInt(failedPeriods) ||
    !isNonNegativeInt(repairCalls) ||
    !modelOutcomes
  ) {
    return NextResponse.json({ error: "Invalid telemetry payload." }, { status: 400 });
  }

  try {
    const db = getDb();
    await db.insert(generationRuns).values({
      userId,
      totalDays,
      placeholderDays,
      totalPeriods,
      failedPeriods,
      repairCalls,
      modelOutcomes,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/telemetry/generation", "POST failed", err);
    return NextResponse.json({ error: "Could not record telemetry." }, { status: 500 });
  }
}
