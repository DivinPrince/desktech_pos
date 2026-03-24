import { onlineManager } from "@tanstack/react-query";

import { APIError } from "@repo/sdk";

import { getApiSdk } from "../api-sdk";
import {
  bumpOutboxAttempt,
  listPendingOutbox,
  markOutboxDone,
  markOutboxFailed,
  type CreateDraftSalePayload,
} from "./outbox-ops";
import type { OutboxRow } from "./schema";

const IDEMPOTENCY_HEADER = "Idempotency-Key";

async function sendOutboxRow(row: OutboxRow): Promise<void> {
  const sdk = getApiSdk();
  const headers = { [IDEMPOTENCY_HEADER]: row.idempotencyKey };

  switch (row.operation) {
    case "create_draft_sale": {
      const body = JSON.parse(row.payload) as CreateDraftSalePayload;
      await sdk.businesses.business(row.businessId).createDraftSale(body, { headers });
      return;
    }
    default:
      throw new Error(`Unknown outbox operation: ${row.operation}`);
  }
}

function isClientError(err: unknown): boolean {
  return err instanceof APIError && typeof err.status === "number" && err.status >= 400 && err.status < 500;
}

export async function flushOutboxOnce(): Promise<void> {
  if (!onlineManager.isOnline()) {
    return;
  }

  const pending = await listPendingOutbox(20);
  for (const row of pending) {
    try {
      await sendOutboxRow(row);
      await markOutboxDone(row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isClientError(err)) {
        await markOutboxFailed(row.id, message);
      } else {
        await bumpOutboxAttempt(row.id, message);
      }
    }
  }
}
