import { and, eq } from "drizzle-orm";

import { db } from "../../drizzle";

import { apiIdempotencyKeyTable } from "./idempotency.sql";

export type IdempotencyStartResult =
  | { kind: "fresh" }
  | { kind: "replay"; status: number; body: string }
  | { kind: "in_flight" };

export async function startIdempotentRequest(params: {
  userId: string;
  businessId: string;
  key: string;
}): Promise<IdempotencyStartResult> {
  try {
    await db.insert(apiIdempotencyKeyTable).values({
      userId: params.userId,
      businessId: params.businessId,
      key: params.key,
      responseStatus: 0,
      responseBody: "{}",
    });
    return { kind: "fresh" };
  } catch (e: unknown) {
    const topCode = (e as { code?: string }).code;
    const causeCode = (e as { cause?: { code?: string } })?.cause?.code;
    const msg = e instanceof Error ? e.message : String(e);
    const isUniqueViolation =
      topCode === "23505" ||
      causeCode === "23505" ||
      msg.includes("duplicate key") ||
      msg.includes("23505");
    if (!isUniqueViolation) {
      throw e;
    }

    const [row] = await db
      .select()
      .from(apiIdempotencyKeyTable)
      .where(
        and(
          eq(apiIdempotencyKeyTable.userId, params.userId),
          eq(apiIdempotencyKeyTable.businessId, params.businessId),
          eq(apiIdempotencyKeyTable.key, params.key),
        ),
      )
      .limit(1);

    if (!row) {
      throw e;
    }

    if (row.responseStatus === 0) {
      return { kind: "in_flight" };
    }

    return { kind: "replay", status: row.responseStatus, body: row.responseBody };
  }
}

export async function completeIdempotentRequest(params: {
  userId: string;
  businessId: string;
  key: string;
  responseStatus: number;
  responseBody: string;
}): Promise<void> {
  await db
    .update(apiIdempotencyKeyTable)
    .set({
      responseStatus: params.responseStatus,
      responseBody: params.responseBody,
    })
    .where(
      and(
        eq(apiIdempotencyKeyTable.userId, params.userId),
        eq(apiIdempotencyKeyTable.businessId, params.businessId),
        eq(apiIdempotencyKeyTable.key, params.key),
      ),
    );
}

export async function abandonIdempotentRequest(params: {
  userId: string;
  businessId: string;
  key: string;
}): Promise<void> {
  await db
    .delete(apiIdempotencyKeyTable)
    .where(
      and(
        eq(apiIdempotencyKeyTable.userId, params.userId),
        eq(apiIdempotencyKeyTable.businessId, params.businessId),
        eq(apiIdempotencyKeyTable.key, params.key),
      ),
    );
}
