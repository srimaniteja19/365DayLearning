import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDatabase } from "@/lib/db/client";
import { getSubscriptionUsage } from "@/lib/db/subscriptionQuota";
import { logError } from "@/lib/logError";

/** Current signed-in user's subscription tier + rolling-period usage. */
export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts are not configured on this server." }, { status: 503 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const usage = await getSubscriptionUsage(userId);
    if (!usage) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    return NextResponse.json(usage);
  } catch (err) {
    logError("api/subscription", "GET failed", err);
    return NextResponse.json({ error: "Could not load subscription status." }, { status: 500 });
  }
}
