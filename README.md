# Monorepo starter

SST (AWS Lambda + Cloudflare DNS), TanStack Start (`apps/app`), Hono API (`packages/functions`), Drizzle + Postgres (`packages/core`), Better Auth, EventBridge bus subscriber stub, and a small typed SDK.

## Quick start

1. Copy `packages/env/.env.example` to the repo root as `.env` and set `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ chars), and URLs.
2. Start Postgres (e.g. `docker compose up -d`) or point `DATABASE_URL` at your instance.
3. Run migrations: `bun run db:migrate` (uses `sst shell` per root `package.json`).
4. `bun run sst:dev` for the API, and in another terminal `bun run dev` (or `turbo dev --filter=app`) for the web app.

Replace placeholders in `infra/dns.ts`, SST secret values, and `apps/app/src/lib/site-theme.ts` before shipping.

**Vertical slice example:** `demo_item` table (`packages/core/src/demo`), REST at `/api/demo`, SDK `api.demo.*`, and UI at `/demo`. Run migrations so `0001_demo_item` is applied.

## Scripts (root)

- `bun run sst:dev` / `bun run sst:deploy` — infrastructure and API
- `bun run dev` — all packages in dev mode (Turbo)
- `bun run db:generate` / `db:migrate` — Drizzle (via SST shell)
