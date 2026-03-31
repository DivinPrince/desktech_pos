import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";

import { boundsToListParams, getSalesCollectionRegistry } from "./collections";
import type { SaleRow, SalesRangeBounds } from "./types";

export function useSalesListLiveRows(
  businessId: string | undefined,
  enabled: boolean,
  bounds: SalesRangeBounds | null,
) {
  const queryClient = useQueryClient();
  const startMs = bounds?.startMs;
  const endMs = bounds?.endMs;
  return useLiveQuery(
    (q) => {
      if (!enabled || !businessId || bounds == null) return undefined;
      const { fromIso, toIso, limit } = boundsToListParams(bounds);
      const sales = getSalesCollectionRegistry(queryClient).ensureSalesList(queryClient, businessId, {
        fromIso,
        toIso,
        limit,
      });
      return q.from({ s: sales }).select(({ s }) => s);
    },
    [enabled, businessId, queryClient, startMs, endMs],
  );
}

export function useSaleLiveRow(
  businessId: string | undefined,
  saleId: string | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  return useLiveQuery(
    (q) => {
      if (!enabled || !businessId || !saleId) return undefined;
      const col = getSalesCollectionRegistry(queryClient).ensureSale(queryClient, businessId, saleId);
      return q
        .from({ s: col })
        .where(({ s }) => eq(s.id, saleId))
        .findOne();
    },
    [enabled, businessId, saleId, queryClient],
  );
}

export type { SaleRow, SalesRangeBounds };
