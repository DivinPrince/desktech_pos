import { pgTable, varchar, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps, ulid } from "../drizzle/types";
import { userTable } from "../user/user.sql";

export const businessMemberRoleEnum = ["owner", "manager", "cashier"] as const;
export type BusinessMemberRole = (typeof businessMemberRoleEnum)[number];

export const businessTable = pgTable("business", {
  ...id,
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 120 }),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  ...timestamps,
});

export const businessMemberTable = pgTable(
  "business_member",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    userId: ulid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().default("cashier"),
    ...timestamps,
  },
  (t) => [uniqueIndex("business_member_business_user_unique").on(t.businessId, t.userId)],
);

export type BusinessRow = typeof businessTable.$inferSelect;
export type BusinessMemberRow = typeof businessMemberTable.$inferSelect;
