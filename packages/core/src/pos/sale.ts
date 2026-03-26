import { and, count, desc, eq, gt, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, createTransaction, type TxOrDb } from "../drizzle/transaction";
import { ErrorCodes, NotFoundError, VisibleError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import { productTable, productVariantTable } from "./catalog.sql";
import { diningTableTable } from "./dining.sql";
import {
  inventoryBatchTable,
  productStockTable,
  productVariantStockTable,
  stockMovementTable,
} from "./inventory.sql";
import { saleLineTable, saleTable, type SaleStatus, saleStatusEnum } from "./sale.sql";

export namespace SaleService {
  export const LineInfo = z.object({
    id: z.string(),
    saleId: z.string(),
    productId: z.string(),
    productVariantId: z.string().nullable(),
    quantity: z.number(),
    unitPriceCents: z.number(),
    lineDiscountCents: z.number(),
    productNameSnapshot: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  export const SaleInfo = z.object({
    id: z.string(),
    businessId: z.string(),
    status: z.enum(saleStatusEnum),
    tableId: z.string().nullable(),
    subtotalCents: z.number(),
    taxCents: z.number(),
    totalCents: z.number(),
    paymentMethod: z.string().nullable(),
    completedAt: z.date().nullable(),
    voidReason: z.string().nullable(),
    createdByUserId: z.string().nullable(),
    lines: z.array(LineInfo),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  function lineSerialize(row: typeof saleLineTable.$inferSelect): z.infer<typeof LineInfo> {
    return {
      id: row.id,
      saleId: row.saleId,
      productId: row.productId,
      productVariantId: row.productVariantId ?? null,
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
      lineDiscountCents: row.lineDiscountCents,
      productNameSnapshot: row.productNameSnapshot,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async function loadSaleWithLines(
    tx: TxOrDb,
    businessId: string,
    saleId: string,
  ): Promise<z.infer<typeof SaleInfo> | undefined> {
    const [s] = await tx
      .select()
      .from(saleTable)
      .where(and(eq(saleTable.id, saleId), eq(saleTable.businessId, businessId)));
    if (!s) return undefined;
    const lines = await tx
      .select()
      .from(saleLineTable)
      .where(eq(saleLineTable.saleId, saleId))
      .orderBy(saleLineTable.createdAt);
    return {
      id: s.id,
      businessId: s.businessId,
      status: s.status as SaleStatus,
      tableId: s.tableId,
      subtotalCents: s.subtotalCents,
      taxCents: s.taxCents,
      totalCents: s.totalCents,
      paymentMethod: s.paymentMethod,
      completedAt: s.completedAt,
      voidReason: s.voidReason,
      createdByUserId: s.createdByUserId,
      lines: lines.map(lineSerialize),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  export const list = fn(
    z.object({
      businessId: z.string(),
      status: z.enum(saleStatusEnum).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    async ({ businessId, status, from, to, limit }) => {
      return withTransaction(async (tx) => {
        const cond = [eq(saleTable.businessId, businessId)];
        if (status) cond.push(eq(saleTable.status, status));
        if (from) cond.push(gte(saleTable.updatedAt, from));
        if (to) cond.push(lte(saleTable.updatedAt, to));

        const base = tx
          .select()
          .from(saleTable)
          .where(and(...cond))
          .orderBy(desc(saleTable.updatedAt));
        const sales = limit ? await base.limit(limit) : await base;

        const out: z.infer<typeof SaleInfo>[] = [];
        for (const s of sales) {
          const full = await loadSaleWithLines(tx, businessId, s.id);
          if (full) out.push(full);
        }
        return out;
      });
    },
  );

  export const byId = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return withTransaction(async (tx) => loadSaleWithLines(tx, businessId, id));
    },
  );

  export const createDraft = fn(
    z.object({
      businessId: z.string(),
      tableId: z.string().optional(),
      userId: z.string(),
    }),
    async (input) => {
      return createTransaction(async (tx) => {
        if (input.tableId) {
          const [tbl] = await tx
            .select()
            .from(diningTableTable)
            .where(
              and(
                eq(diningTableTable.id, input.tableId),
                eq(diningTableTable.businessId, input.businessId),
              ),
            );
          if (!tbl) throw new NotFoundError("DiningTable", input.tableId);

          const [existingDraft] = await tx
            .select()
            .from(saleTable)
            .where(
              and(
                eq(saleTable.businessId, input.businessId),
                eq(saleTable.tableId, input.tableId),
                eq(saleTable.status, "draft"),
              ),
            )
            .limit(1);
          if (existingDraft) {
            throw new VisibleError(
              "validation",
              ErrorCodes.Validation.ALREADY_EXISTS,
              "This table already has an open draft sale",
            );
          }

          await tx
            .update(diningTableTable)
            .set({ status: "occupied" })
            .where(eq(diningTableTable.id, input.tableId));
        }

        const id = createID("sale");
        const [row] = await tx
          .insert(saleTable)
          .values({
            id,
            businessId: input.businessId,
            status: "draft",
            tableId: input.tableId ?? null,
            createdByUserId: input.userId,
          })
          .returning();
        if (!row) throw new Error("Failed to create sale");
        return (await loadSaleWithLines(tx, input.businessId, id))!;
      });
    },
  );

  function computeTotals(
    lines: { quantity: number; unitPriceCents: number; lineDiscountCents: number }[],
    taxCents: number,
  ) {
    const subtotalCents = lines.reduce(
      (acc, l) => acc + l.quantity * l.unitPriceCents - l.lineDiscountCents,
      0,
    );
    const totalCents = Math.max(0, subtotalCents + taxCents);
    return { subtotalCents, totalCents };
  }

  export const setDraftLines = fn(
    z.object({
      businessId: z.string(),
      saleId: z.string(),
      lines: z.array(
        z.object({
          productId: z.string(),
          productVariantId: z.string().optional(),
          quantity: z.number().int().positive(),
          unitPriceCents: z.number().int().nonnegative().optional(),
          lineDiscountCents: z.number().int().nonnegative().optional(),
        }),
      ),
    }),
    async (input) => {
      return createTransaction(async (tx) => {
        const sale = await loadSaleWithLines(tx, input.businessId, input.saleId);
        if (!sale) throw new NotFoundError("Sale", input.saleId);
        if (sale.status !== "draft") {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Only draft sales can be edited",
          );
        }

        await tx.delete(saleLineTable).where(eq(saleLineTable.saleId, input.saleId));

        const resolved: {
          quantity: number;
          unitPriceCents: number;
          lineDiscountCents: number;
        }[] = [];

        for (const line of input.lines) {
          const [p] = await tx
            .select()
            .from(productTable)
            .where(
              and(eq(productTable.id, line.productId), eq(productTable.businessId, input.businessId)),
            );
          if (!p) throw new NotFoundError("Product", line.productId);
          if (!p.active) {
            throw new VisibleError(
              "validation",
              ErrorCodes.Validation.INVALID_STATE,
              `Product '${p.name}' is not active`,
            );
          }

          const [vc] = await tx
            .select({ n: count() })
            .from(productVariantTable)
            .where(
              and(
                eq(productVariantTable.productId, line.productId),
                eq(productVariantTable.businessId, input.businessId),
              ),
            );
          const hasVariants = Number(vc?.n ?? 0) > 0;

          let unitPriceCents: number;
          let productNameSnapshot: string;
          let productVariantId: string | null;

          if (hasVariants) {
            if (!line.productVariantId) {
              throw new VisibleError(
                "validation",
                ErrorCodes.Validation.INVALID_STATE,
                `Choose a variant for '${p.name}'`,
              );
            }
            const [v] = await tx
              .select()
              .from(productVariantTable)
              .where(
                and(
                  eq(productVariantTable.id, line.productVariantId),
                  eq(productVariantTable.productId, line.productId),
                  eq(productVariantTable.businessId, input.businessId),
                ),
              )
              .limit(1);
            if (!v) {
              throw new NotFoundError("ProductVariant", line.productVariantId);
            }
            if (!v.active) {
              throw new VisibleError(
                "validation",
                ErrorCodes.Validation.INVALID_STATE,
                `Variant '${v.name}' is not active`,
              );
            }
            unitPriceCents = line.unitPriceCents ?? v.priceCents;
            productNameSnapshot = `${p.name} · ${v.name}`;
            productVariantId = v.id;
          } else {
            if (line.productVariantId) {
              throw new VisibleError(
                "validation",
                ErrorCodes.Validation.INVALID_STATE,
                "This product does not use variants",
              );
            }
            unitPriceCents = line.unitPriceCents ?? p.priceCents;
            productNameSnapshot = p.name;
            productVariantId = null;
          }

          const lineDiscountCents = line.lineDiscountCents ?? 0;
          const lid = createID("sale_line");
          await tx.insert(saleLineTable).values({
            id: lid,
            saleId: input.saleId,
            productId: line.productId,
            productVariantId,
            quantity: line.quantity,
            unitPriceCents,
            lineDiscountCents,
            productNameSnapshot,
          });
          resolved.push({ quantity: line.quantity, unitPriceCents, lineDiscountCents });
        }

        const { subtotalCents, totalCents } = computeTotals(resolved, sale.taxCents);
        await tx
          .update(saleTable)
          .set({ subtotalCents, totalCents })
          .where(eq(saleTable.id, input.saleId));

        return (await loadSaleWithLines(tx, input.businessId, input.saleId))!;
      });
    },
  );

  async function consumeStockForLine(
    tx: TxOrDb,
    businessId: string,
    productId: string,
    productVariantId: string | null,
    quantity: number,
    saleId: string,
    userId: string,
  ) {
    const [p] = await tx
      .select()
      .from(productTable)
      .where(and(eq(productTable.id, productId), eq(productTable.businessId, businessId)));
    if (!p) throw new NotFoundError("Product", productId);
    if (!p.trackStock) return;

    if (productVariantId) {
      const [stk] = await tx
        .select()
        .from(productVariantStockTable)
        .where(
          and(
            eq(productVariantStockTable.businessId, businessId),
            eq(productVariantStockTable.productVariantId, productVariantId),
          ),
        );
      if (!stk || stk.quantity < quantity) {
        throw new VisibleError(
          "validation",
          ErrorCodes.Validation.INVALID_STATE,
          `Insufficient stock for '${p.name}'`,
        );
      }

      await tx
        .update(productVariantStockTable)
        .set({ quantity: stk.quantity - quantity })
        .where(
          and(
            eq(productVariantStockTable.businessId, businessId),
            eq(productVariantStockTable.productVariantId, productVariantId),
          ),
        );

      const movId = createID("stock_movement");
      await tx.insert(stockMovementTable).values({
        id: movId,
        businessId,
        productId,
        productVariantId,
        type: "sale",
        quantityDelta: -quantity,
        referenceSaleId: saleId,
        createdByUserId: userId,
      });
      return;
    }

    const [stk] = await tx
      .select()
      .from(productStockTable)
      .where(
        and(eq(productStockTable.businessId, businessId), eq(productStockTable.productId, productId)),
      );
    if (!stk || stk.quantity < quantity) {
      throw new VisibleError(
        "validation",
        ErrorCodes.Validation.INVALID_STATE,
        `Insufficient stock for product '${p.name}'`,
      );
    }

    let remaining = quantity;
    const batches = await tx
      .select()
      .from(inventoryBatchTable)
      .where(
        and(
          eq(inventoryBatchTable.businessId, businessId),
          eq(inventoryBatchTable.productId, productId),
          gt(inventoryBatchTable.quantity, 0),
        ),
      )
      .orderBy(inventoryBatchTable.expiresOn);

    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      if (take <= 0) continue;
      await tx
        .update(inventoryBatchTable)
        .set({ quantity: b.quantity - take })
        .where(eq(inventoryBatchTable.id, b.id));
      remaining -= take;
    }

    await tx
      .update(productStockTable)
      .set({ quantity: stk.quantity - quantity })
      .where(
        and(eq(productStockTable.businessId, businessId), eq(productStockTable.productId, productId)),
      );

    const movId = createID("stock_movement");
    await tx.insert(stockMovementTable).values({
      id: movId,
      businessId,
      productId,
      productVariantId: null,
      type: "sale",
      quantityDelta: -quantity,
      referenceSaleId: saleId,
      createdByUserId: userId,
    });
  }

  export const complete = fn(
    z.object({
      businessId: z.string(),
      saleId: z.string(),
      paymentMethod: z.string().min(1).max(64),
      taxCents: z.number().int().nonnegative().optional(),
      userId: z.string(),
    }),
    async (input) => {
      return createTransaction(async (tx) => {
        const sale = await loadSaleWithLines(tx, input.businessId, input.saleId);
        if (!sale) throw new NotFoundError("Sale", input.saleId);
        if (sale.status !== "draft") {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Only draft sales can be completed",
          );
        }
        if (sale.lines.length === 0) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Add at least one line before completing",
          );
        }

        const taxCents = input.taxCents ?? sale.taxCents;
        const { subtotalCents, totalCents } = computeTotals(
          sale.lines.map((l) => ({
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            lineDiscountCents: l.lineDiscountCents,
          })),
          taxCents,
        );

        for (const line of sale.lines) {
          await consumeStockForLine(
            tx,
            input.businessId,
            line.productId,
            line.productVariantId,
            line.quantity,
            input.saleId,
            input.userId,
          );
        }

        const completedAt = new Date();
        await tx
          .update(saleTable)
          .set({
            status: "completed",
            subtotalCents,
            taxCents,
            totalCents,
            paymentMethod: input.paymentMethod,
            completedAt,
          })
          .where(eq(saleTable.id, input.saleId));

        if (sale.tableId) {
          await tx
            .update(diningTableTable)
            .set({ status: "free" })
            .where(eq(diningTableTable.id, sale.tableId));
        }

        return (await loadSaleWithLines(tx, input.businessId, input.saleId))!;
      });
    },
  );

  export const voidSale = fn(
    z.object({
      businessId: z.string(),
      saleId: z.string(),
      reason: z.string().min(1).max(2000),
      userId: z.string(),
    }),
    async (input) => {
      return createTransaction(async (tx) => {
        const sale = await loadSaleWithLines(tx, input.businessId, input.saleId);
        if (!sale) throw new NotFoundError("Sale", input.saleId);
        if (sale.status === "voided") {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Sale is already voided",
          );
        }

        if (sale.status === "completed") {
          for (const line of sale.lines) {
            const [p] = await tx
              .select()
              .from(productTable)
              .where(
                and(eq(productTable.id, line.productId), eq(productTable.businessId, input.businessId)),
              );
            if (!p?.trackStock) continue;

            if (line.productVariantId) {
              const [vstk] = await tx
                .select()
                .from(productVariantStockTable)
                .where(
                  and(
                    eq(productVariantStockTable.businessId, input.businessId),
                    eq(productVariantStockTable.productVariantId, line.productVariantId),
                  ),
                );
              if (vstk) {
                await tx
                  .update(productVariantStockTable)
                  .set({ quantity: vstk.quantity + line.quantity })
                  .where(
                    and(
                      eq(productVariantStockTable.businessId, input.businessId),
                      eq(productVariantStockTable.productVariantId, line.productVariantId),
                    ),
                  );
              }
              const movId = createID("stock_movement");
              await tx.insert(stockMovementTable).values({
                id: movId,
                businessId: input.businessId,
                productId: line.productId,
                productVariantId: line.productVariantId,
                type: "sale_return",
                quantityDelta: line.quantity,
                referenceSaleId: input.saleId,
                note: `Void: ${input.reason}`,
                createdByUserId: input.userId,
              });
              continue;
            }

            const [stk] = await tx
              .select()
              .from(productStockTable)
              .where(
                and(
                  eq(productStockTable.businessId, input.businessId),
                  eq(productStockTable.productId, line.productId),
                ),
              );
            if (stk) {
              await tx
                .update(productStockTable)
                .set({ quantity: stk.quantity + line.quantity })
                .where(
                  and(
                    eq(productStockTable.businessId, input.businessId),
                    eq(productStockTable.productId, line.productId),
                  ),
                );
            }
            const movId = createID("stock_movement");
            await tx.insert(stockMovementTable).values({
              id: movId,
              businessId: input.businessId,
              productId: line.productId,
              productVariantId: null,
              type: "sale_return",
              quantityDelta: line.quantity,
              referenceSaleId: input.saleId,
              note: `Void: ${input.reason}`,
              createdByUserId: input.userId,
            });
          }
        }

        if (sale.status === "draft" && sale.tableId) {
          await tx
            .update(diningTableTable)
            .set({ status: "free" })
            .where(eq(diningTableTable.id, sale.tableId));
        }

        await tx
          .update(saleTable)
          .set({
            status: "voided",
            voidReason: input.reason,
          })
          .where(eq(saleTable.id, input.saleId));

        return (await loadSaleWithLines(tx, input.businessId, input.saleId))!;
      });
    },
  );
}
