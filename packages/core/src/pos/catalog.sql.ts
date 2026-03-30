import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgTable, varchar, integer, boolean, text, index } from "drizzle-orm/pg-core";
import { id, timestamps, ulid, money } from "../drizzle/types";
import { businessTable } from "../business/business.sql";

export const categoryTable = pgTable(
  "category",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    parentId: ulid("parent_id").references((): AnyPgColumn => categoryTable.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("category_business_idx").on(t.businessId)],
);

export const productTable = pgTable(
  "product",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    categoryId: ulid("category_id").references(() => categoryTable.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 120 }),
    unit: varchar("unit", { length: 32 }).notNull().default("ea"),
    description: text("description"),
    priceCents: money("price_cents").notNull(),
    costCents: money("cost_cents"),
    stockAlert: integer("stock_alert").notNull().default(0),
    trackStock: boolean("track_stock").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("product_business_idx").on(t.businessId), index("product_business_sku_idx").on(t.businessId, t.sku)],
);

export const productVariantTable = pgTable(
  "product_variant",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    productId: ulid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 120 }),
    priceCents: money("price_cents").notNull(),
    costCents: money("cost_cents"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("product_variant_product_idx").on(t.productId),
    index("product_variant_business_idx").on(t.businessId),
    index("product_variant_business_sku_idx").on(t.businessId, t.sku),
  ],
);

export type CategoryRow = typeof categoryTable.$inferSelect;
export type ProductRow = typeof productTable.$inferSelect;
export type ProductVariantRow = typeof productVariantTable.$inferSelect;
