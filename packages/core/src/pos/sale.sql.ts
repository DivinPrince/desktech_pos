import { pgTable, varchar, integer, text, index } from "drizzle-orm/pg-core";
import { id, timestamps, ulid, timestamp, money } from "../drizzle/types";
import { businessTable } from "../business/business.sql";
import { userTable } from "../user/user.sql";
import { productTable, productVariantTable } from "./catalog.sql";
import { diningTableTable } from "./dining.sql";

export const saleStatusEnum = ["draft", "completed", "voided"] as const;
export type SaleStatus = (typeof saleStatusEnum)[number];

export const saleTable = pgTable(
  "sale",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    tableId: ulid("table_id").references(() => diningTableTable.id, {
      onDelete: "set null",
    }),
    subtotalCents: money("subtotal_cents").notNull().default(0),
    taxCents: money("tax_cents").notNull().default(0),
    totalCents: money("total_cents").notNull().default(0),
    paymentMethod: varchar("payment_method", { length: 64 }),
    completedAt: timestamp("completed_at"),
    voidReason: text("void_reason"),
    createdByUserId: ulid("created_by_user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("sale_business_status_idx").on(t.businessId, t.status),
    index("sale_business_completed_idx").on(t.businessId, t.completedAt),
  ],
);

export const saleLineTable = pgTable(
  "sale_line",
  {
    ...id,
    saleId: ulid("sale_id")
      .notNull()
      .references(() => saleTable.id, { onDelete: "cascade" }),
    productId: ulid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "restrict" }),
    productVariantId: ulid("product_variant_id").references(() => productVariantTable.id, {
      onDelete: "restrict",
    }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: money("unit_price_cents").notNull(),
    lineDiscountCents: money("line_discount_cents").notNull().default(0),
    productNameSnapshot: varchar("product_name_snapshot", { length: 255 }).notNull(),
    ...timestamps,
  },
  (t) => [index("sale_line_sale_idx").on(t.saleId)],
);

export type SaleRow = typeof saleTable.$inferSelect;
export type SaleLineRow = typeof saleLineTable.$inferSelect;
