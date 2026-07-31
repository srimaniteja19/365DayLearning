import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { findOrCreateOAuthUser } from "@/lib/db/users";
import { users } from "@/lib/db/schema";
import { isRateLimited } from "@/lib/httpGuard";

const LOGIN_RATE_MAX = 12;
const LOGIN_RATE_WINDOW_MS = 60_000;

function loginRateKey(request: Request | undefined, email: string): string {
  const forwarded = request?.headers?.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : request?.headers?.get("x-real-ip") || "unknown";
  // Cap the attacker-controlled email portion so it can't be used to mint
  // unbounded distinct Redis keys against the operator's Upstash store.
  // 254 is the practical email length limit per RFC 5321.
  const boundedEmail = email.slice(0, 254);
  return `login:${ip}:${boundedEmail || "*"}`;
}

const googleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim(),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  trustHost: true,
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            // Same email as a password account → one Refrainly user (Neon + Stripe).
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
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

        if (await isRateLimited(loginRateKey(request, email), LOGIN_RATE_MAX, LOGIN_RATE_WINDOW_MS)) {
          return null;
        }

        const db = getDb();
        const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!row?.passwordHash) return null;

        const ok = await bcrypt.compare(password, row.passwordHash);
        if (!ok) return null;

        return { id: row.id, email: row.email, name: row.name || undefined };
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider !== "google") return true;
      if (!hasDatabase()) return false;
      const email = typeof user.email === "string" ? user.email : "";
      const row = await findOrCreateOAuthUser({
        email,
        name: typeof user.name === "string" ? user.name : null,
      });
      if (!row) return false;
      user.id = row.id;
      user.email = row.email;
      user.name = row.name || user.name;
      return true;
    },
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
