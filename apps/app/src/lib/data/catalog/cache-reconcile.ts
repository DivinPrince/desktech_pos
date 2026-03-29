import type { QueryClient } from "@tanstack/react-query";

import { catalogDataKeys } from "./keys";
import type { ProductRow } from "./types";

/**
 * Abort list fetches that may have started before a product PATCH completed; their results
 * would otherwise be applied by query-db-collection and overwrite the optimistic row.
 */
export async function cancelInFlightProductListQueries(
  queryClient: QueryClient,
  businessId: string,
): Promise<void> {
  await queryClient.cancelQueries({
    queryKey: ["catalog", businessId, "products"],
    exact: false,
  });
}

/** Push the authoritative product row into every cached list slice + the per-product query. */
export function reconcileServerProductIntoQueryCache(
  queryClient: QueryClient,
  businessId: string,
  serverRow: ProductRow,
): void {
  const matches = queryClient.getQueryCache().findAll({
    queryKey: ["catalog", businessId, "products"],
    exact: false,
  });

  for (const q of matches) {
    const key = q.queryKey;
    const cached = queryClient.getQueryData<ProductRow[]>(key);
    if (!cached || !Array.isArray(cached)) continue;
    const idx = cached.findIndex((p) => p.id === serverRow.id);
    if (idx === -1) continue;
    const next = [...cached];
    next[idx] = serverRow;
    queryClient.setQueryData(key, next);
  }

  queryClient.setQueryData(catalogDataKeys.product(businessId, serverRow.id), [serverRow]);
}

export function reconcileProductDeleteInQueryCache(
  queryClient: QueryClient,
  businessId: string,
  productId: string,
): void {
  const matches = queryClient.getQueryCache().findAll({
    queryKey: ["catalog", businessId, "products"],
    exact: false,
  });

  for (const q of matches) {
    const key = q.queryKey;
    const cached = queryClient.getQueryData<ProductRow[]>(key);
    if (!cached || !Array.isArray(cached)) continue;
    if (!cached.some((p) => p.id === productId)) continue;
    queryClient.setQueryData(
      key,
      cached.filter((p) => p.id !== productId),
    );
  }

  queryClient.removeQueries({
    queryKey: catalogDataKeys.product(businessId, productId),
    exact: true,
  });
}
