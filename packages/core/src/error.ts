import * as z from 'zod/v4';
// or import * as z from 'zod'; if using Zod 4.0.0+
/**
 * Standard error response schema for OpenAPI documentation
 */
export const ErrorResponse = z
  .object({
    type: z
      .enum(["validation", "authentication", "forbidden", "not_found", "rate_limit", "internal"])
      .meta({ description: "The error type category" }),
    code: z.string().meta({ description: "Machine-readable error code identifier" }),
    message: z.string().meta({ description: "Human-readable error message" }),
    param: z.string().optional().meta({ description: "The parameter that caused the error" }),
    details: z.any().optional().meta({ description: "Additional error context" }),
  })
  .meta({ ref: "ErrorResponse" });

export type ErrorResponseType = z.infer<typeof ErrorResponse>;

/**
 * Standardized error codes for the API
 */
export const ErrorCodes = {
  Validation: {
    INVALID_PARAMETER: "invalid_parameter",
    MISSING_REQUIRED_FIELD: "missing_required_field",
    INVALID_FORMAT: "invalid_format",
    ALREADY_EXISTS: "already_exists",
    IN_USE: "resource_in_use",
    INVALID_STATE: "invalid_state",
  },
  Authentication: {
    UNAUTHORIZED: "unauthorized",
    INVALID_TOKEN: "invalid_token",
    EXPIRED_TOKEN: "expired_token",
    INVALID_CREDENTIALS: "invalid_credentials",
  },
  Permission: {
    FORBIDDEN: "forbidden",
    INSUFFICIENT_PERMISSIONS: "insufficient_permissions",
  },
  NotFound: {
    RESOURCE_NOT_FOUND: "resource_not_found",
  },
  RateLimit: {
    TOO_MANY_REQUESTS: "too_many_requests",
  },
  Server: {
    INTERNAL_ERROR: "internal_error",
    SERVICE_UNAVAILABLE: "service_unavailable",
  },
};

/**
 * Standard error that will be exposed to clients through API responses
 */
export class VisibleError extends Error {
  constructor(
    public type: ErrorResponseType["type"],
    public code: string,
    public override message: string,
    public param?: string,
    public details?: unknown,
  ) {
    super(message);
  }

  public statusCode(): number {
    switch (this.type) {
      case "validation":
        return 400;
      case "authentication":
        return 401;
      case "forbidden":
        return 403;
      case "not_found":
        return 404;
      case "rate_limit":
        return 429;
      case "internal":
        return 500;
    }
  }

  public toResponse(): ErrorResponseType {
    const response: ErrorResponseType = {
      type: this.type,
      code: this.code,
      message: this.message,
    };
    if (this.param) response.param = this.param;
    if (this.details) response.details = this.details;
    return response;
  }
}

// Legacy error classes for backwards compatibility
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      "NOT_FOUND",
      id ? `${entity} with id '${id}' not found` : `${entity} not found`,
      404,
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}
