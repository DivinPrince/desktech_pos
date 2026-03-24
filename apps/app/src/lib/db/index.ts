import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

export type { OutboxRow } from "./schema";

let rawDb: SQLiteDatabase | null = null;

function runLocalMigrationsOn(db: SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS "outbox" (
      "id" text PRIMARY KEY NOT NULL,
      "business_id" text NOT NULL,
      "operation" text NOT NULL,
      "payload" text NOT NULL,
      "idempotency_key" text NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "attempt_count" integer DEFAULT 0 NOT NULL,
      "last_error" text,
      "created_at" text NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "outbox_idempotency_key_unique" ON "outbox" ("idempotency_key");
    CREATE TABLE IF NOT EXISTS "sync_meta" (
      "key" text PRIMARY KEY NOT NULL,
      "value" text NOT NULL
    );
  `);
}

/**
 * Shared SQLite handle for the local outbox. Migrations run on first open.
 * Uses expo-sqlite only (no Drizzle) so Metro can bundle the app reliably.
 */
export function getOutboxDatabase(): SQLiteDatabase {
  if (!rawDb) {
    rawDb = openDatabaseSync("desktech_pos.db");
    runLocalMigrationsOn(rawDb);
  }
  return rawDb;
}

/** Idempotent; safe to call if the DB is already open. */
export function runLocalMigrations(): void {
  runLocalMigrationsOn(getOutboxDatabase());
}
