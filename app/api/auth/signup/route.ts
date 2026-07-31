import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { clientIp, isRateLimited, isSameOrigin } from "@/lib/httpGuard";
import { logError } from "@/lib/logError";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().max(100).optional(),
});

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Accounts are not configured on this server (missing DATABASE_URL)." },
      { status: 503 },
    );
  }

  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  if (await isRateLimited(`signup:${clientIp(req)}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid signup details." },
      { status: 400 },
    );
  }
  const { email, password, name } = parsed.data;

  try {
    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email, passwordHash, name: name || null });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/auth/signup", "failed", err);
    return NextResponse.json({ error: "Could not create account. Try again shortly." }, { status: 500 });
  }
}
