import { pgTable, varchar, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps, ulid } from "../drizzle/types";
import { userTable } from "../user/user.sql";

/** Stores replay-safe API responses for offline mutation retries (scoped per user + business + key). */
export const offlineIdempotencyTable = pgTable(
  "offline_idempotency",
  {
    id: ulid("id").primaryKey(),
    userId: ulid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    businessId: ulid("business_id").notNull(),
    scope: varchar("scope", { length: 64 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    response: jsonb("response").notNull().$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("offline_idem_user_scope_business_key_idx").on(
      t.userId,
      t.scope,
      t.businessId,
      t.idempotencyKey,
    ),
  ],
);

export type OfflineIdempotencyRow = typeof offlineIdempotencyTable.$inferSelect;
