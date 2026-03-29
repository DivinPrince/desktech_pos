import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../drizzle/index";
import { fn } from "../util/fn";
import { createID } from "../util/id";
import { ProductService } from "./product";
import { offlineIdempotencyTable } from "./offline-idempotency.sql";

export namespace OfflineIdempotencyService {
  const scopeProductCreate = "product:create" as const;

  export const lookupCachedProductCreate = fn(
    z.object({
      userId: z.string(),
      businessId: z.string(),
      idempotencyKey: z.string().min(1).max(128),
    }),
    async ({
      userId,
      businessId,
      idempotencyKey,
    }): Promise<z.infer<typeof ProductService.Info> | undefined> => {
      const [row] = await db
        .select({ response: offlineIdempotencyTable.response })
        .from(offlineIdempotencyTable)
        .where(
          and(
            eq(offlineIdempotencyTable.userId, userId),
            eq(offlineIdempotencyTable.businessId, businessId),
            eq(offlineIdempotencyTable.scope, scopeProductCreate),
            eq(offlineIdempotencyTable.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (!row) return undefined;
      return row.response as z.infer<typeof ProductService.Info>;
    },
  );

  export const saveProductCreateResult = fn(
    z.object({
      userId: z.string(),
      businessId: z.string(),
      idempotencyKey: z.string().min(1).max(128),
      product: ProductService.Info,
    }),
    async ({ userId, businessId, idempotencyKey, product }) => {
      await db.insert(offlineIdempotencyTable).values({
        id: createID("offline_idempotency"),
        userId,
        businessId,
        scope: scopeProductCreate,
        idempotencyKey,
        response: product as unknown as Record<string, unknown>,
      });
    },
  );
}
