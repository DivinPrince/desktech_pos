import { pgTable, varchar, integer, boolean, real, index } from "drizzle-orm/pg-core";
import { id, timestamps, ulid } from "../drizzle/types";
import { businessTable } from "../business/business.sql";

export const diningTableStatusEnum = ["free", "occupied", "billing", "cleaning"] as const;
export type DiningTableStatus = (typeof diningTableStatusEnum)[number];

export const diningTableTable = pgTable(
  "dining_table",
  {
    ...id,
    businessId: ulid("business_id")
      .notNull()
      .references(() => businessTable.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 64 }).notNull(),
    capacity: integer("capacity").notNull().default(4),
    status: varchar("status", { length: 32 }).notNull().default("free"),
    layoutX: real("layout_x"),
    layoutY: real("layout_y"),
    floorZone: varchar("floor_zone", { length: 64 }),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("dining_table_business_idx").on(t.businessId)],
);

export type DiningTableRow = typeof diningTableTable.$inferSelect;
