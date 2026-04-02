import {
  pgTable,
  varchar,
  integer,
  text,
  index,
  primaryKey,
  date,
} from "drizzle-orm/pg-core";
import { id, timestamps, ulid, timestamp } from "../drizzle/types";
import { businessTable } from "../business/business.sql";
import { userTable } from "../user/user.sql";
import { productTable } from "./catalog.sql";
import { saleTable } from "./sale.sql";

export const stockMovementTypeEnum = [
  "adjustment",
  "purchase",
  "waste",
  "sale",
  "sale_return",
  "transfer_in",
  "transfer_out",
] as const;
export type StockMovementType = (typeof stockMovementTypeEnum)[number];

export const productStockTable = pgTable(
  "product_stock",
  {
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    productId: ulid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.businessId, t.productId] })],
);

export const stockMovementTable = pgTable(
  "stock_movement",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    productId: ulid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    referenceSaleId: ulid("reference_sale_id").references(() => saleTable.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdByUserId: ulid("created_by_user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("stock_movement_business_created_idx").on(t.businessId, t.createdAt),
    index("stock_movement_product_idx").on(t.productId),
  ],
);

export const inventoryBatchTable = pgTable(
  "inventory_batch",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    productId: ulid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    expiresOn: date("expires_on", { mode: "date" }).notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    lotCode: varchar("lot_code", { length: 64 }),
    ...timestamps,
  },
  (t) => [
    index("inventory_batch_business_product_idx").on(t.businessId, t.productId),
    index("inventory_batch_expires_idx").on(t.expiresOn),
  ],
);

export type ProductStockRow = typeof productStockTable.$inferSelect;
export type StockMovementRow = typeof stockMovementTable.$inferSelect;
export type InventoryBatchRow = typeof inventoryBatchTable.$inferSelect;
