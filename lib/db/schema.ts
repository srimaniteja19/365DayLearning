import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";

/** One row per account. Passwords are hashed with bcrypt before storage. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The entire client `AppSnapshot` (meta + plans + userdata) serialized as
 * JSON, one row per user. This mirrors what's already stored in
 * IndexedDB/localStorage so sync can reuse the existing snapshot shape
 * without a relational rewrite of plans/progress/notes/srs/learned.
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
