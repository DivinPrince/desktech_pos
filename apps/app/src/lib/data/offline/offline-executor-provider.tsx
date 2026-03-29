import type { OfflineExecutor } from "@tanstack/offline-transactions/react-native";
import { startOfflineExecutor } from "@tanstack/offline-transactions/react-native";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useState } from "react";

import {
  cancelInFlightProductListQueries,
  reconcileProductDeleteInQueryCache,
  reconcileServerProductIntoQueryCache,
} from "@/lib/data/catalog/cache-reconcile";
import { getCatalogCollectionRegistry } from "@/lib/data/catalog/collections";

import { createDesktechOfflineStorageAdapter } from "./async-storage-adapter";
import {
  catalogAdjustStockMutationFn,
  catalogCreateCategoryMutationFn,
  catalogCreateProductMutationFn,
  catalogDeleteCategoryMutationFn,
  catalogDeleteProductMutationFn,
  catalogUpdateCategoryMutationFn,
  catalogUpdateProductMutationFn,
  type CatalogAdjustStockMetadata,
  type CatalogDeleteProductMetadata,
  type CatalogUpdateProductMetadata,
} from "./catalog-mutation-fns";

const OfflineExecutorContext = createContext<OfflineExecutor | null>(null);

type Props = {
  children: React.ReactNode;
  /**
   * When set, the default products collection used for offline create (`activeOnly`, empty search)
   * is registered so outbox serialization can resolve `products.insert` mutations.
   */
  businessId?: string;
};

/**
 * Starts `@tanstack/offline-transactions` with AsyncStorage and registers catalog collections
 * for replay coordination. Must include any collection touched by offline mutations (see `businessId`).
 */
export function OfflineExecutorProvider({ children, businessId }: Props) {
  const queryClient = useQueryClient();
  const [executor, setExecutor] = useState<OfflineExecutor | null>(null);

  useEffect(() => {
    const registry = getCatalogCollectionRegistry(queryClient);
    const storage = createDesktechOfflineStorageAdapter();
    const ex = startOfflineExecutor({
      storage,
      collections: registry.namedCollectionsForOfflineExecutor(queryClient, {
        offlineProductCatalogBusinessId: businessId,
      }),
      mutationFns: {
        _noop: async () => undefined,
        catalogCreateProduct: catalogCreateProductMutationFn,
        catalogCreateCategory: catalogCreateCategoryMutationFn,
        catalogUpdateCategory: catalogUpdateCategoryMutationFn,
        catalogDeleteCategory: catalogDeleteCategoryMutationFn,
        catalogUpdateProduct: async (params) => {
          const row = await catalogUpdateProductMutationFn(params);
          const meta = (params as unknown as { transaction?: { metadata?: CatalogUpdateProductMetadata } })
            .transaction?.metadata;
          if (meta?.businessId) {
            await cancelInFlightProductListQueries(queryClient, meta.businessId);
            reconcileServerProductIntoQueryCache(queryClient, meta.businessId, row);
          }
          return row;
        },
        catalogDeleteProduct: async (params) => {
          await catalogDeleteProductMutationFn(params);
          const meta = (params as unknown as { transaction?: { metadata?: CatalogDeleteProductMetadata } })
            .transaction?.metadata;
          if (meta?.businessId && meta?.productId) {
            await cancelInFlightProductListQueries(queryClient, meta.businessId);
            reconcileProductDeleteInQueryCache(queryClient, meta.businessId, meta.productId);
          }
        },
        catalogAdjustStock: async (params) => {
          const row = await catalogAdjustStockMutationFn(params);
          const meta = (params as unknown as { transaction?: { metadata?: CatalogAdjustStockMetadata } })
            .transaction?.metadata;
          if (meta?.businessId) {
            await cancelInFlightProductListQueries(queryClient, meta.businessId);
            reconcileServerProductIntoQueryCache(queryClient, meta.businessId, row);
          }
          return row;
        },
      },
    });
    setExecutor(ex);
    void ex.waitForInit();
    return () => {
      ex.dispose();
      setExecutor(null);
    };
  }, [queryClient, businessId]);

  return (
    <OfflineExecutorContext.Provider value={executor}>{children}</OfflineExecutorContext.Provider>
  );
}

export function useOfflineExecutor(): OfflineExecutor | null {
  return useContext(OfflineExecutorContext);
}
