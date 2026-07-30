import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
};

/**
 * Find-or-create a user for Google (or other OAuth) sign-in.
 * Links by email so an existing password account keeps the same Neon + Stripe data.
 */
export async function findOrCreateOAuthUser(input: {
  email: string;
  name?: string | null;
}): Promise<AppUser | null> {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const db = getDb();
  const [existing] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    if (input.name && !existing.name) {
      await db.update(users).set({ name: input.name }).where(eq(users.id, existing.id));
      return { ...existing, name: input.name };
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: input.name?.trim() || null,
      passwordHash: null,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
    });

  return created || null;
}
