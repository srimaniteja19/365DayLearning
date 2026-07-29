import { pgTable, text, timestamp, jsonb, uuid, integer } from "drizzle-orm/pg-core";

/**
 * One row per account. Passwords are hashed with bcrypt before storage.
 *
 * Subscription fields are intentionally simple columns (not a separate
 * billing table) since there's a 1:1 relationship with the account and no
 * multi-seat/org concept. `subscriptionTier` mirrors `SubscriptionTier` in
 * `lib/subscriptions.ts`. Usage counters cover a rolling period starting at
 * `usagePeriodStart` (see `lib/subscriptions.ts` USAGE_PERIOD_MS) and reset
 * lazily the next time usage is checked, rather than via a cron job.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  planGenerationsUsed: integer("plan_generations_used").notNull().default(0),
  aiActionsUsed: integer("ai_actions_used").notNull().default(0),
  usagePeriodStart: timestamp("usage_period_start", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The entire client `AppSnapshot` (meta + plans + userdata) as JSON, one row
 * per user. Neon is the source of truth for learning data; the shape matches
 * the former client-side cache so sync stays a single document put/get.
 */
export const userState = pgTable("user_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type UserStateRow = typeof userState.$inferSelect;
