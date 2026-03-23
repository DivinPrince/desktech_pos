import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, createTransaction } from "../drizzle/transaction";
import { NotFoundError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import { expenseTable } from "./expense.sql";

export namespace ExpenseService {
  export const Info = z.object({
    id: z.string(),
    businessId: z.string(),
    category: z.string(),
    amountCents: z.number(),
    spentAt: z.date(),
    note: z.string().nullable(),
    createdByUserId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  function serialize(row: typeof expenseTable.$inferSelect): z.infer<typeof Info> {
    return {
      id: row.id,
      businessId: row.businessId,
      category: row.category,
      amountCents: row.amountCents,
      spentAt: row.spentAt,
      note: row.note,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  export const CreateInput = z.object({
    businessId: z.string(),
    category: z.string().min(1).max(120),
    amountCents: z.number().int().positive(),
    spentAt: z.coerce.date(),
    note: z.string().max(2000).optional(),
    userId: z.string(),
  });

  export const UpdateInput = z.object({
    businessId: z.string(),
    id: z.string(),
    category: z.string().min(1).max(120).optional(),
    amountCents: z.number().int().positive().optional(),
    spentAt: z.coerce.date().optional(),
    note: z.string().nullable().optional(),
  });

  export const list = fn(
    z.object({
      businessId: z.string(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      category: z.string().optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    async ({ businessId, from, to, category, limit }) => {
      return withTransaction(async (tx) => {
        const cond = [eq(expenseTable.businessId, businessId)];
        if (from) cond.push(gte(expenseTable.spentAt, from));
        if (to) cond.push(lte(expenseTable.spentAt, to));
        if (category) cond.push(eq(expenseTable.category, category));

        const base = tx
          .select()
          .from(expenseTable)
          .where(and(...cond))
          .orderBy(desc(expenseTable.spentAt));
        const rows = limit ? await base.limit(limit) : await base;
        return rows.map(serialize);
      });
    },
  );

  export const byId = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return withTransaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(expenseTable)
          .where(and(eq(expenseTable.id, id), eq(expenseTable.businessId, businessId)));
        return row ? serialize(row) : undefined;
      });
    },
  );

  export const create = fn(CreateInput, async (input) => {
    return createTransaction(async (tx) => {
      const id = createID("expense");
      const [row] = await tx
        .insert(expenseTable)
        .values({
          id,
          businessId: input.businessId,
          category: input.category,
          amountCents: input.amountCents,
          spentAt: input.spentAt,
          note: input.note ?? null,
          createdByUserId: input.userId,
        })
        .returning();
      if (!row) throw new Error("Failed to create expense");
      return serialize(row);
    });
  });

  export const update = fn(UpdateInput, async (input) => {
    return createTransaction(async (tx) => {
      const cur = await byId({ businessId: input.businessId, id: input.id });
      if (!cur) throw new NotFoundError("Expense", input.id);

      const [row] = await tx
        .update(expenseTable)
        .set({
          ...("category" in input && input.category !== undefined ? { category: input.category } : {}),
          ...("amountCents" in input && input.amountCents !== undefined
            ? { amountCents: input.amountCents }
            : {}),
          ...("spentAt" in input && input.spentAt !== undefined ? { spentAt: input.spentAt } : {}),
          ...("note" in input ? { note: input.note ?? null } : {}),
        })
        .where(and(eq(expenseTable.id, input.id), eq(expenseTable.businessId, input.businessId)))
        .returning();
      if (!row) throw new NotFoundError("Expense", input.id);
      return serialize(row);
    });
  });

  export const remove = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return createTransaction(async (tx) => {
        const [row] = await tx
          .delete(expenseTable)
          .where(and(eq(expenseTable.id, id), eq(expenseTable.businessId, businessId)))
          .returning();
        if (!row) throw new NotFoundError("Expense", id);
      });
    },
  );
}
