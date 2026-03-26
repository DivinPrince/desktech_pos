import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, createTransaction } from "../drizzle/transaction";
import { ErrorCodes, NotFoundError, VisibleError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import { categoryTable, productTable } from "./catalog.sql";
import { productStockTable } from "./inventory.sql";
import { ProductVariantService } from "./product-variant";
import { saleLineTable, saleTable } from "./sale.sql";

export namespace ProductService {
  export const Info = z.object({
    id: z.string(),
    businessId: z.string(),
    categoryId: z.string().nullable(),
    name: z.string(),
    sku: z.string().nullable(),
    unit: z.string(),
    description: z.string().nullable(),
    priceCents: z.number(),
    costCents: z.number().nullable(),
    reorderLevel: z.number(),
    trackStock: z.boolean(),
    active: z.boolean(),
    quantityOnHand: z.number(),
    variants: z.array(ProductVariantService.Info),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  export const CreateInput = z.object({
    businessId: z.string(),
    categoryId: z.string().optional(),
    name: z.string().min(1).max(255),
    sku: z.string().max(120).optional(),
    unit: z.string().max(32).optional(),
    description: z.string().max(5000).optional(),
    priceCents: z.number().int().nonnegative(),
    costCents: z.number().int().nonnegative().optional(),
    reorderLevel: z.number().int().nonnegative().optional(),
    trackStock: z.boolean().optional(),
    active: z.boolean().optional(),
  });

  export const UpdateInput = z.object({
    businessId: z.string(),
    id: z.string(),
    categoryId: z.string().nullable().optional(),
    name: z.string().min(1).max(255).optional(),
    sku: z.string().max(120).nullable().optional(),
    unit: z.string().max(32).optional(),
    description: z.string().nullable().optional(),
    priceCents: z.number().int().nonnegative().optional(),
    costCents: z.number().int().nonnegative().nullable().optional(),
    reorderLevel: z.number().int().nonnegative().optional(),
    trackStock: z.boolean().optional(),
    active: z.boolean().optional(),
  });

  function serialize(
    row: typeof productTable.$inferSelect,
    quantityOnHand: number,
    variants: z.infer<typeof ProductVariantService.Info>[],
  ): z.infer<typeof Info> {
    return {
      id: row.id,
      businessId: row.businessId,
      categoryId: row.categoryId,
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      description: row.description,
      priceCents: row.priceCents,
      costCents: row.costCents,
      reorderLevel: row.reorderLevel,
      trackStock: row.trackStock,
      active: row.active,
      quantityOnHand,
      variants,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  export const list = fn(
    z.object({
      businessId: z.string(),
      search: z.string().optional(),
      categoryId: z.string().optional(),
      activeOnly: z.boolean().optional(),
    }),
    async ({ businessId, search, categoryId, activeOnly }) => {
      return withTransaction(async (tx) => {
        const conditions = [eq(productTable.businessId, businessId)];
        if (categoryId) {
          conditions.push(eq(productTable.categoryId, categoryId));
        }
        if (activeOnly) {
          conditions.push(eq(productTable.active, true));
        }
        if (search?.trim()) {
          const q = `%${search.trim()}%`;
          conditions.push(
            or(ilike(productTable.name, q), ilike(productTable.sku, q))!,
          );
        }
        const rows = await tx
          .select({
            product: productTable,
            qty: productStockTable.quantity,
          })
          .from(productTable)
          .leftJoin(
            productStockTable,
            and(
              eq(productStockTable.productId, productTable.id),
              eq(productStockTable.businessId, businessId),
            ),
          )
          .where(and(...conditions))
          .orderBy(asc(productTable.name));

        const ids = rows.map((r) => r.product.id);
        const variantMap = await ProductVariantService.listRowsForProducts(tx, businessId, ids);

        return rows.map((r) => {
          const variants = variantMap.get(r.product.id) ?? [];
          const quantityOnHand =
            variants.length > 0
              ? variants.reduce((s, v) => s + v.quantityOnHand, 0)
              : (r.qty ?? 0);
          return serialize(r.product, quantityOnHand, variants);
        });
      });
    },
  );

  export const byId = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return withTransaction(async (tx) => {
        const [row] = await tx
          .select({
            product: productTable,
            qty: productStockTable.quantity,
          })
          .from(productTable)
          .leftJoin(
            productStockTable,
            and(
              eq(productStockTable.productId, productTable.id),
              eq(productStockTable.businessId, businessId),
            ),
          )
          .where(and(eq(productTable.id, id), eq(productTable.businessId, businessId)))
          .limit(1);
        if (!row) return undefined;
        const variantMap = await ProductVariantService.listRowsForProducts(tx, businessId, [
          row.product.id,
        ]);
        const variants = variantMap.get(row.product.id) ?? [];
        const quantityOnHand =
          variants.length > 0
            ? variants.reduce((s, v) => s + v.quantityOnHand, 0)
            : (row.qty ?? 0);
        return serialize(row.product, quantityOnHand, variants);
      });
    },
  );

  export const create = fn(CreateInput, async (input) => {
    return createTransaction(async (tx) => {
      if (input.categoryId) {
        const [cat] = await tx
          .select()
          .from(categoryTable)
          .where(eq(categoryTable.id, input.categoryId));
        if (!cat || cat.businessId !== input.businessId) {
          throw new NotFoundError("Category", input.categoryId);
        }
      }
      const id = createID("product");
      const [row] = await tx
        .insert(productTable)
        .values({
          id,
          businessId: input.businessId,
          categoryId: input.categoryId ?? null,
          name: input.name,
          sku: input.sku ?? null,
          unit: input.unit ?? "ea",
          description: input.description ?? null,
          priceCents: input.priceCents,
          costCents: input.costCents ?? null,
          reorderLevel: input.reorderLevel ?? 0,
          trackStock: input.trackStock ?? true,
          active: input.active ?? true,
        })
        .returning();
      if (!row) throw new Error("Failed to create product");

      await tx.insert(productStockTable).values({
        businessId: input.businessId,
        productId: id,
        quantity: 0,
      });

      return serialize(row, 0, []);
    });
  });

  export const update = fn(UpdateInput, async (input) => {
    return createTransaction(async (tx) => {
      const cur = await byId({ businessId: input.businessId, id: input.id });
      if (!cur) throw new NotFoundError("Product", input.id);

      if (input.categoryId !== undefined && input.categoryId !== null) {
        const [cat] = await tx
          .select()
          .from(categoryTable)
          .where(eq(categoryTable.id, input.categoryId));
        if (!cat || cat.businessId !== input.businessId) {
          throw new NotFoundError("Category", input.categoryId);
        }
      }

      const [row] = await tx
        .update(productTable)
        .set({
          ...("name" in input && input.name !== undefined ? { name: input.name } : {}),
          ...("categoryId" in input ? { categoryId: input.categoryId ?? null } : {}),
          ...("sku" in input ? { sku: input.sku ?? null } : {}),
          ...("unit" in input && input.unit !== undefined ? { unit: input.unit } : {}),
          ...("description" in input ? { description: input.description ?? null } : {}),
          ...("priceCents" in input && input.priceCents !== undefined
            ? { priceCents: input.priceCents }
            : {}),
          ...("costCents" in input ? { costCents: input.costCents ?? null } : {}),
          ...("reorderLevel" in input && input.reorderLevel !== undefined
            ? { reorderLevel: input.reorderLevel }
            : {}),
          ...("trackStock" in input && input.trackStock !== undefined
            ? { trackStock: input.trackStock }
            : {}),
          ...("active" in input && input.active !== undefined ? { active: input.active } : {}),
        })
        .where(and(eq(productTable.id, input.id), eq(productTable.businessId, input.businessId)))
        .returning();
      if (!row) throw new NotFoundError("Product", input.id);

      const [stk] = await tx
        .select()
        .from(productStockTable)
        .where(
          and(
            eq(productStockTable.businessId, input.businessId),
            eq(productStockTable.productId, input.id),
          ),
        );
      const qty = stk?.quantity ?? 0;
      const variantMap = await ProductVariantService.listRowsForProducts(tx, input.businessId, [
        input.id,
      ]);
      const variants = variantMap.get(input.id) ?? [];
      const quantityOnHand =
        variants.length > 0 ? variants.reduce((s, v) => s + v.quantityOnHand, 0) : qty;
      return serialize(row, quantityOnHand, variants);
    });
  });

  export const remove = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return createTransaction(async (tx) => {
        const [p] = await tx
          .select()
          .from(productTable)
          .where(and(eq(productTable.id, id), eq(productTable.businessId, businessId)))
          .limit(1);
        if (!p) throw new NotFoundError("Product", id);

        const [lineCount] = await tx
          .select({ n: count() })
          .from(saleLineTable)
          .innerJoin(saleTable, eq(saleLineTable.saleId, saleTable.id))
          .where(
            and(eq(saleLineTable.productId, id), eq(saleTable.businessId, businessId)),
          );
        if (Number(lineCount?.n ?? 0) > 0) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.IN_USE,
            "Cannot delete a product that appears on sales",
            "productId",
          );
        }

        await tx
          .delete(productTable)
          .where(and(eq(productTable.id, id), eq(productTable.businessId, businessId)));
      });
    },
  );
}
