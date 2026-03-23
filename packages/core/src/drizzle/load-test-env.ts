/**
 * When DATABASE_URL is unset, load packages/core/.env.test (local Docker test DB).
 * Imported first from migrate.ts only — keeps SST/production paths unchanged.
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL?.trim()) {
  const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  config({ path: resolve(coreRoot, ".env.test") });
}
