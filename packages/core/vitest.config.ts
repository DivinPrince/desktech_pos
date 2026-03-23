import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { defineConfig } from "vitest/config";

const coreRoot = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(coreRoot, ".env.test") });

function envOr(key: string, fallback: string): string {
  const v = process.env[key];
  return v !== undefined && v !== "" ? v : fallback;
}

export default defineConfig({
  resolve: {
    alias: {
      "@repo/core": resolve(coreRoot, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    pool: "forks",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: envOr(
        "DATABASE_URL",
        "postgresql://postgres:postgres@127.0.0.1:54329/desktech_test",
      ),
      AUTH_TEST_UTILS: envOr("AUTH_TEST_UTILS", "1"),
      BETTER_AUTH_SECRET: envOr(
        "BETTER_AUTH_SECRET",
        "test-better-auth-secret-min-32-chars!!",
      ),
      BETTER_AUTH_URL: envOr("BETTER_AUTH_URL", "http://localhost"),
      FRONTEND_URL: envOr("FRONTEND_URL", "http://localhost:3000"),
      ADMIN_URL: envOr("ADMIN_URL", "http://localhost:3001"),
      NODE_ENV: "test",
    },
  },
});
