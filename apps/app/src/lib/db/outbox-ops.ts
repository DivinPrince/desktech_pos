import { randomUuidV4 } from "../random-uuid";
import { getOutboxDatabase } from "./index";
import { mapOutboxRow, type OutboxRow, type OutboxRowDb } from "./schema";

export type CreateDraftSalePayload = { tableId?: string };

export async function enqueueCreateDraftSale(
  businessId: string,
  payload: CreateDraftSalePayload,
): Promise<{ outboxId: string; idempotencyKey: string }> {
  const db = getOutboxDatabase();
  const id = randomUuidV4();
  const idempotencyKey = randomUuidV4();
  const now = new Date().toISOString();

  db.runSync(
    `INSERT INTO outbox (id, business_id, operation, payload, idempotency_key, status, attempt_count, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      businessId,
      "create_draft_sale",
      JSON.stringify(payload),
      idempotencyKey,
      "pending",
      0,
      null,
      now,
    ],
  );

  return { outboxId: id, idempotencyKey };
}

export async function countPendingOutbox(): Promise<number> {
  const db = getOutboxDatabase();
  const row = db.getFirstSync<{ c: number }>(
    `SELECT COUNT(*) as c FROM outbox WHERE status = ?`,
    ["pending"],
  );
  return row?.c ?? 0;
}

export async function listPendingOutbox(limit = 25): Promise<OutboxRow[]> {
  const db = getOutboxDatabase();
  const rows = db.getAllSync<OutboxRowDb>(
    `SELECT * FROM outbox WHERE status = ? ORDER BY created_at ASC LIMIT ?`,
    ["pending", limit],
  );
  return rows.map(mapOutboxRow);
}

export async function markOutboxDone(id: string): Promise<void> {
  const db = getOutboxDatabase();
  db.runSync(`UPDATE outbox SET status = ? WHERE id = ?`, ["done", id]);
}

export async function markOutboxFailed(id: string, message: string): Promise<void> {
  const db = getOutboxDatabase();
  db.runSync(`UPDATE outbox SET status = ?, last_error = ? WHERE id = ?`, [
    "failed",
    message.slice(0, 2000),
    id,
  ]);
}

export async function bumpOutboxAttempt(id: string, message: string): Promise<void> {
  const db = getOutboxDatabase();
  const row = db.getFirstSync<{ attempt_count: number }>(
    `SELECT attempt_count FROM outbox WHERE id = ?`,
    [id],
  );
  const next = (row?.attempt_count ?? 0) + 1;
  db.runSync(`UPDATE outbox SET attempt_count = ?, last_error = ? WHERE id = ?`, [
    next,
    message.slice(0, 2000),
    id,
  ]);
}
