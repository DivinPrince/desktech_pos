import { pgTable, varchar, text, boolean } from "drizzle-orm/pg-core";
import { id, timestamps, ulid, timestamp } from "../drizzle/types";

export const userTable = pgTable("user", {
  ...id,
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  phone: varchar("phone", { length: 20 }),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  ...timestamps,
});

export const sessionTable = pgTable("session", {
  ...id,
  userId: ulid("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  impersonatedBy: ulid("impersonated_by"),
  ...timestamps,
});

export const accountTable = pgTable("account", {
  ...id,
  userId: ulid("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  ...timestamps,
});

export const verificationTable = pgTable("verification", {
  ...id,
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestamps,
});

export const jwksTable = pgTable("jwks", {
  ...id,
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export type User = typeof userTable.$inferSelect;
export type NewUser = typeof userTable.$inferInsert;
export type Session = typeof sessionTable.$inferSelect;
export type Account = typeof accountTable.$inferSelect;
export type Verification = typeof verificationTable.$inferSelect;
export type Jwks = typeof jwksTable.$inferSelect;
