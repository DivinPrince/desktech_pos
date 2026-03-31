import { createCollection } from "@tanstack/react-db";
import type { Collection } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/react-native-db-sqlite-persistence";

import { getApiSdk } from "@/lib/api-sdk";

import { APP_SALES_DATA_SCHEMA_VERSION } from "../schema-version";
import { getCatalogPersistence } from "../sqlite-db";
import { salesDataKeys } from "./keys";
import type { SaleRow } from "./types";

export const DEFAULT_LIST_LIMIT = 500;

/** Lower bound sent to API as “no from filter” for all-time-style windows. */
export const SALES_LIST_EPOCH_FROM_ISO = new Date(0).toISOString();

function startOfNextLocalDayMs(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

function localStartOfDayMs(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Pre-create list windows for offline outbox: Today tab + Reports presets + wide “all”
 * so `mutate()` touches only executor-registered collections.
 */
export function getOfflineSalesListSpecs(now: Date = new Date()): Array<{
  fromIso: string;
  toIso: string;
  limit: number;
}> {
  const endMs = startOfNextLocalDayMs(now);
  const toIso = new Date(endMs).toISOString();
  const todayStart = localStartOfDayMs(now);
  const last7 = new Date(todayStart);
  last7.setDate(last7.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return [
    { fromIso: new Date(todayStart).toISOString(), toIso, limit: DEFAULT_LIST_LIMIT },
    { fromIso: new Date(last7.getTime()).toISOString(), toIso, limit: DEFAULT_LIST_LIMIT },
    { fromIso: new Date(monthStart).toISOString(), toIso, limit: DEFAULT_LIST_LIMIT },
    { fromIso: new Date(0).toISOString(), toIso, limit: DEFAULT_LIST_LIMIT },
  ];
}

export function boundsToListParams(bounds: { startMs: number; endMs: number }): {
  fromIso: string;
  toIso: string;
  limit: number;
} {
  const fromIso =
    bounds.startMs <= 0 ? SALES_LIST_EPOCH_FROM_ISO : new Date(bounds.startMs).toISOString();
  const toIso = new Date(bounds.endMs).toISOString();
  return { fromIso, toIso, limit: DEFAULT_LIST_LIMIT };
}

function parseSalesListMapKey(mapKey: string): {
  businessId: string;
  fromIso: string;
  toIso: string;
  limit: number;
} | null {
  const parts = mapKey.split("|");
  if (parts.length < 4) return null;
  const limit = Number(parts[parts.length - 1]);
  const toIso = parts[parts.length - 2]!;
  const fromIso = parts[parts.length - 3]!;
  const businessId = parts.slice(0, parts.length - 3).join("|");
  if (!Number.isFinite(limit)) return null;
  return { businessId, fromIso, toIso, limit };
}

function saleCompletedAtMs(sale: SaleRow): number {
  const c = sale.completedAt;
  if (c instanceof Date) return c.getTime();
  if (c) return new Date(c as string).getTime();
  return sale.updatedAt instanceof Date ? sale.updatedAt.getTime() : new Date(sale.updatedAt).getTime();
}

function saleInListWindow(sale: SaleRow, fromIso: string, toIso: string): boolean {
  const t = saleCompletedAtMs(sale);
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  return t >= fromMs && t <= toMs;
}

function createPersistedQueryCollection<T extends { id: string }>(args: {
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
      schemaVersion: APP_SALES_DATA_SCHEMA_VERSION,
      persistence: persistence as never,
      ...(opts as object),
    } as never) as never,
  ) as unknown as Collection<T, string>;
}

export class SalesCollectionRegistry {
  private readonly salesLists = new Map<string, Collection<SaleRow, string>>();
  private readonly saleSingles = new Map<string, Collection<SaleRow, string>>();

  private listMapKey(
    businessId: string,
    fromIso: string,
    toIso: string,
    limit: number,
  ): string {
    return `${businessId}|${fromIso}|${toIso}|${limit}`;
  }

  ensureSalesList(
    queryClient: QueryClient,
    businessId: string,
    params: { fromIso: string; toIso: string; limit?: number },
  ): Collection<SaleRow, string> {
    const limit = params.limit ?? DEFAULT_LIST_LIMIT;
    const mapKey = this.listMapKey(businessId, params.fromIso, params.toIso, limit);
    let col = this.salesLists.get(mapKey);
    if (!col) {
      const { fromIso, toIso } = params;
      col = createPersistedQueryCollection<SaleRow>({
        id: `sales-list-${mapKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
        queryClient,
        queryKey: salesDataKeys.list(businessId, fromIso, toIso, limit),
        queryFn: async () => {
          const sdk = getApiSdk();
          const q: {
            status: "completed";
            from?: string;
            to: string;
            limit: string;
          } = {
            status: "completed",
            to: toIso,
            limit: String(limit),
          };
          if (fromIso !== SALES_LIST_EPOCH_FROM_ISO) {
            q.from = fromIso;
          }
          const { data } = await sdk
            .businesses
            .business(businessId)
            .listSales(q)
            .withResponse();
          return data.data;
        },
        getKey: (item) => item.id,
      });
      this.salesLists.set(mapKey, col);
    }
    return col;
  }

  prefetchOfflineSalesWindows(queryClient: QueryClient, businessId: string): void {
    for (const spec of getOfflineSalesListSpecs()) {
      this.ensureSalesList(queryClient, businessId, spec);
    }
  }

  ensureSale(
    queryClient: QueryClient,
    businessId: string,
    saleId: string,
  ): Collection<SaleRow, string> {
    const mapKey = `${businessId}|${saleId}`;
    let col = this.saleSingles.get(mapKey);
    if (!col) {
      col = createPersistedQueryCollection<SaleRow>({
        id: `sales-sale-${mapKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
        queryClient,
        queryKey: salesDataKeys.sale(businessId, saleId),
        queryFn: async () => {
          const sdk = getApiSdk();
          try {
            const { data } = await sdk
              .businesses
              .business(businessId)
              .getSale(saleId)
              .withResponse();
            return [data.data];
          } catch {
            return [];
          }
        },
        getKey: (item) => item.id,
      });
      this.saleSingles.set(mapKey, col);
    }
    return col;
  }

  getSaleRowFromAnyListCache(queryClient: QueryClient, businessId: string, saleId: string): SaleRow | undefined {
    for (const [mapKey, col] of this.salesLists) {
      const meta = parseSalesListMapKey(mapKey);
      if (!meta || meta.businessId !== businessId) continue;
      const row = col.get(saleId);
      if (row != null) return row as SaleRow;
    }
    const cachedLists = queryClient.getQueryCache().findAll({
      queryKey: salesDataKeys.root(businessId),
      exact: false,
    });
    for (const q of cachedLists) {
      const rows = queryClient.getQueryData<SaleRow[]>(q.queryKey);
      if (!rows || !Array.isArray(rows)) continue;
      const hit = rows.find((s) => s.id === saleId);
      if (hit) return hit;
    }
    return undefined;
  }

  hydrateSaleDetailFromListCaches(
    queryClient: QueryClient,
    businessId: string,
    saleId: string,
  ): void {
    const detail = this.ensureSale(queryClient, businessId, saleId);
    if (detail.has(saleId)) return;
    const found = this.getSaleRowFromAnyListCache(queryClient, businessId, saleId);
    if (found == null) return;
    try {
      detail.insert(found);
    } catch {
      /* concurrent insert */
    }
  }

  mirrorSaleInsertIntoMatchingLists(queryClient: QueryClient, businessId: string, sale: SaleRow): void {
    for (const [mapKey, col] of this.salesLists) {
      const meta = parseSalesListMapKey(mapKey);
      if (!meta || meta.businessId !== businessId) continue;
      if (!saleInListWindow(sale, meta.fromIso, meta.toIso)) continue;
      try {
        col.insert(sale);
      } catch {
        /* duplicate */
      }
    }
  }

  mirrorSaleDeleteFromMatchingLists(queryClient: QueryClient, businessId: string, saleId: string): void {
    for (const [mapKey, col] of this.salesLists) {
      const meta = parseSalesListMapKey(mapKey);
      if (!meta || meta.businessId !== businessId) continue;
      try {
        col.delete(saleId);
      } catch {
        /* not present */
      }
    }
  }

  /**
   * After server replay or background completion: replace pending id with final sale rows everywhere.
   */
  reconcilePendingCounterSale(
    queryClient: QueryClient,
    businessId: string,
    pendingSaleId: string,
    finalSale: SaleRow,
  ): void {
    this.mirrorSaleDeleteFromMatchingLists(queryClient, businessId, pendingSaleId);
    try {
      this.ensureSale(queryClient, businessId, pendingSaleId).delete(pendingSaleId);
    } catch {
      /* */
    }
    try {
      const finalCol = this.ensureSale(queryClient, businessId, finalSale.id);
      try {
        finalCol.delete(finalSale.id);
      } catch {
        /* */
      }
      finalCol.insert(finalSale);
    } catch {
      /* */
    }
    this.mirrorSaleInsertIntoMatchingLists(queryClient, businessId, finalSale);
  }

  namedCollectionsForOfflineExecutor(
    queryClient: QueryClient,
    businessId: string | undefined,
  ): Record<string, Collection<object, string | number>> {
    const collections: Record<string, Collection<object, string | number>> = {};
    if (!businessId) return collections;
    for (const [mapKey, col] of this.salesLists) {
      const meta = parseSalesListMapKey(mapKey);
      if (!meta || meta.businessId !== businessId) continue;
      const regKey = `salesList_${mapKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      collections[regKey] = col as Collection<object, string | number>;
    }
    return collections;
  }
}

const registries = new WeakMap<QueryClient, SalesCollectionRegistry>();

export function getSalesCollectionRegistry(queryClient: QueryClient): SalesCollectionRegistry {
  let reg = registries.get(queryClient);
  if (!reg) {
    reg = new SalesCollectionRegistry();
    registries.set(queryClient, reg);
  }
  return reg;
}
