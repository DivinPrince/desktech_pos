import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// Load root .env when running from packages/core
config({ path: resolve(import.meta.dir, "../../.env") });

export default defineConfig({
  out: "./migrations",
  schema: "./src/**/*.sql.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
