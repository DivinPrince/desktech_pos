import { createCollection } from "@tanstack/react-db";
import type { Collection } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/react-native-db-sqlite-persistence";

import { getApiSdk } from "@/lib/api-sdk";

import { APP_CATALOG_DATA_SCHEMA_VERSION } from "../schema-version";
import { getCatalogPersistence } from "../sqlite-db";
import { catalogDataKeys } from "./keys";
import type { BusinessRow, CategoryRow, ProductRow } from "./types";

function parseProductsMapKey(
  mapKey: string,
  businessId: string,
): { activeOnly: boolean; search: string } | null {
  const prefix = `${businessId}|`;
  if (!mapKey.startsWith(prefix)) return null;
  const tail = mapKey.slice(prefix.length);
  if (tail.startsWith("true|")) return { activeOnly: true, search: tail.slice(5) };
  if (tail.startsWith("false|")) return { activeOnly: false, search: tail.slice(6) };
  return null;
}

export function productMatchesListFilters(
  product: ProductRow,
  activeOnly: boolean,
  search: string,
): boolean {
  if (activeOnly && !product.active) return false;
  const q = search.trim().toLowerCase();
  if (q.length === 0) return true;
  const name = product.name.toLowerCase();
  const sku = (product.sku ?? "").toLowerCase();
  return name.includes(q) || sku.includes(q);
}

function createPersistedQueryCollection<
  T extends { id: string },
>(args: {
  id: string;
  queryClient: QueryClient;
  queryKey: readonly unknown[];
  queryFn: () => Promise<T[]>;
  getKey: (item: T) => string;
}): Collection<T, string> {
  const opts = queryCollectionOptions({
    queryKey: [...args.queryKey],
    queryFn: args.queryFn,
    queryClient: args.queryClient,
    getKey: args.getKey,
  });
  const persistence = getCatalogPersistence();
  if (!persistence) {
    return createCollection(opts) as unknown as Collection<T, string>;
  }
  return createCollection(
    persistedCollectionOptions({
      id: args.id,
      schemaVersion: APP_CATALOG_DATA_SCHEMA_VERSION,
      persistence: persistence as never,
      ...(opts as object),
    } as never) as never,
  ) as unknown as Collection<T, string>;
}

export class CatalogCollectionRegistry {
  private businessesCol: Collection<BusinessRow, string> | undefined;
  private readonly categories = new Map<string, Collection<CategoryRow, string>>();
  private readonly products = new Map<string, Collection<ProductRow, string>>();
  private readonly productSingles = new Map<string, Collection<ProductRow, string>>();

  ensureBusinesses(queryClient: QueryClient): Collection<BusinessRow, string> {
    if (!this.businessesCol) {
      this.businessesCol = createPersistedQueryCollection<BusinessRow>({
        id: "businesses-list",
        queryClient,
        queryKey: catalogDataKeys.list(),
        queryFn: async () => {
          const sdk = getApiSdk();
          const { data } = await sdk.businesses.list().withResponse();
          return data.data;
        },
        getKey: (item) => item.id,
      });
    }
    return this.businessesCol;
  }

  ensureCategories(
    queryClient: QueryClient,
    businessId: string,
  ): Collection<CategoryRow, string> {
    let col = this.categories.get(businessId);
    if (!col) {
      col = createPersistedQueryCollection<CategoryRow>({
        id: `catalog-categories-${businessId}`,
        queryClient,
        queryKey: catalogDataKeys.categoriesRoot(businessId),
        queryFn: async () => {
          const sdk = getApiSdk();
          const { data } = await sdk
            .businesses
            .business(businessId)
            .listCategories()
            .withResponse();
          return data.data;
        },
        getKey: (item) => item.id,
      });
      this.categories.set(businessId, col);
    }
    return col;
  }

  ensureProducts(
    queryClient: QueryClient,
    businessId: string,
    filters: { activeOnly: boolean; search: string },
  ): Collection<ProductRow, string> {
    const search = filters.search.trim();
    const mapKey = `${businessId}|${filters.activeOnly}|${search}`;
    let col = this.products.get(mapKey);
    if (!col) {
      const queryParams = { activeOnly: filters.activeOnly, search };
      col = createPersistedQueryCollection<ProductRow>({
        id: `catalog-products-${mapKey}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
        queryClient,
        queryKey: catalogDataKeys.productsRoot(businessId, queryParams),
        queryFn: async () => {
          const sdk = getApiSdk();
          const { data } = await sdk
            .businesses
            .business(businessId)
            .listProducts({
              activeOnly: filters.activeOnly,
              search: search.length > 0 ? search : undefined,
            })
            .withResponse();
          return data.data;
        },
        getKey: (item) => item.id,
      });
      this.products.set(mapKey, col);
    }
    return col;
  }

  ensureProduct(
    queryClient: QueryClient,
    businessId: string,
    productId: string,
  ): Collection<ProductRow, string> {
    const mapKey = `${businessId}|${productId}`;
    let col = this.productSingles.get(mapKey);
    if (!col) {
      col = createPersistedQueryCollection<ProductRow>({
        id: `catalog-product-${mapKey}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
        queryClient,
        queryKey: catalogDataKeys.product(businessId, productId),
        queryFn: async () => {
          const sdk = getApiSdk();
          const { data } = await sdk
            .businesses
            .business(businessId)
            .getProduct(productId)
            .withResponse();
          return [data.data];
        },
        getKey: (item) => item.id,
      });
      this.productSingles.set(mapKey, col);
    }
    return col;
  }

  /**
   * Seed the per-product collection from any in-memory list slice so the editor does not flash
   * "Loading…" when the row is already present (e.g. opened from Inventory).
   */
  hydrateProductDetailFromListCaches(
    queryClient: QueryClient,
    businessId: string,
    productId: string,
  ): void {
    const detail = this.ensureProduct(queryClient, businessId, productId);
    if (detail.has(productId)) return;

    let found: ProductRow | undefined;
    for (const [mapKey, col] of this.products) {
      if (!parseProductsMapKey(mapKey, businessId)) continue;
      const row = col.get(productId);
      if (row != null) {
        found = row as ProductRow;
        break;
      }
    }
    if (found == null) return;

    try {
      detail.insert(found);
    } catch {
      /* row may have been inserted concurrently */
    }
  }

  /**
   * Synchronous best-effort read: detail row, any loaded list slice, or TanStack Query cache for
   * list endpoints (persistence can fill the query cache before live query emits). Used so the
   * edit screen does not wait on per-product collection sync when SQLite already has the row.
   */
  peekProductFromCaches(
    queryClient: QueryClient,
    businessId: string,
    productId: string,
  ): ProductRow | undefined {
    const detail = this.ensureProduct(queryClient, businessId, productId);
    const fromDetail = detail.get(productId);
    if (fromDetail != null) return fromDetail as ProductRow;

    for (const [mapKey, col] of this.products) {
      if (!parseProductsMapKey(mapKey, businessId)) continue;
      const row = col.get(productId);
      if (row != null) return row as ProductRow;
    }

    const cachedLists = queryClient.getQueryCache().findAll({
      queryKey: ["catalog", businessId, "products"],
      exact: false,
    });
    for (const q of cachedLists) {
      const rows = queryClient.getQueryData<ProductRow[]>(q.queryKey);
      if (!rows || !Array.isArray(rows)) continue;
      const hit = rows.find((p) => p.id === productId);
      if (hit) return hit;
    }

    return undefined;
  }

  /**
   * Ensures default list slices exist and inserts into every cached product list collection
   * whose filters include this row (so Inventory `activeOnly: false` and Items tab stay in sync).
   */
  mirrorProductInsert(queryClient: QueryClient, businessId: string, product: ProductRow): void {
    this.ensureProducts(queryClient, businessId, { activeOnly: false, search: "" });
    this.ensureProducts(queryClient, businessId, { activeOnly: true, search: "" });
    for (const [mapKey, col] of this.products) {
      const meta = parseProductsMapKey(mapKey, businessId);
      if (!meta) continue;
      if (!productMatchesListFilters(product, meta.activeOnly, meta.search)) continue;
      try {
        col.insert(product);
      } catch {
        /* duplicate key from prior insert */
      }
    }
  }

  mirrorProductUpdate(
    queryClient: QueryClient,
    businessId: string,
    productId: string,
    applyDraft: (d: ProductRow) => void,
  ): void {
    this.ensureProducts(queryClient, businessId, { activeOnly: false, search: "" });
    this.ensureProducts(queryClient, businessId, { activeOnly: true, search: "" });
    for (const [mapKey, col] of this.products) {
      if (!parseProductsMapKey(mapKey, businessId)) continue;
      try {
        col.update(productId, applyDraft);
      } catch {
        /* row not in this slice */
      }
    }
  }

  mirrorProductDelete(queryClient: QueryClient, businessId: string, productId: string): void {
    this.ensureProducts(queryClient, businessId, { activeOnly: false, search: "" });
    this.ensureProducts(queryClient, businessId, { activeOnly: true, search: "" });
    for (const [mapKey, col] of this.products) {
      if (!parseProductsMapKey(mapKey, businessId)) continue;
      try {
        col.delete(productId);
      } catch {
        /* not present */
      }
    }
  }

  namedCollectionsForOfflineExecutor(
    queryClient: QueryClient,
    options?: { offlineProductCatalogBusinessId?: string },
  ): Record<string, Collection<object, string | number>> {
    const businesses = this.ensureBusinesses(queryClient);
    const collections: Record<string, Collection<object, string | number>> = {
      businesses: businesses as Collection<object, string | number>,
    };
    const bid = options?.offlineProductCatalogBusinessId;
    if (bid) {
      this.ensureProducts(queryClient, bid, { activeOnly: false, search: "" });
      this.ensureProducts(queryClient, bid, { activeOnly: true, search: "" });
      for (const [mapKey, col] of this.products) {
        if (!parseProductsMapKey(mapKey, bid)) continue;
        const regKey = `catalogProductView_${mapKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        collections[regKey] = col as Collection<object, string | number>;
      }
      const categoriesOffline = this.ensureCategories(queryClient, bid);
      collections.catalogCategoriesOffline = categoriesOffline as Collection<object, string | number>;
    }
    return collections;
  }
}

const registries = new WeakMap<QueryClient, CatalogCollectionRegistry>();

export function getCatalogCollectionRegistry(queryClient: QueryClient): CatalogCollectionRegistry {
  let reg = registries.get(queryClient);
  if (!reg) {
    reg = new CatalogCollectionRegistry();
    registries.set(queryClient, reg);
  }
  return reg;
}
