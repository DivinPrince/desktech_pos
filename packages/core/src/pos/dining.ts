import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, createTransaction } from "../drizzle/transaction";
import { NotFoundError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import {
  diningTableTable,
  type DiningTableStatus,
  diningTableStatusEnum,
} from "./dining.sql";

export namespace DiningService {
  export const Info = z.object({
    id: z.string(),
    businessId: z.string(),
    label: z.string(),
    capacity: z.number(),
    status: z.enum(diningTableStatusEnum),
    layoutX: z.number().nullable(),
    layoutY: z.number().nullable(),
    floorZone: z.string().nullable(),
    active: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  function serialize(row: typeof diningTableTable.$inferSelect): z.infer<typeof Info> {
    return {
      id: row.id,
      businessId: row.businessId,
      label: row.label,
      capacity: row.capacity,
      status: row.status as DiningTableStatus,
      layoutX: row.layoutX,
      layoutY: row.layoutY,
      floorZone: row.floorZone,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  export const CreateInput = z.object({
    businessId: z.string(),
    label: z.string().min(1).max(64),
    capacity: z.number().int().positive().max(999).optional(),
    floorZone: z.string().max(64).optional(),
    layoutX: z.number().optional(),
    layoutY: z.number().optional(),
  });

  export const UpdateInput = z.object({
    businessId: z.string(),
    id: z.string(),
    label: z.string().min(1).max(64).optional(),
    capacity: z.number().int().positive().max(999).optional(),
    status: z.enum(diningTableStatusEnum).optional(),
    layoutX: z.number().nullable().optional(),
    layoutY: z.number().nullable().optional(),
    floorZone: z.string().nullable().optional(),
    active: z.boolean().optional(),
  });

  export async function list(businessId: string): Promise<z.infer<typeof Info>[]> {
    return withTransaction(async (tx) => {
      const rows = await tx
        .select()
        .from(diningTableTable)
        .where(eq(diningTableTable.businessId, businessId))
        .orderBy(asc(diningTableTable.floorZone), asc(diningTableTable.label));
      return rows.map(serialize);
    });
  }

  export const byId = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return withTransaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(diningTableTable)
          .where(and(eq(diningTableTable.id, id), eq(diningTableTable.businessId, businessId)));
        return row ? serialize(row) : undefined;
      });
    },
  );

  export const create = fn(CreateInput, async (input) => {
    return createTransaction(async (tx) => {
      const id = createID("dining_table");
      const [row] = await tx
        .insert(diningTableTable)
        .values({
          id,
          businessId: input.businessId,
          label: input.label,
          capacity: input.capacity ?? 4,
          layoutX: input.layoutX ?? null,
          layoutY: input.layoutY ?? null,
          floorZone: input.floorZone ?? null,
        })
        .returning();
      if (!row) throw new Error("Failed to create table");
      return serialize(row);
    });
  });

  export const update = fn(UpdateInput, async (input) => {
    return createTransaction(async (tx) => {
      const cur = await byId({ businessId: input.businessId, id: input.id });
      if (!cur) throw new NotFoundError("DiningTable", input.id);

      const [row] = await tx
        .update(diningTableTable)
        .set({
          ...("label" in input && input.label !== undefined ? { label: input.label } : {}),
          ...("capacity" in input && input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...("status" in input && input.status !== undefined ? { status: input.status } : {}),
          ...("layoutX" in input ? { layoutX: input.layoutX ?? null } : {}),
          ...("layoutY" in input ? { layoutY: input.layoutY ?? null } : {}),
          ...("floorZone" in input ? { floorZone: input.floorZone ?? null } : {}),
          ...("active" in input && input.active !== undefined ? { active: input.active } : {}),
        })
        .where(
          and(eq(diningTableTable.id, input.id), eq(diningTableTable.businessId, input.businessId)),
        )
        .returning();
      if (!row) throw new NotFoundError("DiningTable", input.id);
      return serialize(row);
    });
  });

  export const remove = fn(
    z.object({ businessId: z.string(), id: z.string() }),
    async ({ businessId, id }) => {
      return createTransaction(async (tx) => {
        const [row] = await tx
          .delete(diningTableTable)
          .where(and(eq(diningTableTable.id, id), eq(diningTableTable.businessId, businessId)))
          .returning();
        if (!row) throw new NotFoundError("DiningTable", id);
      });
    },
  );
}
