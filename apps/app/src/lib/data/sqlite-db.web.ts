import type { PersistedCollectionPersistence } from "@tanstack/react-native-db-sqlite-persistence";

/**
 * Web: no local SQLite (and Bun's hoisted `expo-sqlite` install may omit `.wasm` assets).
 * Collections use in-memory `createCollection` when persistence is null.
 */
export function getDesktechSqlite(): null {
  return null;
}

export function getCatalogPersistence(): PersistedCollectionPersistence<
  Record<string, unknown>,
  string | number
> | null {
  return null;
}
