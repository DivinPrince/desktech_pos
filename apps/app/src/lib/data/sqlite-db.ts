import {
  createReactNativeSQLitePersistence,
  type OpSQLiteDatabaseLike,
  type PersistedCollectionPersistence,
} from "@tanstack/react-native-db-sqlite-persistence";
import {
  openDatabaseSync,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from "expo-sqlite";
import { Platform } from "react-native";

let database: SQLiteDatabase | null = null;
let persistence: PersistedCollectionPersistence<Record<string, unknown>, string | number> | null =
  null;

function stripLeadingSqlComments(sql: string): string {
  let s = sql.trimStart();
  for (;;) {
    if (s.startsWith("--")) {
      const nl = s.indexOf("\n");
      s = nl === -1 ? "" : s.slice(nl + 1).trimStart();
      continue;
    }
    if (s.startsWith("/*")) {
      const end = s.indexOf("*/");
      s = end === -1 ? "" : s.slice(end + 2).trimStart();
      continue;
    }
    break;
  }
  return s;
}

function sqlFirstKeyword(sql: string): string {
  const head = stripLeadingSqlComments(sql);
  const m = head.match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : "";
}

/**
 * TanStack's persistence driver expects an op-sqlite-shaped `executeAsync(sql, params?)`.
 * Bridge `expo-sqlite` (`getAllAsync` / `runAsync` / `execAsync`) to that contract.
 * @see https://docs.expo.dev/versions/latest/sdk/sqlite/
 */
function expoDatabaseToTanStackShape(db: SQLiteDatabase): OpSQLiteDatabaseLike {
  return {
    executeAsync: async (sql: string, params?: ReadonlyArray<unknown>) => {
      const kw = sqlFirstKeyword(sql);
      const bind =
        params && params.length > 0 ? (params as unknown as SQLiteBindParams) : undefined;

      if (kw === "SELECT" || kw === "WITH" || kw === "EXPLAIN") {
        return bind !== undefined ? db.getAllAsync(sql, bind) : db.getAllAsync(sql);
      }

      if (kw === "PRAGMA") {
        if (/=\s*[^=]/.test(stripLeadingSqlComments(sql))) {
          return bind !== undefined ? db.runAsync(sql, bind) : db.runAsync(sql);
        }
        return bind !== undefined ? db.getAllAsync(sql, bind) : db.getAllAsync(sql);
      }

      if (
        kw === "CREATE" ||
        kw === "DROP" ||
        kw === "ALTER" ||
        kw === "VACUUM" ||
        kw === "REINDEX" ||
        kw === "ANALYZE" ||
        kw === "ATTACH" ||
        kw === "DETACH"
      ) {
        await db.execAsync(sql);
        return undefined;
      }

      return bind !== undefined ? db.runAsync(sql, bind) : db.runAsync(sql);
    },
    close: () => db.closeAsync(),
  };
}

/**
 * Native persistence uses `expo-sqlite` (works in Expo Go and dev builds). Web skips disk persistence.
 */
export function getDesktechSqlite(): SQLiteDatabase | null {
  if (Platform.OS === "web") return null;
  if (!database) {
    database = openDatabaseSync("desktech-pos.sqlite");
  }
  return database;
}

export function getCatalogPersistence(): PersistedCollectionPersistence<
  Record<string, unknown>,
  string | number
> | null {
  if (Platform.OS === "web") return null;
  if (!persistence) {
    const db = getDesktechSqlite();
    if (!db) return null;
    persistence = createReactNativeSQLitePersistence({
      database: expoDatabaseToTanStackShape(db),
    });
  }
  return persistence;
}
