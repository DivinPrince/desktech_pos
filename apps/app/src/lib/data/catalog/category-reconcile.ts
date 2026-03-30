import type { QueryClient } from "@tanstack/react-query";

import { getCatalogCollectionRegistry } from "./collections";
import { catalogDataKeys } from "./keys";
import type { CategoryRow, ProductRow } from "./types";

const listeners = new Map<string, Set<(serverId: string) => void>>();

/**
 * When an optimistic category (`local_*`) is replaced by the server id, UI that still holds the
 * local id can subscribe once and update selection.
 */
export function subscribeCategoryLocalIdRemap(
  localCategoryId: string,
  onRemap: (serverCategoryId: string) => void,
): () => void {
  let set = listeners.get(localCategoryId);
  if (!set) {
    set = new Set();
    listeners.set(localCategoryId, set);
  }
  set.add(onRemap);
  return () => {
    const bucket = listeners.get(localCategoryId);
    if (!bucket) return;
    bucket.delete(onRemap);
    if (bucket.size === 0) listeners.delete(localCategoryId);
  };
}

export function notifyCategoryLocalIdRemap(localCategoryId: string, serverCategoryId: string): void {
  const bucket = listeners.get(localCategoryId);
  if (!bucket) return;
  for (const fn of bucket) fn(serverCategoryId);
  listeners.delete(localCategoryId);
}

export async function cancelInFlightCategoryListQueries(
  queryClient: QueryClient,
  businessId: string,
): Promise<void> {
  await queryClient.cancelQueries({
    queryKey: catalogDataKeys.categoriesRoot(businessId),
    exact: true,
  });
}

function collectProductIdsWithCategory(
  queryClient: QueryClient,
  businessId: string,
  categoryId: string,
): string[] {
  const touched = new Set<string>();
  const listMatches = queryClient.getQueryCache().findAll({
    queryKey: ["catalog", businessId, "products"],
    exact: false,
  });
  for (const q of listMatches) {
    const cached = queryClient.getQueryData<ProductRow[]>(q.queryKey);
    if (!cached || !Array.isArray(cached)) continue;
    for (const p of cached) {
      if (p.categoryId === categoryId) touched.add(p.id);
    }
  }
  const detailMatches = queryClient.getQueryCache().findAll({
    queryKey: ["catalog", businessId, "product"],
    exact: false,
  });
  for (const q of detailMatches) {
    const cached = queryClient.getQueryData<ProductRow[]>(q.queryKey);
    const p = cached?.[0];
    if (p?.categoryId === categoryId) touched.add(p.id);
  }
  return [...touched];
}

function patchProductQueryCachesCategoryId(
  queryClient: QueryClient,
  businessId: string,
  fromCategoryId: string,
  toCategoryId: string,
): void {
  const listMatches = queryClient.getQueryCache().findAll({
    queryKey: ["catalog", businessId, "products"],
    exact: false,
  });
  for (const q of listMatches) {
    const cached = queryClient.getQueryData<ProductRow[]>(q.queryKey);
    if (!cached || !Array.isArray(cached)) continue;
    if (!cached.some((p) => p.categoryId === fromCategoryId)) continue;
    queryClient.setQueryData(
      q.queryKey,
      cached.map((p) =>
        p.categoryId === fromCategoryId
          ? { ...p, categoryId: toCategoryId, updatedAt: new Date() }
          : p,
      ),
    );
  }
  const detailMatches = queryClient.getQueryCache().findAll({
    queryKey: ["catalog", businessId, "product"],
    exact: false,
  });
  for (const q of detailMatches) {
    const cached = queryClient.getQueryData<ProductRow[]>(q.queryKey);
    if (!cached || cached.length === 0) continue;
    const p = cached[0];
    if (p && p.categoryId === fromCategoryId) {
      queryClient.setQueryData(q.queryKey, [
        { ...p, categoryId: toCategoryId, updatedAt: new Date() },
      ]);
    }
  }
}

/**
 * Swap optimistic category row for the server row and remap `categoryId` on products still
 * referencing the temporary id.
 */
export async function reconcileCreatedCategory(
  queryClient: QueryClient,
  businessId: string,
  optimisticLocalId: string,
  serverRow: CategoryRow,
): Promise<void> {
  await cancelInFlightCategoryListQueries(queryClient, businessId);

  const registry = getCatalogCollectionRegistry(queryClient);
  const categories = registry.ensureCategories(queryClient, businessId);

  try {
    categories.delete(optimisticLocalId);
  } catch {
    /* row may already be gone */
  }
  try {
    categories.insert(serverRow);
  } catch {
    /* duplicate from race; prefer authoritative row */
    try {
      categories.update(serverRow.id, (d) => {
        Object.assign(d, serverRow);
      });
    } catch {
      /* best effort */
    }
  }

  const catKey = catalogDataKeys.categoriesRoot(businessId);
  const catCached = queryClient.getQueryData<CategoryRow[]>(catKey);
  if (catCached && Array.isArray(catCached)) {
    const withoutLocal = catCached.filter((c) => c.id !== optimisticLocalId);
    const hasDup = withoutLocal.some((c) => c.id === serverRow.id);
    queryClient.setQueryData(catKey, hasDup ? withoutLocal : [...withoutLocal, serverRow]);
  }

  const productIds = collectProductIdsWithCategory(queryClient, businessId, optimisticLocalId);
  for (const productId of productIds) {
    registry.mirrorProductUpdate(queryClient, businessId, productId, (d) => {
      if (d.categoryId === optimisticLocalId) {
        d.categoryId = serverRow.id;
        d.updatedAt = new Date();
      }
    });
    try {
      const single = registry.ensureProduct(queryClient, businessId, productId);
      single.update(productId, (d) => {
        if (d.categoryId === optimisticLocalId) {
          d.categoryId = serverRow.id;
          d.updatedAt = new Date();
        }
      });
    } catch {
      /* detail slice may not exist */
    }
  }

  patchProductQueryCachesCategoryId(queryClient, businessId, optimisticLocalId, serverRow.id);

  // Defer so `useMutation` `onSuccess` can `subscribeCategoryLocalIdRemap` first (fast LAN APIs
  // can otherwise reconcile before React schedules the success handler).
  setTimeout(() => {
    notifyCategoryLocalIdRemap(optimisticLocalId, serverRow.id);
  }, 0);
}
