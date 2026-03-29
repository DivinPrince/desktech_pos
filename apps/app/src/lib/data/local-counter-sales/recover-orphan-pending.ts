import type { SaleService } from "@repo/core/pos";
import { APIError } from "@repo/sdk";
import type { QueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { getApiSdk } from "@/lib/api-sdk";
import { PAYMENT_OPTIONS } from "@/lib/counter-checkout/payment-options";
import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";
import {
  cancelInFlightProductListQueries,
  reconcileServerProductIntoQueryCache,
} from "@/lib/data/catalog/cache-reconcile";
import {
  catalogCompleteCounterSaleMutationFn,
  type CatalogOfflineMutationParams,
} from "@/lib/data/offline/catalog-mutation-fns";

import { listLocalSalesForLocalCalendarDay, patchSaleIdIfPending } from "./store";

type SaleInfo = z.infer<typeof SaleService.SaleInfo>;

function localDayBoundsIso(day: Date): { fromIso: string; toIso: string } {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

function sortedLineFingerprint(
  lines: { productId: string; quantity: number; unitPriceCents: number }[],
): string {
  return [...lines]
    .map((l) => `${l.productId}:${l.quantity}:${l.unitPriceCents}`)
    .sort()
    .join("|");
}

function receiptMatchesSale(receipt: CompletedSaleReceipt, sale: SaleInfo): boolean {
  if (sale.status !== "completed") return false;
  if (sale.totalCents !== receipt.totalCents) return false;
  if (sale.lines.length !== receipt.lines.length) return false;
  const fromReceipt = sortedLineFingerprint(
    receipt.lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPriceCents: l.priceCents,
    })),
  );
  const fromServer = sortedLineFingerprint(
    sale.lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
    })),
  );
  return fromReceipt === fromServer;
}

function pickBestServerSale(
  sales: SaleInfo[],
  receipt: CompletedSaleReceipt,
  completedAtMs: number,
  excludeIds: Set<string>,
): SaleInfo | undefined {
  const candidates = sales.filter((s) => !excludeIds.has(s.id) && receiptMatchesSale(receipt, s));
  if (candidates.length === 0) return undefined;
  const target = completedAtMs;
  return candidates.reduce((best, cur) => {
    const ca = cur.completedAt ? new Date(cur.completedAt).getTime() : 0;
    const ba = best.completedAt ? new Date(best.completedAt).getTime() : 0;
    const dc = Math.abs(ca - target);
    const db = Math.abs(ba - target);
    return dc < db ? cur : best;
  });
}

export type RecoverOrphanResult = {
  title: string;
  message: string;
  reconciledFromServer: number;
  uploaded: number;
  listSkippedReason?: string;
};

/**
 * When the outbox is empty but SQLite still has `pending:…` rows, either link them to an
 * existing completed sale (GET /sales) or re-submit the receipt through the normal checkout API.
 */
export async function recoverOrphanPendingLocalSales(args: {
  businessId: string;
  queryClient: QueryClient;
}): Promise<RecoverOrphanResult> {
  const { businessId, queryClient } = args;
  const todayRows = await listLocalSalesForLocalCalendarDay(businessId, new Date());
  const pendings = todayRows.filter((r) => r.id.startsWith("pending:"));
  if (pendings.length === 0) {
    return {
      title: "No orphaned pending rows",
      message: "There are no local sales with a pending:… id for today.",
      reconciledFromServer: 0,
      uploaded: 0,
    };
  }

  const sdk = getApiSdk();
  const scoped = sdk.businesses.business(businessId);
  const { fromIso, toIso } = localDayBoundsIso(new Date());

  let serverSales: SaleInfo[] = [];
  let listSkippedReason: string | undefined;
  try {
    const { data } = await scoped
      .listSales({
        status: "completed",
        from: fromIso,
        to: toIso,
        limit: "200",
      })
      .withResponse();
    serverSales = data.data;
  } catch (e: unknown) {
    if (e instanceof APIError && e.status === 403) {
      listSkippedReason =
        "Could not list sales (needs manager role) — skipped matching on the server; will try upload only.";
    } else {
      listSkippedReason = `Could not list sales (${e instanceof Error ? e.message : String(e)}); will try upload only.`;
    }
  }

  let reconciledFromServer = 0;
  let uploaded = 0;
  const errors: string[] = [];
  const usedServerSaleIds = new Set<string>();

  for (const row of pendings) {
    const match =
      serverSales.length > 0
        ? pickBestServerSale(serverSales, row.receipt, row.completedAtMs, usedServerSaleIds)
        : undefined;

    if (match) {
      usedServerSaleIds.add(match.id);
      try {
        await patchSaleIdIfPending({
          businessId,
          pendingSaleId: row.id,
          finalSaleId: match.id,
        });
        reconciledFromServer++;
      } catch (e) {
        errors.push(`Link ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }

    const option = PAYMENT_OPTIONS.find((o) => o.key === row.receipt.paymentMethodKey);
    if (!option) {
      errors.push(`${row.id}: unknown payment method`);
      continue;
    }

    const bodyPayload = {
      lines: row.receipt.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPriceCents: l.priceCents,
      })),
      paymentMethod: option.apiValue,
    };

    try {
      const replayParams = {
        idempotencyKey: row.id.slice("pending:".length),
        transaction: { metadata: { businessId, body: bodyPayload } },
      } satisfies CatalogOfflineMutationParams;
      const result = await catalogCompleteCounterSaleMutationFn(
        replayParams as unknown as Parameters<typeof catalogCompleteCounterSaleMutationFn>[0],
      );
      await cancelInFlightProductListQueries(queryClient, businessId);
      for (const prod of result.products) {
        reconcileServerProductIntoQueryCache(queryClient, businessId, prod);
      }
      await patchSaleIdIfPending({
        businessId,
        pendingSaleId: row.id,
        finalSaleId: result.sale.id,
      });
      uploaded++;
    } catch (e) {
      errors.push(`Upload ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const parts: string[] = [];
  if (listSkippedReason) parts.push(listSkippedReason);
  parts.push(
    `Linked from server (already completed): ${reconciledFromServer}. Re‑uploaded: ${uploaded}. Errors: ${errors.length}.`,
  );
  if (errors.length > 0) parts.push(`\n${errors.join("\n")}`);

  const progress = reconciledFromServer + uploaded;
  const title =
    errors.length > 0
      ? "Some pending sales could not be fixed"
      : progress > 0
        ? "Recovered pending sales"
        : "No pending sales were updated";

  return {
    title,
    message: parts.join("\n"),
    reconciledFromServer,
    uploaded,
    listSkippedReason,
  };
}
