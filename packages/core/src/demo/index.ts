import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { withTransaction } from "../drizzle/transaction";
import { NotFoundError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import { demoItemTable } from "./demo.sql";

export * from "./demo.sql";

export namespace DemoService {
  export const Info = z
    .object({
      id: z.string(),
      label: z.string(),
      body: z.string().nullable(),
      createdByUserId: z.string().nullable(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
    .meta({ ref: "DemoItem", description: "Example row for full-stack demos" });

  export const CreateInput = z.object({
    label: z.string().min(1).max(200),
    body: z.string().max(5000).optional(),
    userId: z.string(),
  });

  function serialize(row: typeof demoItemTable.$inferSelect): z.infer<typeof Info> {
    return {
      id: row.id,
      label: row.label,
      body: row.body,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  export async function list(): Promise<z.infer<typeof Info>[]> {
    return withTransaction(async (tx) => {
      const rows = await tx.select().from(demoItemTable).orderBy(desc(demoItemTable.createdAt));
      return rows.map(serialize);
    });
  }

  export const byId = fn(z.string(), async (id) => {
    return withTransaction(async (tx) => {
      const [row] = await tx.select().from(demoItemTable).where(eq(demoItemTable.id, id));
      return row ? serialize(row) : undefined;
    });
  });

  export const create = fn(CreateInput, async (input) => {
    const { userId, ...rest } = input;
    return withTransaction(async (tx) => {
      const itemId = createID("demo_item");
      const [row] = await tx
        .insert(demoItemTable)
        .values({
          id: itemId,
          label: rest.label,
          body: rest.body,
          createdByUserId: userId,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create demo_item");
      }
      return serialize(row);
    });
  });

  export const remove = fn(z.string(), async (id) => {
    return withTransaction(async (tx) => {
      const [row] = await tx.delete(demoItemTable).where(eq(demoItemTable.id, id)).returning();
      if (!row) {
        throw new NotFoundError("DemoItem", id);
      }
    });
  });
}

export type DemoItemInfo = z.infer<typeof DemoService.Info>;
