import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isRateLimited } from "@/lib/httpGuard";

const LOGIN_RATE_MAX = 12;
const LOGIN_RATE_WINDOW_MS = 60_000;

function loginRateKey(request: Request | undefined, email: string): string {
  const forwarded = request?.headers?.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : request?.headers?.get("x-real-ip") || "unknown";
  return `login:${ip}:${email || "*"}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password" },
      },
      authorize: async (raw, request) => {
        if (!hasDatabase()) return null;
        const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        if (!email || !password) return null;

        if (isRateLimited(loginRateKey(request, email), LOGIN_RATE_MAX, LOGIN_RATE_WINDOW_MS)) {
          return null;
        }

        const db = getDb();
        const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!row) return null;

        const ok = await bcrypt.compare(password, row.passwordHash);
        if (!ok) return null;

        return { id: row.id, email: row.email, name: row.name || undefined };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) token.id = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
});
