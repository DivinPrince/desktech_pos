import { and, count, desc, eq, gt, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, createTransaction, type TxOrDb } from "../drizzle/transaction";
import { ErrorCodes, NotFoundError, VisibleError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import { productTable, productVariantTable } from "./catalog.sql";
import {
  inventoryBatchTable,
  productStockTable,
  productVariantStockTable,
  stockMovementTable,
  type StockMovementType,
  stockMovementTypeEnum,
} from "./inventory.sql";

export namespace InventoryService {
  export const MovementInfo = z.object({
    id: z.string(),
    businessId: z.string(),
    productId: z.string(),
    productVariantId: z.string().nullable(),
    type: z.enum(stockMovementTypeEnum),
    quantityDelta: z.number(),
    referenceSaleId: z.string().nullable(),
    note: z.string().nullable(),
    createdByUserId: z.string().nullable(),
    createdAt: z.date(),
  });

  export const BatchInfo = z.object({
    id: z.string(),
    businessId: z.string(),
    productId: z.string(),
    quantity: z.number(),
    expiresOn: z.date(),
    receivedAt: z.date(),
    lotCode: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  function movSerialize(row: typeof stockMovementTable.$inferSelect): z.infer<typeof MovementInfo> {
    return {
      id: row.id,
      businessId: row.businessId,
      productId: row.productId,
      productVariantId: row.productVariantId ?? null,
      type: row.type as StockMovementType,
      quantityDelta: row.quantityDelta,
      referenceSaleId: row.referenceSaleId,
      note: row.note,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
    };
  }

  function batchSerialize(row: typeof inventoryBatchTable.$inferSelect): z.infer<typeof BatchInfo> {
    return {
      id: row.id,
      businessId: row.businessId,
      productId: row.productId,
      quantity: row.quantity,
      expiresOn: row.expiresOn,
      receivedAt: row.receivedAt,
      lotCode: row.lotCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async function ensureProduct(tx: TxOrDb, businessId: string, productId: string) {
    const [p] = await tx
      .select()
      .from(productTable)
      .where(and(eq(productTable.id, productId), eq(productTable.businessId, businessId)))
      .limit(1);
    if (!p) throw new NotFoundError("Product", productId);
    if (!p.trackStock) {
      throw new VisibleError(
        "validation",
        ErrorCodes.Validation.INVALID_STATE,
        "Stock operations are disabled for this product",
      );
    }
    return p;
  }

  async function productHasVariants(tx: TxOrDb, businessId: string, productId: string) {
    const [r] = await tx
      .select({ n: count() })
      .from(productVariantTable)
      .where(
        and(
          eq(productVariantTable.businessId, businessId),
          eq(productVariantTable.productId, productId),
        ),
      );
    return Number(r?.n ?? 0) > 0;
  }

  export const adjustStock = fn(
    z.object({
      businessId: z.string(),
      productId: z.string(),
      productVariantId: z.string().optional(),
      quantityDelta: z.number().int(),
      type: z.enum(stockMovementTypeEnum),
      note: z.string().max(2000).optional(),
      userId: z.string(),
    }),
    async (input) => {
      return createTransaction(async (tx) => {
        await ensureProduct(tx, input.businessId, input.productId);

        if (input.productVariantId) {
          const [v] = await tx
            .select()
            .from(productVariantTable)
            .where(
              and(
                eq(productVariantTable.id, input.productVariantId),
                eq(productVariantTable.businessId, input.businessId),
                eq(productVariantTable.productId, input.productId),
              ),
            )
            .limit(1);
          if (!v) {
            throw new NotFoundError("ProductVariant", input.productVariantId);
          }

          const [stk] = await tx
            .select()
            .from(productVariantStockTable)
            .where(
              and(
                eq(productVariantStockTable.businessId, input.businessId),
                eq(productVariantStockTable.productVariantId, input.productVariantId),
              ),
            );
          if (!stk) {
            throw new NotFoundError("ProductVariantStock", input.productVariantId);
          }
          const nextQty = stk.quantity + input.quantityDelta;
          if (nextQty < 0) {
            throw new VisibleError(
              "validation",
              ErrorCodes.Validation.INVALID_STATE,
              "Insufficient stock for this adjustment",
            );
          }

          await tx
            .update(productVariantStockTable)
            .set({ quantity: nextQty })
            .where(
              and(
                eq(productVariantStockTable.businessId, input.businessId),
                eq(productVariantStockTable.productVariantId, input.productVariantId),
              ),
            );

          const id = createID("stock_movement");
          const [mov] = await tx
            .insert(stockMovementTable)
            .values({
              id,
              businessId: input.businessId,
              productId: input.productId,
              productVariantId: input.productVariantId,
              type: input.type,
              quantityDelta: input.quantityDelta,
              note: input.note ?? null,
              createdByUserId: input.userId,
            })
            .returning();
          if (!mov) throw new Error("Failed to record stock movement");
          return movSerialize(mov);
        }

        if (await productHasVariants(tx, input.businessId, input.productId)) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "This product uses variants — adjust stock on a specific variant",
          );
        }

        const [stk] = await tx
          .select()
          .from(productStockTable)
          .where(
            and(
              eq(productStockTable.businessId, input.businessId),
              eq(productStockTable.productId, input.productId),
            ),
          );
        if (!stk) {
          throw new NotFoundError("ProductStock", input.productId);
        }
        const nextQty = stk.quantity + input.quantityDelta;
        if (nextQty < 0) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Insufficient stock for this adjustment",
          );
        }

        await tx
          .update(productStockTable)
          .set({ quantity: nextQty })
          .where(
            and(
              eq(productStockTable.businessId, input.businessId),
              eq(productStockTable.productId, input.productId),
            ),
          );

        const id = createID("stock_movement");
        const [mov] = await tx
          .insert(stockMovementTable)
          .values({
            id,
            businessId: input.businessId,
            productId: input.productId,
            productVariantId: null,
            type: input.type,
            quantityDelta: input.quantityDelta,
            note: input.note ?? null,
            createdByUserId: input.userId,
          })
          .returning();
        if (!mov) throw new Error("Failed to record stock movement");
        return movSerialize(mov);
      });
    },
  );

  export const listMovements = fn(
    z.object({
      businessId: z.string(),
      productId: z.string().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    async ({ businessId, productId, from, to, limit }) => {
      return withTransaction(async (tx) => {
        const cond = [eq(stockMovementTable.businessId, businessId)];
        if (productId) cond.push(eq(stockMovementTable.productId, productId));
        if (from) cond.push(gte(stockMovementTable.createdAt, from));
        if (to) cond.push(lte(stockMovementTable.createdAt, to));

        const base = tx
          .select()
          .from(stockMovementTable)
          .where(and(...cond))
          .orderBy(desc(stockMovementTable.createdAt));
        const rows = limit ? await base.limit(limit) : await base;
        return rows.map(movSerialize);
      });
    },
  );

  export const receiveBatch = fn(
    z.object({
      businessId: z.string(),
      productId: z.string(),
      quantity: z.number().int().positive(),
      expiresOn: z.coerce.date(),
      lotCode: z.string().max(64).optional(),
      userId: z.string(),
    }),
    async (input) => {
      return createTransaction(async (tx) => {
        await ensureProduct(tx, input.businessId, input.productId);
        if (await productHasVariants(tx, input.businessId, input.productId)) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Batch receiving is not available for products that use variants",
          );
        }

        const batchId = createID("inventory_batch");
        const [batch] = await tx
          .insert(inventoryBatchTable)
          .values({
            id: batchId,
            businessId: input.businessId,
            productId: input.productId,
            quantity: input.quantity,
            expiresOn: input.expiresOn,
            lotCode: input.lotCode ?? null,
          })
          .returning();
        if (!batch) throw new Error("Failed to create batch");

        const [stk] = await tx
          .select()
          .from(productStockTable)
          .where(
            and(
              eq(productStockTable.businessId, input.businessId),
              eq(productStockTable.productId, input.productId),
            ),
          );
        if (!stk) throw new NotFoundError("ProductStock", input.productId);

        await tx
          .update(productStockTable)
          .set({ quantity: stk.quantity + input.quantity })
          .where(
            and(
              eq(productStockTable.businessId, input.businessId),
              eq(productStockTable.productId, input.productId),
            ),
          );

        const movId = createID("stock_movement");
        await tx.insert(stockMovementTable).values({
          id: movId,
          businessId: input.businessId,
          productId: input.productId,
          productVariantId: null,
          type: "purchase",
          quantityDelta: input.quantity,
          note: input.lotCode ? `Lot ${input.lotCode}` : null,
          createdByUserId: input.userId,
        });

        return batchSerialize(batch);
      });
    },
  );

  export const listBatches = fn(
    z.object({
      businessId: z.string(),
      productId: z.string().optional(),
    }),
    async ({ businessId, productId }) => {
      return withTransaction(async (tx) => {
        const cond = [
          eq(inventoryBatchTable.businessId, businessId),
          gt(inventoryBatchTable.quantity, 0),
        ];
        if (productId) cond.push(eq(inventoryBatchTable.productId, productId));
        const rows = await tx
          .select()
          .from(inventoryBatchTable)
          .where(and(...cond))
          .orderBy(inventoryBatchTable.expiresOn);
        return rows.map(batchSerialize);
      });
    },
  );

  export const adjustBatchQuantity = fn(
    z.object({
      businessId: z.string(),
      batchId: z.string(),
      quantityDelta: z.number().int(),
      userId: z.string(),
      note: z.string().max(2000).optional(),
    }),
    async (input) => {
      return createTransaction(async (tx) => {
        const [b] = await tx
          .select()
          .from(inventoryBatchTable)
          .where(eq(inventoryBatchTable.id, input.batchId));
        if (!b || b.businessId !== input.businessId) {
          throw new NotFoundError("InventoryBatch", input.batchId);
        }
        const next = b.quantity + input.quantityDelta;
        if (next < 0) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Batch quantity cannot go negative",
          );
        }

        await ensureProduct(tx, input.businessId, b.productId);
        if (await productHasVariants(tx, input.businessId, b.productId)) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Batch adjustments are not available for products that use variants",
          );
        }

        const [stk] = await tx
          .select()
          .from(productStockTable)
          .where(
            and(
              eq(productStockTable.businessId, input.businessId),
              eq(productStockTable.productId, b.productId),
            ),
          );
        if (!stk) throw new NotFoundError("ProductStock", b.productId);
        const stockNext = stk.quantity + input.quantityDelta;
        if (stockNext < 0) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Insufficient stock to apply batch adjustment",
          );
        }

        await tx
          .update(inventoryBatchTable)
          .set({ quantity: next })
          .where(eq(inventoryBatchTable.id, input.batchId));

        await tx
          .update(productStockTable)
          .set({ quantity: stockNext })
          .where(
            and(
              eq(productStockTable.businessId, input.businessId),
              eq(productStockTable.productId, b.productId),
            ),
          );

        const movId = createID("stock_movement");
        const [mov] = await tx
          .insert(stockMovementTable)
          .values({
            id: movId,
            businessId: input.businessId,
            productId: b.productId,
            productVariantId: null,
            type: "adjustment",
            quantityDelta: input.quantityDelta,
            note: input.note ?? `Batch ${input.batchId}`,
            createdByUserId: input.userId,
          })
          .returning();
        if (!mov) throw new Error("Failed to record movement");
        return { batch: batchSerialize({ ...b, quantity: next }), movement: movSerialize(mov) };
      });
    },
  );
}
