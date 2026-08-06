import { pgTable, text, timestamp, jsonb, uuid, integer, boolean, primaryKey } from "drizzle-orm/pg-core";

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
  /** Null for Google-only accounts; set for email/password sign-up. */
  passwordHash: text("password_hash"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planGenerationsUsed: integer("plan_generations_used").notNull().default(0),
  aiActionsUsed: integer("ai_actions_used").notNull().default(0),
  /** Recruit's one-time managed allowance; never reset with paid billing periods. */
  freePlanGenerationsUsed: integer("free_plan_generations_used").notNull().default(0),
  freeAiActionsUsed: integer("free_ai_actions_used").notNull().default(0),
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

/**
 * Shared cache of suggested learning resources, keyed by normalized topic
 * title (not per-user). Keeps OpenRouter web_search cost down when the same
 * topics recur across plans/users.
 *
 * A row with null `url` is a negative cache entry (search ran, nothing usable).
 */
export const topicResourceCache = pgTable("topic_resource_cache", {
  topicKey: text("topic_key").primaryKey(),
  url: text("url"),
  title: text("title"),
  snippet: text("snippet"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per client-side generatePlan() run, reported by the client after
 * generation completes. Powers the /admin/telemetry dashboard's
 * placeholder-day / failed-period / repair-call / per-model-failure rates.
 */
export const generationRuns = pgTable("generation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  totalDays: integer("total_days").notNull(),
  placeholderDays: integer("placeholder_days").notNull(),
  totalPeriods: integer("total_periods").notNull(),
  failedPeriods: integer("failed_periods").notNull(),
  repairCalls: integer("repair_calls").notNull(),
  modelOutcomes: jsonb("model_outcomes").notNull(),
});

/**
 * One row per (user, day, topic) completion. Composite PK matches the
 * client's LogEntry {d, i, at} key exactly (lib/types.ts). Upserted on
 * topic-check, deleted on topic-uncheck — see app/api/log/route.ts.
 */
export const topicCompletions = pgTable(
  "topic_completions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    topicIndex: integer("topic_index").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.topicIndex] })],
);

/**
 * One row per "other things I learned" journal entry. `id` is the
 * client-minted id (createLearnedId(), lib/learned.ts) reused as PK.
 * `dateKey` is a real column, not derived from createdAt — entries can be
 * moved to a different date (updateLearned's toDate param).
 */
export const learnedItems = pgTable("learned_items", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dateKey: text("date_key").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  insight: text("insight"),
  tags: jsonb("tags"),
  favorite: boolean("favorite").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/**
 * One row per saved bookmark. `id` is the client-minted id
 * (createBookmarkId(), lib/bookmarks.ts) reused as PK.
 */
export const bookmarkItems = pgTable("bookmark_items", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  tags: jsonb("tags"),
  favorite: boolean("favorite").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  preview: jsonb("preview"),
  insight: text("insight"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type UserStateRow = typeof userState.$inferSelect;
export type TopicResourceCacheRow = typeof topicResourceCache.$inferSelect;
export type GenerationRunRow = typeof generationRuns.$inferSelect;
export type TopicCompletionRow = typeof topicCompletions.$inferSelect;
export type LearnedItemRow = typeof learnedItems.$inferSelect;
export type BookmarkItemRow = typeof bookmarkItems.$inferSelect;
