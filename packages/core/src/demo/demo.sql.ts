import { pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamps, ulid } from "../drizzle/types";
import { userTable } from "../user/user.sql";

export const demoItemTable = pgTable("demo_item", {
  ...id,
  label: text("label").notNull(),
  body: text("body"),
  createdByUserId: ulid("created_by_user_id").references(() => userTable.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export type DemoItemRow = typeof demoItemTable.$inferSelect;
export type NewDemoItemRow = typeof demoItemTable.$inferInsert;
