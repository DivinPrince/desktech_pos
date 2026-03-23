import { pgTable, varchar, text, index } from "drizzle-orm/pg-core";
import { id, timestamps, ulid, timestamp, money } from "../drizzle/types";
import { businessTable } from "../business/business.sql";
import { userTable } from "../user/user.sql";

export const expenseTable = pgTable(
  "expense",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 120 }).notNull(),
    amountCents: money("amount_cents").notNull(),
    spentAt: timestamp("spent_at").notNull(),
    note: text("note"),
    createdByUserId: ulid("created_by_user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("expense_business_spent_idx").on(t.businessId, t.spentAt),
    index("expense_business_category_idx").on(t.businessId, t.category),
  ],
);

export type ExpenseRow = typeof expenseTable.$inferSelect;
