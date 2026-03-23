# @repo/core

PostgreSQL schema (`*.sql.ts`), Drizzle client, Better Auth server config, and small utilities (`actor`, `event`, `error`).

- Migrations live in `migrations/`. **Always** produce them with `bun run db:generate` from this package (`package.json` script)—do not hand-write SQL, `_journal.json`, or snapshot files. Drizzle needs SST-linked Neon: run via `sst shell -- bun run --cwd packages/core db:generate` (and `db:migrate` the same way) when links are not active locally.
- Add a domain as `src/<name>/<name>.sql.ts` + `src/<name>/index.ts` (service layer).
- Example EventBridge event: `src/template-event` + subscriber in `src/functions/event`.
- POS domain: `src/business`, `src/pos/*.sql.ts` + services → `src/functions/api/businesses.ts` mounted at `/api/businesses` and `/api/businesses/:businessId`.
