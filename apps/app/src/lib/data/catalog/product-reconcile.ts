import type { QueryClient } from "@tanstack/react-query";

import { cancelInFlightProductListQueries } from "./cache-reconcile";
import { getCatalogCollectionRegistry } from "./collections";
import { catalogDataKeys } from "./keys";
import type { ProductRow } from "./types";

/**
 * Swap optimistic product (`local_*`) for the authoritative server row across list slices,
 * query cache, and per-product collections. Cancels in-flight list fetches first (same race as
 * PATCH — see `cache-reconcile.ts`).
 */
export async function reconcileCreatedProduct(
  queryClient: QueryClient,
  businessId: string,
  optimisticLocalId: string,
  serverRow: ProductRow,
): Promise<void> {
  await cancelInFlightProductListQueries(queryClient, businessId);

  const registry = getCatalogCollectionRegistry(queryClient);
  registry.mirrorProductDelete(queryClient, businessId, optimisticLocalId);
  registry.mirrorProductInsert(queryClient, businessId, serverRow);

  const matches = queryClient.getQueryCache().findAll({
    queryKey: ["catalog", businessId, "products"],
    exact: false,
  });
  for (const q of matches) {
    const key = q.queryKey;
    const cached = queryClient.getQueryData<ProductRow[]>(key);
    if (!cached || !Array.isArray(cached)) continue;
    const withoutLocal = cached.filter((p) => p.id !== optimisticLocalId);
    const next = withoutLocal.some((p) => p.id === serverRow.id)
      ? withoutLocal.map((p) => (p.id === serverRow.id ? serverRow : p))
      : [...withoutLocal, serverRow];
    queryClient.setQueryData(key, next);
  }

  queryClient.removeQueries({
    queryKey: catalogDataKeys.product(businessId, optimisticLocalId),
    exact: true,
  });
  registry.removeProductDetailIfLoaded(businessId, optimisticLocalId);

  queryClient.setQueryData(catalogDataKeys.product(businessId, serverRow.id), [serverRow]);
  const serverDetail = registry.ensureProduct(queryClient, businessId, serverRow.id);
  try {
    serverDetail.insert(serverRow);
  } catch {
    try {
      serverDetail.update(serverRow.id, (d) => {
        Object.assign(d, serverRow);
      });
    } catch {
      /* best effort */
    }
  }
}
