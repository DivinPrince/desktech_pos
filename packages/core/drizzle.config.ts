import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

/** Run via `sst shell -- bun run --cwd packages/core db:*` so linked `DatabaseUrl` is available. */
export default defineConfig({
  out: "./migrations",
  schema: "./src/**/*.sql.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: Resource.DatabaseUrl.value,
  },
  verbose: true,
  strict: true,
});
