import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createTransaction, type TxOrDb } from "../drizzle/transaction";
import { ErrorCodes, NotFoundError, VisibleError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import { productTable, productVariantTable } from "./catalog.sql";
import { productStockTable, productVariantStockTable } from "./inventory.sql";
import { saleLineTable } from "./sale.sql";

export namespace ProductVariantService {
  export const Info = z.object({
    id: z.string(),
    productId: z.string(),
    name: z.string(),
    sku: z.string().nullable(),
    priceCents: z.number(),
    costCents: z.number().nullable(),
    active: z.boolean(),
    sortOrder: z.number(),
    quantityOnHand: z.number(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  export function serialize(
    row: typeof productVariantTable.$inferSelect,
    quantityOnHand: number,
  ): z.infer<typeof Info> {
    return {
      id: row.id,
      productId: row.productId,
      name: row.name,
      sku: row.sku,
      priceCents: row.priceCents,
      costCents: row.costCents,
      active: row.active,
      sortOrder: row.sortOrder,
      quantityOnHand,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async function assertParentProduct(tx: TxOrDb, businessId: string, productId: string) {
    const [p] = await tx
      .select()
      .from(productTable)
      .where(and(eq(productTable.id, productId), eq(productTable.businessId, businessId)))
      .limit(1);
    if (!p) throw new NotFoundError("Product", productId);
    return p;
  }

  export async function listRowsForProducts(
    tx: TxOrDb,
    businessId: string,
    productIds: string[],
  ): Promise<Map<string, z.infer<typeof Info>[]>> {
    const map = new Map<string, z.infer<typeof Info>[]>();
    if (productIds.length === 0) return map;

    const rows = await tx
      .select({
        v: productVariantTable,
        qty: productVariantStockTable.quantity,
      })
      .from(productVariantTable)
      .leftJoin(
        productVariantStockTable,
        and(
          eq(productVariantStockTable.productVariantId, productVariantTable.id),
          eq(productVariantStockTable.businessId, businessId),
        ),
      )
      .where(
        and(
          eq(productVariantTable.businessId, businessId),
          inArray(productVariantTable.productId, productIds),
        ),
      )
      .orderBy(
        asc(productVariantTable.productId),
        asc(productVariantTable.sortOrder),
        asc(productVariantTable.name),
      );

    for (const r of rows) {
      const list = map.get(r.v.productId) ?? [];
      list.push(serialize(r.v, r.qty ?? 0));
      map.set(r.v.productId, list);
    }
    return map;
  }

  export const CreateInput = z.object({
    businessId: z.string(),
    productId: z.string(),
    name: z.string().min(1).max(255),
    sku: z.string().max(120).nullable().optional(),
    priceCents: z.number().int().nonnegative(),
    costCents: z.number().int().nonnegative().nullable().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });

  export const create = fn(CreateInput, async (input) => {
    return createTransaction(async (tx) => {
      await assertParentProduct(tx, input.businessId, input.productId);

      const [existingVariantCount] = await tx
        .select({ n: count() })
        .from(productVariantTable)
        .where(
          and(
            eq(productVariantTable.productId, input.productId),
            eq(productVariantTable.businessId, input.businessId),
          ),
        );
      const isFirstVariant = Number(existingVariantCount?.n ?? 0) === 0;

      const id = createID("product_variant");
      const [row] = await tx
        .insert(productVariantTable)
        .values({
          id,
          businessId: input.businessId,
          productId: input.productId,
          name: input.name,
          sku: input.sku ?? null,
          priceCents: input.priceCents,
          costCents: input.costCents ?? null,
          active: input.active ?? true,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning();
      if (!row) throw new Error("Failed to create variant");

      let initialQty = 0;
      if (isFirstVariant) {
        const [pstk] = await tx
          .select()
          .from(productStockTable)
          .where(
            and(
              eq(productStockTable.businessId, input.businessId),
              eq(productStockTable.productId, input.productId),
            ),
          );
        if (pstk && pstk.quantity > 0) {
          initialQty = pstk.quantity;
          await tx
            .update(productStockTable)
            .set({ quantity: 0 })
            .where(
              and(
                eq(productStockTable.businessId, input.businessId),
                eq(productStockTable.productId, input.productId),
              ),
            );
        }
      }

      await tx.insert(productVariantStockTable).values({
        businessId: input.businessId,
        productVariantId: id,
        quantity: initialQty,
      });

      return serialize(row, initialQty);
    });
  });

  export const UpdateInput = z.object({
    businessId: z.string(),
    productId: z.string(),
    id: z.string(),
    name: z.string().min(1).max(255).optional(),
    sku: z.string().max(120).nullable().optional(),
    priceCents: z.number().int().nonnegative().optional(),
    costCents: z.number().int().nonnegative().nullable().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });

  export const update = fn(UpdateInput, async (input) => {
    return createTransaction(async (tx) => {
      const [cur] = await tx
        .select()
        .from(productVariantTable)
        .where(
          and(
            eq(productVariantTable.id, input.id),
            eq(productVariantTable.businessId, input.businessId),
            eq(productVariantTable.productId, input.productId),
          ),
        )
        .limit(1);
      if (!cur) throw new NotFoundError("ProductVariant", input.id);

      const [row] = await tx
        .update(productVariantTable)
        .set({
          ...("name" in input && input.name !== undefined ? { name: input.name } : {}),
          ...("sku" in input ? { sku: input.sku ?? null } : {}),
          ...("priceCents" in input && input.priceCents !== undefined
            ? { priceCents: input.priceCents }
            : {}),
          ...("costCents" in input ? { costCents: input.costCents ?? null } : {}),
          ...("active" in input && input.active !== undefined ? { active: input.active } : {}),
          ...("sortOrder" in input && input.sortOrder !== undefined
            ? { sortOrder: input.sortOrder }
            : {}),
        })
        .where(eq(productVariantTable.id, input.id))
        .returning();
      if (!row) throw new NotFoundError("ProductVariant", input.id);

      const [stk] = await tx
        .select()
        .from(productVariantStockTable)
        .where(
          and(
            eq(productVariantStockTable.businessId, input.businessId),
            eq(productVariantStockTable.productVariantId, input.id),
          ),
        );
      return serialize(row, stk?.quantity ?? 0);
    });
  });

  export const remove = fn(
    z.object({
      businessId: z.string(),
      productId: z.string(),
      id: z.string(),
    }),
    async (input) => {
      return createTransaction(async (tx) => {
        const [cur] = await tx
          .select()
          .from(productVariantTable)
          .where(
            and(
              eq(productVariantTable.id, input.id),
              eq(productVariantTable.businessId, input.businessId),
              eq(productVariantTable.productId, input.productId),
            ),
          )
          .limit(1);
        if (!cur) throw new NotFoundError("ProductVariant", input.id);

        const [lineCount] = await tx
          .select({ n: count() })
          .from(saleLineTable)
          .where(eq(saleLineTable.productVariantId, input.id));
        if (Number(lineCount?.n ?? 0) > 0) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.IN_USE,
            "Cannot delete a variant that appears on sales",
            "variantId",
          );
        }

        await tx.delete(productVariantTable).where(eq(productVariantTable.id, input.id));
      });
    },
  );
}
