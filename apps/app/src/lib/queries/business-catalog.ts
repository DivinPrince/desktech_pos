import type { QueryCollectionUtils } from "@tanstack/query-db-collection";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  cancelInFlightProductListQueries,
  reconcileProductDeleteInQueryCache,
  reconcileServerProductIntoQueryCache,
} from "@/lib/data/catalog/cache-reconcile";
import { reconcileCreatedCategory } from "@/lib/data/catalog/category-reconcile";
import { getCatalogCollectionRegistry } from "@/lib/data/catalog/collections";
import { runCatalogOutboxMutation } from "@/lib/data/offline/catalog-outbox";
import {
  useBusinessesLiveRows,
  useCategoriesLiveRows,
  useProductLiveRow,
  useProductsLiveRows,
} from "@/lib/data/catalog/hooks";
import { useOfflineExecutor } from "@/lib/data/offline/offline-executor-provider";

import type { BusinessRow, CategoryRow, ProductRow } from "@/lib/data/catalog/types";

import { useApiSdk } from "../api-sdk";

function catalogUtils<T extends object>(collection: unknown): QueryCollectionUtils<T, string, T, unknown> | undefined {
  const c = collection as { utils?: QueryCollectionUtils<T, string, T, unknown> } | null | undefined;
  return c?.utils;
}

export const businessKeys = {
  all: ["businesses"] as const,
  list: () => [...businessKeys.all, "list"] as const,
};

export const catalogKeys = {
  all: (businessId: string) => ["catalog", businessId] as const,
  categories: (businessId: string) => [...catalogKeys.all(businessId), "categories"] as const,
  products: (
    businessId: string,
    params: { activeOnly: boolean; search: string },
  ) => [...catalogKeys.all(businessId), "products", params] as const,
  product: (businessId: string, productId: string) =>
    [...catalogKeys.all(businessId), "product", productId] as const,
};

export type ProductsQueryFilters = {
  /** When true, only active products. When false, include inactive. Default true. */
  activeOnly?: boolean;
  /** Server-side name/SKU search (trimmed). */
  search?: string;
};

/** Payload shapes aligned with `@repo/core` ProductService (businessId set by route). */
export type ProductCreateBody = {
  categoryId?: string;
  name: string;
  sku?: string;
  unit?: string;
  description?: string;
  priceCents: number;
  costCents?: number;
  stockAlert?: number;
  trackStock?: boolean;
  active?: boolean;
};

export type ProductUpdateBody = {
  categoryId?: string | null;
  name?: string;
  sku?: string | null;
  unit?: string;
  description?: string | null;
  priceCents?: number;
  costCents?: number | null;
  stockAlert?: number;
  trackStock?: boolean;
  active?: boolean;
};

export type CategoryCreateBody = {
  name: string;
  parentId?: string;
  sortOrder?: number;
};

export type CategoryUpdateBody = {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
};

export type ProductVariantCreateBody = {
  name: string;
  sku?: string | null;
  priceCents: number;
  costCents?: number | null;
  active?: boolean;
  sortOrder?: number;
};

export type ProductVariantUpdateBody = {
  name?: string;
  sku?: string | null;
  priceCents?: number;
  costCents?: number | null;
  active?: boolean;
  sortOrder?: number;
};

export type StockAdjustBody = {
  productId: string;
  productVariantId?: string;
  quantityDelta: number;
  type:
    | "adjustment"
    | "purchase"
    | "waste"
    | "sale"
    | "sale_return"
    | "transfer_in"
    | "transfer_out";
  note?: string;
};

function randomIdempotencyKey(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function optimisticProductRow(businessId: string, body: ProductCreateBody, localId: string): ProductRow {
  const now = new Date();
  return {
    id: localId,
    businessId,
    categoryId: body.categoryId ?? null,
    name: body.name,
    sku: body.sku ?? null,
    unit: body.unit ?? "ea",
    description: body.description ?? null,
    priceCents: body.priceCents,
    costCents: body.costCents ?? null,
    stockAlert: body.stockAlert ?? 0,
    trackStock: body.trackStock ?? false,
    active: body.active ?? true,
    quantityOnHand: 0,
    variants: [],
    createdAt: now,
    updatedAt: now,
  };
}

function optimisticCategoryRow(businessId: string, body: CategoryCreateBody, localId: string): CategoryRow {
  const now = new Date();
  return {
    id: localId,
    businessId,
    name: body.name,
    sortOrder: body.sortOrder ?? 0,
    parentId: body.parentId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function applyProductUpdateDraft(draft: ProductRow, body: ProductUpdateBody): void {
  if (body.categoryId !== undefined) draft.categoryId = body.categoryId;
  if (body.name !== undefined) draft.name = body.name;
  if (body.sku !== undefined) draft.sku = body.sku;
  if (body.unit !== undefined) draft.unit = body.unit;
  if (body.description !== undefined) draft.description = body.description;
  if (body.priceCents !== undefined) draft.priceCents = body.priceCents;
  if (body.costCents !== undefined) draft.costCents = body.costCents;
  if (body.stockAlert !== undefined) draft.stockAlert = body.stockAlert;
  if (body.trackStock !== undefined) draft.trackStock = body.trackStock;
  if (body.active !== undefined) draft.active = body.active;
  draft.updatedAt = new Date();
}

function assertStockAdjustAllowed(snapshot: ProductRow, body: StockAdjustBody): void {
  const q = body.productVariantId
    ? snapshot.variants.find((v) => v.id === body.productVariantId)?.quantityOnHand
    : snapshot.quantityOnHand;
  if (q === undefined) return;
  if (q + body.quantityDelta < 0) {
    throw new Error("Insufficient stock for this adjustment");
  }
}

/** Match server rules: variant adjusts update the variant and parent aggregate when variants exist. */
function applyStockAdjustDraft(draft: ProductRow, body: StockAdjustBody): void {
  if (body.productVariantId) {
    const v = draft.variants.find((x) => x.id === body.productVariantId);
    if (v) {
      v.quantityOnHand += body.quantityDelta;
    }
    if (draft.variants.length > 0) {
      draft.quantityOnHand = draft.variants.reduce((s, x) => s + x.quantityOnHand, 0);
    }
  } else {
    draft.quantityOnHand += body.quantityDelta;
  }
  draft.updatedAt = new Date();
}

function invalidateCatalogQuery(queryClient: QueryClient, businessId: string | undefined) {
  if (businessId) void queryClient.invalidateQueries({ queryKey: catalogKeys.all(businessId) });
}

/** Fire-and-forget API reconciliation so `mutationFn` never awaits the network. */
function syncCatalogInBackground(
  promise: Promise<unknown>,
  invalidate: () => void,
  options?: { invalidateOnSuccess?: boolean },
) {
  const invalidateOnSuccess = options?.invalidateOnSuccess ?? true;
  void promise
    .then(() => {
      if (invalidateOnSuccess) invalidate();
    })
    .catch(() => invalidate());
}

/** Catalog reads: TanStack DB persisted collections + `useLiveQuery` (SQLite-backed, stale-while-revalidate). */
export function useBusinessesQuery(enabled: boolean) {
  const { data, isLoading, collection, isError, isReady } = useBusinessesLiveRows(enabled);
  const rows = data ?? [];
  const utils = catalogUtils<BusinessRow>(collection);
  return {
    data: rows,
    isPending: isLoading && rows.length === 0,
    isFetching: utils?.isFetching ?? false,
    isLoading,
    isSuccess: isReady,
    isError,
    error: utils?.lastError ?? null,
    refetch: () => utils?.refetch?.() ?? Promise.resolve(),
  };
}

export function useCategoriesQuery(businessId: string | undefined, enabled: boolean) {
  const { data, isLoading, collection, isError, isReady } = useCategoriesLiveRows(businessId, enabled);
  const rows = data ?? [];
  const utils = catalogUtils<CategoryRow>(collection);
  return {
    data: rows,
    isPending: isLoading && rows.length === 0,
    isFetching: utils?.isFetching ?? false,
    isLoading,
    isSuccess: isReady,
    isError,
    error: utils?.lastError ?? null,
    refetch: () => utils?.refetch?.() ?? Promise.resolve(),
  };
}

export function useProductsQuery(
  businessId: string | undefined,
  enabled: boolean,
  filters?: ProductsQueryFilters,
) {
  const activeOnly = filters?.activeOnly ?? true;
  const search = (filters?.search ?? "").trim();
  const { data, isLoading, collection, isError, isReady } = useProductsLiveRows(
    businessId,
    enabled,
    { activeOnly, search },
  );
  const rows = data ?? [];
  const utils = catalogUtils<ProductRow>(collection);
  return {
    data: rows,
    isPending: isLoading && rows.length === 0,
    isFetching: utils?.isFetching ?? false,
    isLoading,
    isSuccess: isReady,
    isError,
    error: utils?.lastError ?? null,
    refetch: () => utils?.refetch?.() ?? Promise.resolve(),
  };
}

export function useProductQuery(
  businessId: string | undefined,
  productId: string | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const registry = getCatalogCollectionRegistry(queryClient);
  if (enabled && businessId && productId) {
    registry.hydrateProductDetailFromListCaches(queryClient, businessId, productId);
  }
  const live = useProductLiveRow(businessId, productId, enabled);
  const peeked =
    enabled && businessId && productId
      ? registry.peekProductFromCaches(queryClient, businessId, productId)
      : undefined;
  const data = (live.data ?? peeked) as ProductRow | undefined;
  const utils = catalogUtils<ProductRow>(live.collection);
  /** Detail query can 500 while list cache still has a row — treat as error only if we cannot show anything. */
  const isError = live.isError && data == null;
  return {
    data,
    isPending: live.isLoading && data == null,
    isFetching: utils?.isFetching ?? false,
    isLoading: live.isLoading,
    isSuccess: live.isReady,
    isError,
    error: utils?.lastError ?? null,
    refetch: () => utils?.refetch?.() ?? Promise.resolve(),
  };
}

function useInvalidateCatalog(businessId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (businessId) {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all(businessId) });
    }
  };
}

export function useCreateProductMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const executor = useOfflineExecutor();
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (body: ProductCreateBody) => {
      if (!businessId) throw new Error("Missing business");
      const idempotencyKey = randomIdempotencyKey();
      const localId = `local_${idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
      const optimistic = optimisticProductRow(businessId, body, localId);

      const registry = getCatalogCollectionRegistry(queryClient);
      const inv = () => invalidateCatalogQuery(queryClient, businessId);
      const apply = () => {
        registry.mirrorProductInsert(queryClient, businessId, optimistic);
      };

      if (executor?.isOfflineEnabled) {
        return runCatalogOutboxMutation({
          executor,
          mutationFnName: "catalogCreateProduct",
          idempotencyKey,
          metadata: { businessId, body },
          mutate: apply,
          optimisticResult: optimistic,
          invalidate: inv,
        });
      }

      apply();
      syncCatalogInBackground(
        sdk
          .businesses
          .business(businessId)
          .createProduct(body, {
            headers: { "Idempotency-Key": idempotencyKey },
          })
          .withResponse(),
        inv,
      );
      return optimistic;
    },
  });
}

export function useUpdateProductMutation(
  businessId: string | undefined,
  productId: string | undefined,
) {
  const sdk = useApiSdk();
  const executor = useOfflineExecutor();
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (body: ProductUpdateBody) => {
      if (!businessId || !productId) throw new Error("Missing business or product");

      const registry = getCatalogCollectionRegistry(queryClient);
      const single = registry.ensureProduct(queryClient, businessId, productId);
      const inv = () => invalidateCatalogQuery(queryClient, businessId);
      const applyLists = () => {
        registry.mirrorProductUpdate(queryClient, businessId, productId, (d) => {
          applyProductUpdateDraft(d, body);
        });
      };
      const applyDetail = () => {
        try {
          single.update(productId, (d) => {
            applyProductUpdateDraft(d, body);
          });
        } catch {
          /* detail collection may have no row yet */
        }
      };

      if (executor?.isOfflineEnabled) {
        // Per-product collections are not registered on the offline executor (they are
        // created lazily per id). Only mirror list slices in the outbox transaction so
        // serialization can resolve collections; update detail locally for instant UI.
        applyDetail();
        return runCatalogOutboxMutation({
          executor,
          mutationFnName: "catalogUpdateProduct",
          idempotencyKey: randomIdempotencyKey(),
          metadata: { businessId, productId, body },
          mutate: applyLists,
          optimisticResult: undefined as unknown as ProductRow,
          invalidate: inv,
          invalidateAfterSuccess: false,
        });
      }

      applyLists();
      applyDetail();
      syncCatalogInBackground(
        (async () => {
          const { data: envelope } = await sdk
            .businesses
            .business(businessId)
            .updateProduct(productId, body)
            .withResponse();
          const serverRow = envelope.data;
          await cancelInFlightProductListQueries(queryClient, businessId);
          reconcileServerProductIntoQueryCache(queryClient, businessId, serverRow);
        })(),
        inv,
        { invalidateOnSuccess: false },
      );
      return undefined as unknown as ProductRow;
    },
  });
}

export function useDeleteProductMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const executor = useOfflineExecutor();
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (productId: string) => {
      if (!businessId) throw new Error("Missing business");

      const registry = getCatalogCollectionRegistry(queryClient);
      const single = registry.ensureProduct(queryClient, businessId, productId);
      const inv = () => invalidateCatalogQuery(queryClient, businessId);
      const applyLists = () => {
        registry.mirrorProductDelete(queryClient, businessId, productId);
      };
      const applyDetail = () => {
        try {
          single.delete(productId);
        } catch {
          /* detail collection may have no row */
        }
      };

      if (executor?.isOfflineEnabled) {
        applyDetail();
        return runCatalogOutboxMutation({
          executor,
          mutationFnName: "catalogDeleteProduct",
          idempotencyKey: randomIdempotencyKey(),
          metadata: { businessId, productId },
          mutate: applyLists,
          optimisticResult: undefined,
          invalidate: inv,
          invalidateAfterSuccess: false,
        });
      }

      applyLists();
      applyDetail();
      syncCatalogInBackground(
        (async () => {
          await sdk.businesses.business(businessId).deleteProduct(productId).withResponse();
          await cancelInFlightProductListQueries(queryClient, businessId);
          reconcileProductDeleteInQueryCache(queryClient, businessId, productId);
        })(),
        inv,
        { invalidateOnSuccess: false },
      );
    },
  });
}

export function useCreateCategoryMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const executor = useOfflineExecutor();
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (body: CategoryCreateBody) => {
      if (!businessId) throw new Error("Missing business");
      const idempotencyKey = randomIdempotencyKey();
      const localId = `local_${idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
      const optimistic = optimisticCategoryRow(businessId, body, localId);

      const registry = getCatalogCollectionRegistry(queryClient);
      const categories = registry.ensureCategories(queryClient, businessId);
      const inv = () => invalidateCatalogQuery(queryClient, businessId);
      const apply = () => {
        categories.insert(optimistic);
      };

      if (executor?.isOfflineEnabled) {
        return runCatalogOutboxMutation({
          executor,
          mutationFnName: "catalogCreateCategory",
          idempotencyKey,
          metadata: { businessId, body, optimisticLocalId: localId },
          mutate: apply,
          optimisticResult: optimistic,
          invalidate: inv,
          invalidateAfterSuccess: false,
        });
      }

      apply();
      void (async () => {
        try {
          const { data: envelope } = await sdk
            .businesses
            .business(businessId)
            .createCategory(body)
            .withResponse();
          await reconcileCreatedCategory(queryClient, businessId, localId, envelope.data);
        } catch {
          try {
            categories.delete(localId);
          } catch {
            /* already removed */
          }
          inv();
        }
      })();
      return optimistic;
    },
  });
}

export function useUpdateCategoryMutation(
  businessId: string | undefined,
  categoryId: string | undefined,
) {
  const sdk = useApiSdk();
  const executor = useOfflineExecutor();
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (body: CategoryUpdateBody) => {
      if (!businessId || !categoryId) throw new Error("Missing business or category");

      const registry = getCatalogCollectionRegistry(queryClient);
      const categories = registry.ensureCategories(queryClient, businessId);
      const inv = () => invalidateCatalogQuery(queryClient, businessId);
      const apply = () => {
        categories.update(categoryId, (d) => {
          if (body.name !== undefined) d.name = body.name;
          if (body.parentId !== undefined) d.parentId = body.parentId;
          if (body.sortOrder !== undefined) d.sortOrder = body.sortOrder;
          d.updatedAt = new Date();
        });
      };

      if (executor?.isOfflineEnabled) {
        return runCatalogOutboxMutation({
          executor,
          mutationFnName: "catalogUpdateCategory",
          idempotencyKey: randomIdempotencyKey(),
          metadata: { businessId, categoryId, body },
          mutate: apply,
          optimisticResult: undefined as unknown as CategoryRow,
          invalidate: inv,
        });
      }

      apply();
      syncCatalogInBackground(
        sdk.businesses.business(businessId).updateCategory(categoryId, body).withResponse(),
        inv,
      );
      return undefined as unknown as CategoryRow;
    },
  });
}

export function useDeleteCategoryMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const executor = useOfflineExecutor();
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (categoryId: string) => {
      if (!businessId) throw new Error("Missing business");

      const registry = getCatalogCollectionRegistry(queryClient);
      const categories = registry.ensureCategories(queryClient, businessId);
      const inv = () => invalidateCatalogQuery(queryClient, businessId);
      const apply = () => {
        categories.delete(categoryId);
      };

      if (executor?.isOfflineEnabled) {
        return runCatalogOutboxMutation({
          executor,
          mutationFnName: "catalogDeleteCategory",
          idempotencyKey: randomIdempotencyKey(),
          metadata: { businessId, categoryId },
          mutate: apply,
          optimisticResult: undefined,
          invalidate: inv,
        });
      }

      apply();
      syncCatalogInBackground(sdk.businesses.business(businessId).deleteCategory(categoryId).withResponse(), inv);
    },
  });
}

export function useAdjustStockMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const executor = useOfflineExecutor();
  const queryClient = useQueryClient();
  const inv = useInvalidateCatalog(businessId);
  return useMutation({
    retry: false,
    mutationFn: async (body: StockAdjustBody) => {
      if (!businessId) throw new Error("Missing business");

      const registry = getCatalogCollectionRegistry(queryClient);
      const single = registry.ensureProduct(queryClient, businessId, body.productId);
      const snap = single.get(body.productId) as ProductRow | undefined;
      if (snap) assertStockAdjustAllowed(snap, body);

      const applyLists = () => {
        registry.mirrorProductUpdate(queryClient, businessId, body.productId, (d) =>
          applyStockAdjustDraft(d, body),
        );
      };
      const applyDetail = () => {
        try {
          single.update(body.productId, (d) => applyStockAdjustDraft(d, body));
        } catch {
          /* row missing in detail slice */
        }
      };

      if (executor?.isOfflineEnabled) {
        applyDetail();
        return runCatalogOutboxMutation({
          executor,
          mutationFnName: "catalogAdjustStock",
          idempotencyKey: randomIdempotencyKey(),
          metadata: { businessId, body },
          mutate: applyLists,
          optimisticResult: undefined as unknown as ProductRow,
          invalidate: inv,
          invalidateAfterSuccess: false,
        });
      }

      applyLists();
      applyDetail();
      try {
        const { data: envelope } = await sdk
          .businesses
          .business(businessId)
          .adjustStock(body, {
            headers: { "Idempotency-Key": randomIdempotencyKey() },
          })
          .withResponse();
        const serverRow = envelope.data.product;
        await cancelInFlightProductListQueries(queryClient, businessId);
        reconcileServerProductIntoQueryCache(queryClient, businessId, serverRow);
        return { movement: envelope.data.movement, product: serverRow };
      } catch (e) {
        inv();
        throw e;
      }
    },
  });
}

export function useCreateProductVariantMutation(
  businessId: string | undefined,
  productId: string | undefined,
) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (body: ProductVariantCreateBody) => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .createProductVariant(productId!, body)
        .withResponse();
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateProductVariantMutation(
  businessId: string | undefined,
  productId: string | undefined,
) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (input: { variantId: string; body: ProductVariantUpdateBody }) => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .updateProductVariant(productId!, input.variantId, input.body)
        .withResponse();
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteProductVariantMutation(
  businessId: string | undefined,
  productId: string | undefined,
) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (variantId: string) => {
      await sdk
        .businesses
        .business(businessId!)
        .deleteProductVariant(productId!, variantId)
        .withResponse();
    },
    onSuccess: invalidate,
  });
}
