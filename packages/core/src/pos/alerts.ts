import { and, eq, gt, lte, lt, notExists } from "drizzle-orm";
import { z } from "zod";
import { withTransaction } from "../drizzle/transaction";
import { fn } from "../util/fn";
import { productTable, productVariantTable } from "./catalog.sql";
import {
  inventoryBatchTable,
  productStockTable,
  productVariantStockTable,
} from "./inventory.sql";

export namespace AlertService {
  export const LowStockItem = z.object({
    productId: z.string(),
    name: z.string(),
    sku: z.string().nullable(),
    quantityOnHand: z.number(),
    reorderLevel: z.number(),
  });

  export const ExpiredBatchItem = z.object({
    batchId: z.string(),
    productId: z.string(),
    productName: z.string(),
    quantity: z.number(),
    expiresOn: z.date(),
    lotCode: z.string().nullable(),
  });

  export const lowStock = fn(z.object({ businessId: z.string() }), async ({ businessId }) => {
    return withTransaction(async (tx) => {
      const simpleRows = await tx
        .select({
          product: productTable,
          qty: productStockTable.quantity,
        })
        .from(productTable)
        .innerJoin(
          productStockTable,
          and(
            eq(productStockTable.productId, productTable.id),
            eq(productStockTable.businessId, businessId),
          ),
        )
        .where(
          and(
            eq(productTable.businessId, businessId),
            eq(productTable.active, true),
            eq(productTable.trackStock, true),
            lte(productStockTable.quantity, productTable.reorderLevel),
            notExists(
              tx
                .select({ id: productVariantTable.id })
                .from(productVariantTable)
                .where(
                  and(
                    eq(productVariantTable.productId, productTable.id),
                    eq(productVariantTable.businessId, businessId),
                  ),
                ),
            ),
          ),
        )
        .orderBy(productTable.name);

      const variantRows = await tx
        .select({
          product: productTable,
          variant: productVariantTable,
          qty: productVariantStockTable.quantity,
        })
        .from(productVariantTable)
        .innerJoin(productTable, eq(productVariantTable.productId, productTable.id))
        .innerJoin(
          productVariantStockTable,
          and(
            eq(productVariantStockTable.productVariantId, productVariantTable.id),
            eq(productVariantStockTable.businessId, businessId),
          ),
        )
        .where(
          and(
            eq(productTable.businessId, businessId),
            eq(productTable.active, true),
            eq(productTable.trackStock, true),
            eq(productVariantTable.businessId, businessId),
            eq(productVariantTable.active, true),
            lte(productVariantStockTable.quantity, productTable.reorderLevel),
          ),
        )
        .orderBy(productTable.name, productVariantTable.sortOrder, productVariantTable.name);

      const fromSimple = simpleRows.map((r) =>
        LowStockItem.parse({
          productId: r.product.id,
          name: r.product.name,
          sku: r.product.sku,
          quantityOnHand: r.qty,
          reorderLevel: r.product.reorderLevel,
        }),
      );

      const fromVariants = variantRows.map((r) =>
        LowStockItem.parse({
          productId: r.product.id,
          name: `${r.product.name} · ${r.variant.name}`,
          sku: r.variant.sku ?? r.product.sku,
          quantityOnHand: r.qty,
          reorderLevel: r.product.reorderLevel,
        }),
      );

      return [...fromSimple, ...fromVariants];
    });
  });

  export const expiredBatches = fn(z.object({ businessId: z.string() }), async ({ businessId }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return withTransaction(async (tx) => {
      const rows = await tx
        .select({
          batch: inventoryBatchTable,
          productName: productTable.name,
        })
        .from(inventoryBatchTable)
        .innerJoin(productTable, eq(inventoryBatchTable.productId, productTable.id))
        .where(
          and(
            eq(inventoryBatchTable.businessId, businessId),
            eq(productTable.businessId, businessId),
            lt(inventoryBatchTable.expiresOn, today),
            gt(inventoryBatchTable.quantity, 0),
          ),
        )
        .orderBy(inventoryBatchTable.expiresOn);

      return rows.map((r) =>
        ExpiredBatchItem.parse({
          batchId: r.batch.id,
          productId: r.batch.productId,
          productName: r.productName,
          quantity: r.batch.quantity,
          expiresOn: r.batch.expiresOn,
          lotCode: r.batch.lotCode,
        }),
      );
    });
  });
}
