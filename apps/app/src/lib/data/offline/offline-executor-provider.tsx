import type { OfflineExecutor } from "@tanstack/offline-transactions/react-native";
import { startOfflineExecutor } from "@tanstack/offline-transactions/react-native";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useState } from "react";

import {
  cancelInFlightProductListQueries,
  reconcileProductDeleteInQueryCache,
  reconcileServerProductIntoQueryCache,
} from "@/lib/data/catalog/cache-reconcile";
import { reconcileCreatedCategory } from "@/lib/data/catalog/category-reconcile";
import { getCatalogCollectionRegistry } from "@/lib/data/catalog/collections";
import { getSalesCollectionRegistry } from "@/lib/data/sales/collections";
import { moveSaleReceiptExtras } from "@/lib/data/sales/receipt-extras";

import { createDesktechOfflineStorageAdapter } from "./async-storage-adapter";
import {
  catalogAdjustStockMutationFn,
  catalogCompleteCounterSaleMutationFn,
  catalogCreateCategoryMutationFn,
  catalogCreateProductMutationFn,
  catalogDeleteCategoryMutationFn,
  catalogDeleteProductMutationFn,
  catalogUpdateCategoryMutationFn,
  catalogUpdateProductMutationFn,
  type CatalogAdjustStockMetadata,
  type CatalogCompleteCounterSaleMetadata,
  type CatalogCreateCategoryMetadata,
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
    const catalogRegistry = getCatalogCollectionRegistry(queryClient);
    const salesRegistry = getSalesCollectionRegistry(queryClient);
    if (businessId) {
      salesRegistry.prefetchOfflineSalesWindows(queryClient, businessId);
    }
    const storage = createDesktechOfflineStorageAdapter();
    const catalogCols = catalogRegistry.namedCollectionsForOfflineExecutor(queryClient, {
      offlineProductCatalogBusinessId: businessId,
    });
    const salesCols = salesRegistry.namedCollectionsForOfflineExecutor(queryClient, businessId);
    const ex = startOfflineExecutor({
      storage,
      collections: { ...catalogCols, ...salesCols },
      mutationFns: {
        _noop: async () => undefined,
        catalogCreateProduct: catalogCreateProductMutationFn,
        catalogCreateCategory: async (params) => {
          const row = await catalogCreateCategoryMutationFn(params);
          const meta = (params as unknown as { transaction?: { metadata?: CatalogCreateCategoryMetadata } })
            .transaction?.metadata;
          if (meta?.businessId && meta.optimisticLocalId) {
            await reconcileCreatedCategory(
              queryClient,
              meta.businessId,
              meta.optimisticLocalId,
              row,
            );
          } else if (meta?.businessId) {
            void queryClient.invalidateQueries({
              queryKey: ["catalog", meta.businessId],
              exact: false,
            });
          }
          return row;
        },
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
        catalogCompleteCounterSale: async (params) => {
          const result = await catalogCompleteCounterSaleMutationFn(params);
          const typed = params as unknown as {
            idempotencyKey: string;
            transaction?: { metadata?: CatalogCompleteCounterSaleMetadata };
          };
          const meta = typed.transaction?.metadata;
          const pendingId = `pending:${typed.idempotencyKey}`;
          if (meta?.businessId && result.sale.id !== pendingId) {
            try {
              salesRegistry.reconcilePendingCounterSale(
                queryClient,
                meta.businessId,
                pendingId,
                result.sale,
              );
              await moveSaleReceiptExtras(pendingId, result.sale.id);
            } catch {
              /* collection reconcile is best-effort */
            }
          }
          if (meta?.businessId && result.products.length > 0) {
            await cancelInFlightProductListQueries(queryClient, meta.businessId);
            for (const row of result.products) {
              reconcileServerProductIntoQueryCache(queryClient, meta.businessId, row);
            }
          }
          return result.sale;
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
