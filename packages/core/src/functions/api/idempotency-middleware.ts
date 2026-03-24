import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono";

import {
  abandonIdempotentRequest,
  completeIdempotentRequest,
  startIdempotentRequest,
} from "./idempotency";
import type { AppEnv } from "./common";

const MAX_KEY_LEN = 128;

/**
 * When `Idempotency-Key` is present, ensures at-most-once success caching for the wrapped route.
 * Non-2xx responses are not cached; the placeholder row is removed so the client can retry.
 */
export function idempotentMutation(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const raw =
      c.req.header("idempotency-key") ?? c.req.header("Idempotency-Key") ?? undefined;
    const key = raw?.trim();

    if (!key || key.length > MAX_KEY_LEN) {
      await next();
      return;
    }

    const user = c.get("user");
    const businessId = c.get("businessId");
    if (!user || !businessId) {
      await next();
      return;
    }

    const start = await startIdempotentRequest({
      userId: user.id,
      businessId,
      key,
    });

    if (start.kind === "in_flight") {
      throw new HTTPException(409, {
        message: "Request with this idempotency key is already in progress",
      });
    }

    if (start.kind === "replay") {
      return new Response(start.body, {
        status: start.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await next();
    } catch (err) {
      await abandonIdempotentRequest({ userId: user.id, businessId, key });
      throw err;
    }

    const res = c.res;
    if (res.status < 200 || res.status >= 300) {
      await abandonIdempotentRequest({ userId: user.id, businessId, key });
      return;
    }

    const bodyText = await res.clone().text();
    await completeIdempotentRequest({
      userId: user.id,
      businessId,
      key,
      responseStatus: res.status,
      responseBody: bodyText,
    });
  };
}
