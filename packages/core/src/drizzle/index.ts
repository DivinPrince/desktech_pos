import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Resource } from "sst";

function resolveConnectionString(): string {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;
  return Resource.DatabaseUrl.value;
}

const connectionString = resolveConnectionString();

if (!connectionString) {
  throw new Error(
    "Database URL missing: set SST secret DatabaseUrl (sst secret set DatabaseUrl) or DATABASE_URL",
  );
}

const parsedDatabaseUrl = new URL(connectionString);
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(
  parsedDatabaseUrl.hostname,
);
const sslMode = parsedDatabaseUrl.searchParams.get("sslmode");

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
