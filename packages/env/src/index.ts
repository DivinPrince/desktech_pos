import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * @repo/env – Shared environment (t3-env). Wire fields in as packages need them.
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    DRIZZLE_LOG: z.string().default("false").transform((v) => v === "true"),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    FRONTEND_URL: z.url().default("http://localhost:3000"),
    API_URL: z.url().default("http://localhost:3001"),
    APP_NAME: z.string().default("App"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("App <noreply@example.com>"),
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    ADMIN_NAME: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  clientPrefix: "VITE_",
  client: {
    VITE_API_URL: z.url().default("http://localhost:3001"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type Env = typeof env;
