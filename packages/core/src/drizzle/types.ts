import {
  varchar,
  timestamp as rawTs,
  bigint,
  boolean,
  text,
  jsonb,
} from "drizzle-orm/pg-core";

export const ulid = (name: string) => varchar(name, { length: 30 });

export const id = {
  get id() {
    return ulid("id").primaryKey();
  },
};

export const timestamp = (name: string) =>
  rawTs(name, { mode: "date", withTimezone: true });

export const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const softDelete = {
  deletedAt: timestamp("deleted_at"),
};

export const dollar = (name: string) =>
  bigint(name, { mode: "number" });

export const money = dollar;

export { varchar, text, boolean, jsonb, timestamp as rawTimestamp };
