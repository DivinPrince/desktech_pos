import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, createTransaction } from "../drizzle/transaction";
import { ErrorCodes, NotFoundError, VisibleError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import { categoryTable, productTable } from "./catalog.sql";

export namespace CategoryService {
  export const Info = z.object({
    id: z.string(),
    businessId: z.string(),
    name: z.string(),
    sortOrder: z.number(),
    parentId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  function serialize(row: typeof categoryTable.$inferSelect): z.infer<typeof Info> {
    return {
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      sortOrder: row.sortOrder,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  export const CreateInput = z.object({
    businessId: z.string(),
    name: z.string().min(1).max(255),
    parentId: z.string().optional(),
    sortOrder: z.number().int().optional(),
  });

  export const UpdateInput = z.object({
    businessId: z.string(),
    id: z.string(),
    name: z.string().min(1).max(255).optional(),
    parentId: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  });

  export async function list(businessId: string): Promise<z.infer<typeof Info>[]> {
    return withTransaction(async (tx) => {
      const rows = await tx
        .select()
        .from(categoryTable)
        .where(eq(categoryTable.businessId, businessId))
        .orderBy(asc(categoryTable.sortOrder), asc(categoryTable.name));
      return rows.map(serialize);
    });
  }

  export const byId = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return withTransaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(categoryTable)
          .where(eq(categoryTable.id, id))
          .limit(1);
        if (!row || row.businessId !== businessId) return undefined;
        return serialize(row);
      });
    },
  );

  export const create = fn(CreateInput, async (input) => {
    return createTransaction(async (tx) => {
      if (input.parentId) {
        const [parent] = await tx
          .select()
          .from(categoryTable)
          .where(eq(categoryTable.id, input.parentId));
        if (!parent || parent.businessId !== input.businessId) {
          throw new NotFoundError("Category", input.parentId);
        }
      }
      const id = createID("category");
      const inserted = await tx
        .insert(categoryTable)
        .values({
          id,
          businessId: input.businessId,
          name: input.name,
          parentId: input.parentId ?? null,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("Failed to create category");
      return serialize(row);
    });
  });

  export const update = fn(UpdateInput, async (input) => {
    return createTransaction(async (tx) => {
      const existing = await byId({ businessId: input.businessId, id: input.id });
      if (!existing) throw new NotFoundError("Category", input.id);

      if (input.parentId !== undefined && input.parentId !== null) {
        const [parent] = await tx
          .select()
          .from(categoryTable)
          .where(eq(categoryTable.id, input.parentId));
        if (!parent || parent.businessId !== input.businessId) {
          throw new NotFoundError("Category", input.parentId);
        }
        if (input.parentId === input.id) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_PARAMETER,
            "Category cannot be its own parent",
          );
        }
      }

      const [row] = await tx
        .update(categoryTable)
        .set({
          ...("name" in input && input.name !== undefined ? { name: input.name } : {}),
          ...("parentId" in input ? { parentId: input.parentId ?? null } : {}),
          ...("sortOrder" in input && input.sortOrder !== undefined
            ? { sortOrder: input.sortOrder }
            : {}),
        })
        .where(
          and(eq(categoryTable.id, input.id), eq(categoryTable.businessId, input.businessId)),
        )
        .returning();
      if (!row) throw new NotFoundError("Category", input.id);
      return serialize(row);
    });
  });

  export const remove = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return createTransaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(categoryTable)
          .where(eq(categoryTable.id, id))
          .limit(1);
        if (!row || row.businessId !== businessId) throw new NotFoundError("Category", id);

        const [child] = await tx
          .select()
          .from(categoryTable)
          .where(eq(categoryTable.parentId, id))
          .limit(1);
        if (child) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.IN_USE,
            "Cannot delete category with child categories",
          );
        }

        const [prod] = await tx
          .select()
          .from(productTable)
          .where(eq(productTable.categoryId, id))
          .limit(1);
        if (prod) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.IN_USE,
            "Cannot delete category that has products",
          );
        }

        await tx.delete(categoryTable).where(eq(categoryTable.id, id));
      });
    },
  );
}
