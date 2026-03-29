# Mobile data layer (`src/lib/data`)

Cross-domain convention:

- **`sqlite-db.ts`** — single `expo-sqlite` database and TanStack persistence bridge (native); web skips persistence.
- **`schema-version.ts`** — bump when local SQLite shape changes (clear vs migrate policy).
- **`<domain>/`** (e.g. `catalog/`) —
  - **`keys.ts`** — stable query keys for collections.
  - **`types.ts`** — row types aligned with `@repo/core` / SDK where useful.
  - **`collections.ts`** — TanStack DB collections (query + persistence); register in a registry if the offline executor must reference them.
  - **`hooks.ts`** — `useLiveQuery` wrappers; screens import hooks, not raw collections.
- **`offline/`** — AsyncStorage outbox adapter, `OfflineExecutorProvider`, and **`catalog-mutation-fns.ts`** (executor `mutationFns` keyed by name).

Auth session stays in SecureStore (`auth-client`); this tree holds **business data** only.
