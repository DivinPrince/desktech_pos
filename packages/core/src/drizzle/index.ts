import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const databaseUrl = new URL(connectionString);
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(
  databaseUrl.hostname,
);
const sslMode = databaseUrl.searchParams.get("sslmode");

const pool = new Pool({
  connectionString,
  ssl:
    isLocalDatabase || sslMode === "disable"
      ? false
      : { rejectUnauthorized: false },
});

export const db = drizzle(pool, {
  logger: process.env.DRIZZLE_LOG === "true",
});

export { eq } from "drizzle-orm";
export type Database = typeof db;
