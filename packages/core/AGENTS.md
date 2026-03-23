# @repo/core

PostgreSQL schema (`*.sql.ts`), Drizzle client, Better Auth server config, and small utilities (`actor`, `event`, `error`).

- Migrations live in `migrations/`; run `bun run db:generate` / `db:migrate` from this package.
- Add a domain as `src/<name>/<name>.sql.ts` + `src/<name>/index.ts` (service layer).
- Example EventBridge event: `src/template-event` + subscriber in `src/functions/event`.
- Example CRUD slice: `src/demo` (`demo_item` table) → `src/functions/api/demo.ts` → `@repo/sdk` `DemoResource` → `apps/app` route `/demo`.
