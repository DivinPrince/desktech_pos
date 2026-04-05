import type { OfflineConfig } from "@tanstack/offline-transactions";
import { NonRetriableError } from "@tanstack/offline-transactions";
import type { SaleService } from "@repo/core/pos";
import type { z } from "zod";

import type { ProductRow } from "@/lib/data/catalog/types";
import { getApiSdk } from "@/lib/api-sdk";

type CatalogOfflineMutationFn = OfflineConfig["mutationFns"][string];

/** Payload mirrors `business-catalog` / SDK (keep in sync manually). */
export type CatalogProductCreateBody = {
  categoryId?: string;
  name: string;
  sku?: string;
  unit?: string;
  description?: string;
  priceCents: number;
  costCents?: number;
  stockAlert?: number;
  trackStock?: boolean;
  initialQuantity?: number;
  active?: boolean;
};

export type CatalogCategoryCreateBody = {
  name: string;
  parentId?: string;
  sortOrder?: number;
};

export type CatalogCategoryUpdateBody = {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
};

export type CatalogProductUpdateBody = {
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

export type CatalogCreateProductMetadata = {
  businessId: string;
  body: CatalogProductCreateBody;
  /** Matches optimistic `local_*` row id so replay can swap in the server product. */
  optimisticLocalId?: string;
};

export type CatalogCreateCategoryMetadata = {
  businessId: string;
  body: CatalogCategoryCreateBody;
  /** Matches optimistic `local_*` row id so replay can swap in the server category. */
  optimisticLocalId: string;
};

export type CatalogUpdateCategoryMetadata = {
  businessId: string;
  categoryId: string;
  body: CatalogCategoryUpdateBody;
};

export type CatalogDeleteCategoryMetadata = {
  businessId: string;
  categoryId: string;
};

export type CatalogUpdateProductMetadata = {
  businessId: string;
  productId: string;
  body: CatalogProductUpdateBody;
};

export type CatalogDeleteProductMetadata = {
  businessId: string;
  productId: string;
};

/** Same shape as app `StockAdjustBody` / API (keep in sync). */
export type CatalogAdjustStockBody = {
  productId: string;
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

export type CatalogAdjustStockMetadata = {
  businessId: string;
  body: CatalogAdjustStockBody;
};

/** Payload for draft → lines → complete sale (counter checkout). */
export type CatalogCompleteCounterSaleBody = {
  lines: {
    productId: string;
    quantity: number;
    unitPriceCents: number;
  }[];
  paymentMethod: string;
};

export type CatalogCompleteCounterSaleMetadata = {
  businessId: string;
  body: CatalogCompleteCounterSaleBody;
};

export type CatalogOfflineMutationParams = {
  idempotencyKey: string;
  transaction?: { metadata?: Record<string, unknown> };
};

type CombinedParams = CatalogOfflineMutationParams;

function meta<T extends Record<string, unknown>>(p: CombinedParams, label: string): T {
  const m = p.transaction?.metadata as T | undefined;
  if (!m) throw new NonRetriableError(`${label}: missing metadata`);
  return m;
}

/**
 * Registered on the offline executor; replay uses the same `Idempotency-Key` the client generated.
 */
export const catalogCreateProductMutationFn: CatalogOfflineMutationFn = async (params) => {
  const p = params as CombinedParams;
  const { businessId, body } = meta<CatalogCreateProductMetadata>(p, "catalogCreateProduct");
  const sdk = getApiSdk();
  const { data } = await sdk
    .businesses
    .business(businessId)
    .createProduct(body, {
      headers: { "Idempotency-Key": p.idempotencyKey },
    })
    .withResponse();
  return data.data;
};

export const catalogCreateCategoryMutationFn: CatalogOfflineMutationFn = async (params) => {
  const p = params as CombinedParams;
  const { businessId, body } = meta<CatalogCreateCategoryMetadata>(p, "catalogCreateCategory");
  const sdk = getApiSdk();
  const { data } = await sdk.businesses.business(businessId).createCategory(body).withResponse();
  return data.data;
};

export const catalogUpdateCategoryMutationFn: CatalogOfflineMutationFn = async (params) => {
  const p = params as CombinedParams;
  const { businessId, categoryId, body } = meta<CatalogUpdateCategoryMetadata>(
    p,
    "catalogUpdateCategory",
  );
  const sdk = getApiSdk();
  const { data } = await sdk.businesses.business(businessId).updateCategory(categoryId, body).withResponse();
  return data.data;
};

export const catalogDeleteCategoryMutationFn: CatalogOfflineMutationFn = async (params) => {
  const p = params as CombinedParams;
  const { businessId, categoryId } = meta<CatalogDeleteCategoryMetadata>(p, "catalogDeleteCategory");
  const sdk = getApiSdk();
  await sdk.businesses.business(businessId).deleteCategory(categoryId).withResponse();
};

export const catalogUpdateProductMutationFn: CatalogOfflineMutationFn = async (params) => {
  const p = params as CombinedParams;
  const { businessId, productId, body } = meta<CatalogUpdateProductMetadata>(p, "catalogUpdateProduct");
  const sdk = getApiSdk();
  const { data } = await sdk.businesses.business(businessId).updateProduct(productId, body).withResponse();
  return data.data;
};

export const catalogDeleteProductMutationFn: CatalogOfflineMutationFn = async (params) => {
  const p = params as CombinedParams;
  const { businessId, productId } = meta<CatalogDeleteProductMetadata>(p, "catalogDeleteProduct");
  const sdk = getApiSdk();
  await sdk.businesses.business(businessId).deleteProduct(productId).withResponse();
};

export const catalogAdjustStockMutationFn: CatalogOfflineMutationFn = async (params) => {
  const p = params as CombinedParams;
  const { businessId, body } = meta<CatalogAdjustStockMetadata>(p, "catalogAdjustStock");
  const sdk = getApiSdk();
  const { data } = await sdk
    .businesses
    .business(businessId)
    .adjustStock(body, {
      headers: { "Idempotency-Key": p.idempotencyKey },
    })
    .withResponse();
  return data.data.product;
};

export type CatalogCompleteCounterSaleReplayResult = {
  sale: z.infer<typeof SaleService.SaleInfo>;
  products: ProductRow[];
};

export const catalogCompleteCounterSaleMutationFn: CatalogOfflineMutationFn = async (params) => {
  const p = params as CombinedParams;
  const { businessId, body } = meta<CatalogCompleteCounterSaleMetadata>(
    p,
    "catalogCompleteCounterSale",
  );
  const sdk = getApiSdk();
  const scoped = sdk.businesses.business(businessId);
  const { data: draftEnvelope } = await scoped.createDraftSale({}).withResponse();
  const saleId = draftEnvelope.data.id;
  await scoped
    .setSaleLines(
      saleId,
      body.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      })),
    )
    .withResponse();
  const { data: saleEnvelope } = await scoped
    .completeSale(saleId, { paymentMethod: body.paymentMethod })
    .withResponse();
  const sale = saleEnvelope.data;

  const uniqueIds = [...new Set(body.lines.map((l) => l.productId))];
  const products = await Promise.all(
    uniqueIds.map(async (productId) => {
      const { data: prodEnvelope } = await scoped.getProduct(productId).withResponse();
      return prodEnvelope.data;
    }),
  );
  return { sale, products } satisfies CatalogCompleteCounterSaleReplayResult;
};
