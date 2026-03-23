import { zValidator } from "@hono/zod-validator";
import { Actor } from "@repo/core/actor";
import { auth, type Session, type User } from "@repo/core/auth";
import {
  AppError,
  ErrorCodes,
  type ErrorResponseType,
  VisibleError,
} from "@repo/core/error";
import { HTTPException } from "hono/http-exception";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";

export type AppEnv = {
  Variables: {
    session: Session | null;
    user: User | null;
  };
};

type JsonStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500;

export const validate = ((target: never, schema: never) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          type: "validation",
          code: ErrorCodes.Validation.INVALID_PARAMETER,
          message: "Invalid request data",
          details: result.error,
        } satisfies ErrorResponseType,
        400,
      );
    }
  })) as typeof zValidator;

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set("session", session ?? null);
  c.set("user", session?.user ?? null);

  if (session?.user) {
    await Actor.provide(
      "user",
      {
        userID: session.user.id,
        role: (session.user as User & { role?: string | null }).role ?? "user",
      },
      async () => {
        await next();
      },
    );
    return;
  }

  await Actor.provide("public", {}, async () => {
    await next();
  });
};

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) {
    throw new VisibleError(
      "authentication",
      ErrorCodes.Authentication.UNAUTHORIZED,
      "Authentication required",
    );
  }
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");

  if (!user) {
    throw new VisibleError(
      "authentication",
      ErrorCodes.Authentication.UNAUTHORIZED,
      "Authentication required",
    );
  }

  if ((user as User & { role?: string | null }).role !== "admin") {
    throw new VisibleError(
      "forbidden",
      ErrorCodes.Permission.INSUFFICIENT_PERMISSIONS,
      "Admin access required",
    );
  }

  await next();
};

export function ok<T>(c: Context<AppEnv>, data: T, status: JsonStatus = 200) {
  return c.json({ data }, status);
}

export function paginated<T>(
  c: Context<AppEnv>,
  data: T[],
  meta: { total: number; limit: number; offset: number; hasMore: boolean },
  status: JsonStatus = 200,
) {
  return c.json({ data, meta }, status);
}

export function success(c: Context<AppEnv>, status: JsonStatus = 200) {
  return c.json({ success: true }, status);
}

export function noContent(c: Context<AppEnv>) {
  return c.body(null, 204);
}

export function parseBooleanFlag(value?: "true" | "false") {
  if (value === undefined) return undefined;
  return value === "true";
}

export function parseNumberParam(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new VisibleError(
      "validation",
      ErrorCodes.Validation.INVALID_PARAMETER,
      `Invalid numeric value: ${value}`,
    );
  }
  return parsed;
}

export function parseIntegerParam(value?: string) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new VisibleError(
      "validation",
      ErrorCodes.Validation.INVALID_PARAMETER,
      `Invalid integer value: ${value}`,
    );
  }
  return parsed;
}

export function parseAttributesQuery(value?: string) {
  if (!value) return undefined;

  const pairs = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const attributes: Record<string, string> = {};
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf(":");
    if (separatorIndex === -1) {
      throw new VisibleError(
        "validation",
        ErrorCodes.Validation.INVALID_FORMAT,
        'Invalid attributes format. Use "key:value,key:value".',
        "attributes",
      );
    }

    const key = pair.slice(0, separatorIndex).trim();
    const itemValue = pair.slice(separatorIndex + 1).trim();
    if (!key || !itemValue) {
      throw new VisibleError(
        "validation",
        ErrorCodes.Validation.INVALID_FORMAT,
        'Invalid attributes format. Use "key:value,key:value".',
        "attributes",
      );
    }
    attributes[key] = itemValue;
  }

  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

export function assertOwnerOrAdmin(ownerUserId: string | null | undefined) {
  const actor = Actor.current();
  if (actor.type !== "user") {
    throw new VisibleError(
      "authentication",
      ErrorCodes.Authentication.UNAUTHORIZED,
      "Authentication required",
    );
  }

  if (actor.properties.role === "admin") {
    return;
  }

  if (!ownerUserId || actor.properties.userID !== ownerUserId) {
    throw new VisibleError(
      "forbidden",
      ErrorCodes.Permission.FORBIDDEN,
      "You do not have access to this resource",
    );
  }
}

export function notFound(entity: string, id?: string) {
  return new VisibleError(
    "not_found",
    ErrorCodes.NotFound.RESOURCE_NOT_FOUND,
    id ? `${entity} with id '${id}' not found` : `${entity} not found`,
  );
}

function toErrorResponse(error: AppError): ErrorResponseType {
  const status = error.statusCode;

  if (status === 401) {
    return {
      type: "authentication",
      code: ErrorCodes.Authentication.UNAUTHORIZED,
      message: error.message,
      details: error.details,
    };
  }

  if (status === 403) {
    return {
      type: "forbidden",
      code: ErrorCodes.Permission.FORBIDDEN,
      message: error.message,
      details: error.details,
    };
  }

  if (status === 404) {
    return {
      type: "not_found",
      code: ErrorCodes.NotFound.RESOURCE_NOT_FOUND,
      message: error.message,
      details: error.details,
    };
  }

  return {
    type: "validation",
    code:
      status === 409
        ? ErrorCodes.Validation.ALREADY_EXISTS
        : ErrorCodes.Validation.INVALID_PARAMETER,
    message: error.message,
    details: error.details,
  };
}

export function handleError(error: unknown, c: Context<AppEnv>) {
  if (error instanceof VisibleError) {
    return c.json(error.toResponse(), error.statusCode() as JsonStatus);
  }

  if (error instanceof AppError) {
    return c.json(toErrorResponse(error), error.statusCode as JsonStatus);
  }

  if (error instanceof HTTPException) {
    return c.json(
      {
        type: "validation",
        code: ErrorCodes.Validation.INVALID_PARAMETER,
        message: error.message || "Invalid request",
      } satisfies ErrorResponseType,
      error.status >= 400 && error.status < 500 ? error.status : 400,
    );
  }

  if (error instanceof z.ZodError) {
    return c.json(
      {
        type: "validation",
        code: ErrorCodes.Validation.INVALID_PARAMETER,
        message: "Invalid request data",
        details: {
          issues: error.issues,
        },
      } satisfies ErrorResponseType,
      400,
    );
  }

  console.error("Unhandled API error:", error);

  return c.json(
    {
      type: "internal",
      code: ErrorCodes.Server.INTERNAL_ERROR,
      message: "Internal server error",
    } satisfies ErrorResponseType,
    500,
  );
}
