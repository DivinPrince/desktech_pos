# @repo/mobile (`apps/app`)

Expo Router app, HeroUI Native, Uniwind + Tailwind v4 (`src/global.css`).

- **Development build:** This app uses `expo-dev-client` (plugin in `app.json`). After `bun install` in the monorepo root (or app), from `apps/app`: first time **(Android)** `bun run run:android` or **(iOS, macOS only)** `bun run run:ios` — this runs `expo prebuild` if needed, compiles native code, and installs **Desktech** with the dev client. Day to day: `bun run start:dev` (Metro with `--dev-client`), then open the app already on the device/emulator (or use the dev-client URL). **Web:** `bun run web` still uses the non-persisted catalog path. **iOS on Windows:** use a Mac or EAS Build (`eas build --profile development`) and install the artifact. Add native deps → run `bun run run:android` / `run:ios` again (or `bun run prebuild` then rebuild).

- **Flex layout / Uniwind:** Do not rely on `className="flex-1"` on `SafeAreaView` from `react-native-safe-area-context`, `KeyboardAvoidingView`, or `ScrollView`. Uniwind often does not apply flex there, which breaks the flex chain (scroll/content height collapses to zero). You may see only `bg-background` and absolutely positioned UI (e.g. a version badge) while the form vanishes. Use `StyleSheet` (e.g. `fill: { flex: 1 }`) or `style={{ flex: 1 }}` on those three; keep `className` for theming on `View`, HeroUI components, and `Text` as usual.

- **Offline-first catalog (native):** `src/lib/data/catalog/*` registers TanStack DB collections with `@tanstack/react-native-db-sqlite-persistence` backed by [`expo-sqlite`](https://docs.expo.dev/versions/latest/sdk/sqlite/) (`src/lib/data/sqlite-db.ts` bridges `executeAsync` to `getAllAsync` / `runAsync` / `execAsync`). On web, the same collections run without SQLite persistence. Domain reads go through `src/lib/queries/business-catalog.ts`, which wraps `useLiveQuery`. Prefer **stale-while-revalidate** in UI: avoid full-screen loading when `data.length > 0` — use `isFetching` / “Updating…” instead.

- **Auth offline:** Session cookies stay in Expo SecureStore via Better Auth (`auth-client.ts`); API `fetch` attaches them in `api-sdk.ts`. Catalog rows live in SQLite, not auth tokens.

- **Replay safety:** `POST .../products` accepts `Idempotency-Key` (see `packages/core` offline idempotency table). With `OfflineExecutorProvider` active (`isOfflineEnabled`), `useCreateProductMutation` queues `catalogCreateProduct` on the outbox, inserts an optimistic row into the default products collection (`activeOnly: true`, empty search), and replays with the same key; otherwise it uses the same header on a direct SDK call (`retry: false`).

- **Reconnect QA:** After offline product create, confirm the optimistic row syncs without duplicate server rows; integration coverage for HTTP replay lives in `packages/core/test/integration/catalog-inventory.test.ts`. Watch ordering of outbox vs query refresh when coming online.
