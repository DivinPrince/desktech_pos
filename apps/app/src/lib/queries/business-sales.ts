import type { QueryCollectionUtils } from "@tanstack/query-db-collection";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { CartLine } from "@/lib/counter-cart/counter-cart";
import {
  cancelInFlightProductListQueries,
  reconcileServerProductIntoQueryCache,
} from "@/lib/data/catalog/cache-reconcile";
import { getCatalogCollectionRegistry } from "@/lib/data/catalog/collections";
import type { ProductRow } from "@/lib/data/catalog/types";
import { getSalesCollectionRegistry } from "@/lib/data/sales/collections";
import { useSalesListLiveRows, useSaleLiveRow } from "@/lib/data/sales/hooks";
import { buildOptimisticCounterSaleRow } from "@/lib/data/sales/optimistic-sale";
import {
  hydrateSaleReceiptExtras,
  getSaleReceiptExtrasSync,
  moveSaleReceiptExtras,
  setSaleReceiptExtras as persistSaleReceiptExtras,
} from "@/lib/data/sales/receipt-extras";
import { saleRowToCounterSaleRow } from "@/lib/data/sales/sale-to-receipt";
import { salesDataKeys } from "@/lib/data/sales/keys";
import type { CounterSaleRow, SaleRow, SalesRangeBounds } from "@/lib/data/sales/types";
import { reportPeriodBounds } from "@/lib/data/sales/report-period-bounds";
import {
  catalogCompleteCounterSaleMutationFn,
  type CatalogOfflineMutationParams,
} from "@/lib/data/offline/catalog-mutation-fns";
import { runCatalogOutboxMutation } from "@/lib/data/offline/catalog-outbox";
import { useOfflineExecutor } from "@/lib/data/offline/offline-executor-provider";
import { fetchDeviceAppearsOnline } from "@/lib/network/fetch-device-online";
import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";
import type { PaymentMethodKey } from "@/lib/counter-checkout/types";
import type { StockAdjustBody } from "@/lib/queries/business-catalog";

function salesUtils<T extends object>(
  collection: unknown,
): QueryCollectionUtils<T, string, T, unknown> | undefined {
  const c = collection as { utils?: QueryCollectionUtils<T, string, T, unknown> } | null | undefined;
  return c?.utils;
}

export const salesKeys = {
  root: (businessId: string) => salesDataKeys.root(businessId),
};

function invalidateSalesQueries(queryClient: QueryClient, businessId: string | undefined) {
  if (businessId) {
    void queryClient.invalidateQueries({ queryKey: salesDataKeys.root(businessId), exact: false });
  }
}

function randomIdempotencyKey(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function assertStockAdjustAllowed(snapshot: ProductRow, body: StockAdjustBody): void {
  if (snapshot.quantityOnHand + body.quantityDelta < 0) {
    throw new Error("Insufficient stock for this adjustment");
  }
}

function applyStockAdjustDraft(draft: ProductRow, body: StockAdjustBody): void {
  draft.quantityOnHand += body.quantityDelta;
  draft.updatedAt = new Date();
}

/** Undo local stock + pending sale rows after an online checkout API failure. */
function rollbackCounterCheckoutOptimism(args: {
  catalogReg: ReturnType<typeof getCatalogCollectionRegistry>;
  salesReg: ReturnType<typeof getSalesCollectionRegistry>;
  queryClient: QueryClient;
  businessId: string;
  pendingSaleId: string;
  stockBodies: StockAdjustBody[];
}): void {
  const { catalogReg, salesReg, queryClient, businessId, pendingSaleId, stockBodies } = args;
  for (const body of stockBodies) {
    const revert: StockAdjustBody = {
      ...body,
      quantityDelta: -body.quantityDelta,
    };
    catalogReg.mirrorProductUpdate(queryClient, businessId, revert.productId, (d) =>
      applyStockAdjustDraft(d, revert),
    );
    try {
      const coll = catalogReg.ensureProduct(queryClient, businessId, revert.productId);
      coll.update(revert.productId, (d) => applyStockAdjustDraft(d, revert));
    } catch {
      /* row missing in detail slice */
    }
  }
  salesReg.mirrorSaleDeleteFromMatchingLists(queryClient, businessId, pendingSaleId);
  try {
    salesReg.ensureSale(queryClient, businessId, pendingSaleId).delete(pendingSaleId);
  } catch {
    /* */
  }
}

export function useSalesRangeQuery(
  businessId: string | undefined,
  enabled: boolean,
  bounds: SalesRangeBounds | null,
  meta: { currency: string; businessName?: string },
) {
  const live = useSalesListLiveRows(businessId, enabled, bounds);
  const rows: CounterSaleRow[] = useMemo(() => {
    if (!businessId) return [];
    const raw = live.data ?? [];
    const mapped = raw.map((s) =>
      saleRowToCounterSaleRow({
        sale: s,
        businessId,
        currency: meta.currency,
        businessName: meta.businessName,
        extras: getSaleReceiptExtrasSync(s.id),
      }),
    );
    return [...mapped].sort((a, b) => b.completedAtMs - a.completedAtMs);
  }, [live.data, businessId, meta.currency, meta.businessName]);

  const utils = salesUtils<SaleRow>(live.collection);
  return {
    data: rows,
    isPending: live.isLoading && rows.length === 0,
    isFetching: utils?.isFetching ?? false,
    isLoading: live.isLoading,
    isSuccess: live.isReady,
    isError: live.isError,
    error: utils?.lastError ?? null,
    refetch: () => utils?.refetch?.() ?? Promise.resolve(),
  };
}

export function useSalesTodayQuery(
  businessId: string | undefined,
  enabled: boolean,
  meta: { currency: string; businessName?: string },
) {
  const bounds = useMemo(() => reportPeriodBounds("today", new Date()), []);
  return useSalesRangeQuery(businessId, enabled, bounds, meta);
}

export function useSaleDetailQuery(
  businessId: string | undefined,
  saleId: string | undefined,
  enabled: boolean,
  meta: { currency: string; businessName?: string },
) {
  const queryClient = useQueryClient();
  if (enabled && businessId && saleId) {
    getSalesCollectionRegistry(queryClient).hydrateSaleDetailFromListCaches(
      queryClient,
      businessId,
      saleId,
    );
  }
  const live = useSaleLiveRow(businessId, saleId, enabled);
  const peeked =
    enabled && businessId && saleId
      ? getSalesCollectionRegistry(queryClient).getSaleRowFromAnyListCache(
          queryClient,
          businessId,
          saleId,
        )
      : undefined;
  const sale = (live.data ?? peeked) as SaleRow | undefined;

  const counterRow: CounterSaleRow | undefined = useMemo(() => {
    if (!businessId || !sale) return undefined;
    return saleRowToCounterSaleRow({
      sale,
      businessId,
      currency: meta.currency,
      businessName: meta.businessName,
      extras: getSaleReceiptExtrasSync(sale.id),
    });
  }, [businessId, sale, meta.currency, meta.businessName]);

  const utils = salesUtils<SaleRow>(live.collection);
  const isError = live.isError && sale == null;
  return {
    sale,
    counterRow,
    receipt: counterRow?.receipt,
    isPending: live.isLoading && sale == null,
    isFetching: utils?.isFetching ?? false,
    isLoading: live.isLoading,
    isSuccess: live.isReady,
    isError,
    error: utils?.lastError ?? null,
    refetch: () => utils?.refetch?.() ?? Promise.resolve(),
  };
}

export type CompleteCounterSaleMutationResult = {
  saleId: string;
  totalCents: number;
  completedAtIso: string;
};

/**
 * Counter checkout: stock decrement + optimistic sale in sales collections, then outbox or background API.
 */
export function useCompleteCounterSaleMutation(businessId: string | undefined) {
  const executor = useOfflineExecutor();
  const queryClient = useQueryClient();

  const invalidateCatalog = () => {
    if (businessId) {
      void queryClient.invalidateQueries({ queryKey: ["catalog", businessId], exact: false });
    }
  };

  return useMutation({
    retry: false,
    mutationFn: async (input: {
      lines: CartLine[];
      paymentMethod: string;
    }): Promise<CompleteCounterSaleMutationResult> => {
      if (!businessId) throw new Error("Missing business");

      void hydrateSaleReceiptExtras();

      const catalogReg = getCatalogCollectionRegistry(queryClient);
      const salesReg = getSalesCollectionRegistry(queryClient);
      const stockBodies: StockAdjustBody[] = [];

      for (const line of input.lines) {
        const single = catalogReg.ensureProduct(queryClient, businessId, line.productId);
        const snap = single.get(line.productId) as ProductRow | undefined;
        if (!snap) continue;
        if (!snap.trackStock) continue;
        const body: StockAdjustBody = {
          productId: line.productId,
          quantityDelta: -line.quantity,
          type: "sale",
        };
        assertStockAdjustAllowed(snap, body);
        stockBodies.push(body);
      }

      const applyStock = () => {
        for (const body of stockBodies) {
          catalogReg.mirrorProductUpdate(queryClient, businessId, body.productId, (d) =>
            applyStockAdjustDraft(d, body),
          );
          try {
            const coll = catalogReg.ensureProduct(queryClient, businessId, body.productId);
            coll.update(body.productId, (d) => applyStockAdjustDraft(d, body));
          } catch {
            /* row missing in detail slice */
          }
        }
      };

      const bodyPayload = {
        lines: input.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPriceCents: l.priceCents,
        })),
        paymentMethod: input.paymentMethod,
      };

      const totalFromLines = input.lines.reduce((s, l) => s + l.priceCents * l.quantity, 0);
      const completedAt = new Date();

      const appearsOnline =
        !executor?.isOfflineEnabled || (await fetchDeviceAppearsOnline());

      const finishReplay = async (
        pendingSaleId: string,
        result: { sale: SaleRow; products: ProductRow[] },
      ) => {
        await cancelInFlightProductListQueries(queryClient, businessId);
        for (const row of result.products) {
          reconcileServerProductIntoQueryCache(queryClient, businessId, row);
        }
        salesReg.reconcilePendingCounterSale(queryClient, businessId, pendingSaleId, result.sale);
        try {
          await moveSaleReceiptExtras(pendingSaleId, result.sale.id);
        } catch {
          /* best-effort */
        }
      };

      if (executor?.isOfflineEnabled && !appearsOnline) {
        const idempotencyKey = randomIdempotencyKey();
        const pendingSaleId = `pending:${idempotencyKey}`;
        const optimisticRow = buildOptimisticCounterSaleRow({
          businessId,
          pendingSaleId,
          lines: input.lines,
          paymentMethod: input.paymentMethod,
          totalCents: totalFromLines,
          completedAt,
        });
        return runCatalogOutboxMutation({
          executor,
          mutationFnName: "catalogCompleteCounterSale",
          idempotencyKey,
          metadata: { businessId, body: bodyPayload },
          mutate: () => {
            applyStock();
            salesReg.mirrorSaleInsertIntoMatchingLists(queryClient, businessId, optimisticRow);
          },
          optimisticResult: {
            saleId: pendingSaleId,
            totalCents: totalFromLines,
            completedAtIso: completedAt.toISOString(),
          },
          invalidate: invalidateCatalog,
          invalidateAfterSuccess: false,
        });
      }

      const idempotencyKey = randomIdempotencyKey();
      const pendingSaleId = `pending:${idempotencyKey}`;
      const optimisticRow = buildOptimisticCounterSaleRow({
        businessId,
        pendingSaleId,
        lines: input.lines,
        paymentMethod: input.paymentMethod,
        totalCents: totalFromLines,
        completedAt,
      });

      applyStock();
      salesReg.mirrorSaleInsertIntoMatchingLists(queryClient, businessId, optimisticRow);

      try {
        const replayParams = {
          idempotencyKey,
          transaction: { metadata: { businessId, body: bodyPayload } },
        } satisfies CatalogOfflineMutationParams;
        const result = await catalogCompleteCounterSaleMutationFn(
          replayParams as unknown as Parameters<typeof catalogCompleteCounterSaleMutationFn>[0],
        );
        await finishReplay(pendingSaleId, result);
        const sale = result.sale;
        const doneAt = sale.completedAt ?? completedAt;
        return {
          saleId: sale.id,
          totalCents: sale.totalCents,
          completedAtIso: doneAt.toISOString(),
        };
      } catch (e) {
        rollbackCounterCheckoutOptimism({
          catalogReg,
          salesReg,
          queryClient,
          businessId,
          pendingSaleId,
          stockBodies,
        });
        invalidateCatalog();
        invalidateSalesQueries(queryClient, businessId);
        if (__DEV__) {
          console.warn(
            "[desktech] catalogCompleteCounterSale failed (createDraft / setLines / completeSale)",
            e,
          );
        }
        throw e;
      }
    },
  });
}

/** Call after checkout so receipt screens can show customer / note (not stored on server). */
export async function persistCounterCheckoutReceiptExtras(args: {
  saleId: string;
  receipt: CompletedSaleReceipt;
}): Promise<void> {
  const { saleId, receipt } = args;
  await persistSaleReceiptExtras(saleId, {
    customer: receipt.customer,
    paymentNote: receipt.paymentNote,
    paymentMethodKey: receipt.paymentMethodKey as PaymentMethodKey,
    paymentMethodLabel: receipt.paymentMethodLabel,
    currency: receipt.currency,
    businessName: receipt.businessName,
  });
}
