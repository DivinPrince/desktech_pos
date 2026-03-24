/** Row shape used by the outbox flush worker (camelCase, mapped from SQLite). */
export type OutboxRow = {
  id: string;
  businessId: string;
  operation: string;
  payload: string;
  idempotencyKey: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
};

export type OutboxRowDb = {
  id: string;
  business_id: string;
  operation: string;
  payload: string;
  idempotency_key: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
};

export function mapOutboxRow(r: OutboxRowDb): OutboxRow {
  return {
    id: r.id,
    businessId: r.business_id,
    operation: r.operation,
    payload: r.payload,
    idempotencyKey: r.idempotency_key,
    status: r.status,
    attemptCount: r.attempt_count,
    lastError: r.last_error,
    createdAt: r.created_at,
  };
}
