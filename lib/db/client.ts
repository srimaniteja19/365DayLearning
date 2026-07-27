import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";

let cached: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily builds the Drizzle client so importing this module never throws
 * when `DATABASE_URL` is unset (e.g. local dev without cloud sync configured).
 */
export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Add a Neon Postgres connection string to use accounts/cloud sync.",
    );
  }
  const sql = neon(url);
  cached = drizzle(sql, { schema });
  return cached;
}

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}
