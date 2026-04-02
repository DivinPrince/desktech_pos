import { and, eq, gt, lte, lt } from "drizzle-orm";
import { z } from "zod";
import { withTransaction } from "../drizzle/transaction";
import { fn } from "../util/fn";
import { productTable } from "./catalog.sql";
import { inventoryBatchTable, productStockTable } from "./inventory.sql";

export namespace AlertService {
  export const LowStockItem = z.object({
    productId: z.string(),
    name: z.string(),
    sku: z.string().nullable(),
    quantityOnHand: z.number(),
    stockAlert: z.number(),
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
      const rows = await tx
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
            lte(productStockTable.quantity, productTable.stockAlert),
          ),
        )
        .orderBy(productTable.name);
      return rows.map((r) =>
        LowStockItem.parse({
          productId: r.product.id,
          name: r.product.name,
          sku: r.product.sku,
          quantityOnHand: r.qty,
          stockAlert: r.product.stockAlert,
        }),
      );
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
