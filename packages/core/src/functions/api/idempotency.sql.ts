import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** Stores successful JSON responses for retried mutating requests (mobile outbox). */
export const apiIdempotencyKeyTable = pgTable(
  "api_idempotency_key",
  {
    userId: text("user_id").notNull(),
    businessId: text("business_id").notNull(),
    key: text("key").notNull(),
    /** 0 = in flight; otherwise HTTP status of cached body */
    responseStatus: integer("response_status").notNull().default(0),
    responseBody: text("response_body").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.businessId, t.key] }),
  }),
);
