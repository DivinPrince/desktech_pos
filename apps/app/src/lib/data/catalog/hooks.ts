import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";

import type { BusinessRow, CategoryRow, ProductRow } from "./types";
import { getCatalogCollectionRegistry } from "./collections";

export function useBusinessesLiveRows(enabled: boolean) {
  const queryClient = useQueryClient();
  return useLiveQuery(
    (q) => {
      if (!enabled) return undefined;
      const businesses = getCatalogCollectionRegistry(queryClient).ensureBusinesses(queryClient);
      return q.from({ b: businesses }).select(({ b }) => b);
    },
    [enabled, queryClient],
  );
}

export function useCategoriesLiveRows(businessId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  return useLiveQuery(
    (q) => {
      if (!enabled || !businessId) return undefined;
      const categories = getCatalogCollectionRegistry(queryClient).ensureCategories(
        queryClient,
        businessId,
      );
      return q.from({ c: categories }).select(({ c }) => c);
    },
    [enabled, businessId, queryClient],
  );
}

export function useProductsLiveRows(
  businessId: string | undefined,
  enabled: boolean,
  filters?: { activeOnly?: boolean; search?: string },
) {
  const queryClient = useQueryClient();
  const activeOnly = filters?.activeOnly ?? true;
  const search = (filters?.search ?? "").trim();
  return useLiveQuery(
    (q) => {
      if (!enabled || !businessId) return undefined;
      const products = getCatalogCollectionRegistry(queryClient).ensureProducts(queryClient, businessId, {
        activeOnly,
        search,
      });
      return q.from({ p: products }).select(({ p }) => p);
    },
    [enabled, businessId, queryClient, activeOnly, search],
  );
}

export function useProductLiveRow(
  businessId: string | undefined,
  productId: string | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  return useLiveQuery(
    (q) => {
      if (!enabled || !businessId || !productId) return undefined;
      const productCol = getCatalogCollectionRegistry(queryClient).ensureProduct(
        queryClient,
        businessId,
        productId,
      );
      return q.from({ p: productCol }).where(({ p }) => eq(p.id, productId)).findOne();
    },
    [enabled, businessId, productId, queryClient],
  );
}

export type { BusinessRow, CategoryRow, ProductRow };
