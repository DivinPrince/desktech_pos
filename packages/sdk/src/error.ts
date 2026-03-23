/**
 * Base error class for all SDK errors
 */
export class SdkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdkError";
  }
}

/**
 * API error with status code and error details
 */
export class APIError extends SdkError {
  status?: number;
  code?: string;
  type?: string;
  param?: string;
  details?: unknown;

  constructor(
    message: string,
    status?: number,
    errorData?: {
      type?: string;
      code?: string;
      param?: string;
      details?: unknown;
    },
  ) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.type = errorData?.type;
    this.code = errorData?.code;
    this.param = errorData?.param;
    this.details = errorData?.details;
  }

  static generate(
    status: number | undefined,
    error: unknown,
    message: string | undefined,
  ): APIError {
    if (!status) {
      return new APIError(message || "Unknown error");
    }

    const errorData = APIError.asErrorData(error);
    const errorMessage = errorData?.message || message || "An error occurred";

    switch (status) {
      case 400:
        return new BadRequestError(errorMessage, errorData);
      case 401:
        return new AuthenticationError(errorMessage, errorData);
      case 403:
        return new PermissionDeniedError(errorMessage, errorData);
      case 404:
        return new NotFoundError(errorMessage, errorData);
      case 422:
        return new ValidationError(errorMessage, errorData);
      case 429:
        return new RateLimitError(errorMessage, errorData);
      case 500:
      case 502:
      case 503:
      case 504:
        return new InternalServerError(errorMessage, status, errorData);
      default:
        return new APIError(errorMessage, status, errorData);
    }
  }

  private static asErrorData(error: unknown): {
    type?: string;
    code?: string;
    param?: string;
    details?: unknown;
    message?: string;
  } | undefined {
    if (!error || typeof error !== "object") {
      return undefined;
    }

    return error as {
      type?: string;
      code?: string;
      param?: string;
      details?: unknown;
      message?: string;
    };
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends APIError {
  constructor(message: string, errorData?: ConstructorParameters<typeof APIError>[2]) {
    super(message, 400, errorData);
    this.name = "BadRequestError";
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class AuthenticationError extends APIError {
  constructor(message: string, errorData?: ConstructorParameters<typeof APIError>[2]) {
    super(message, 401, errorData);
    this.name = "AuthenticationError";
  }
}

/**
 * 403 Forbidden - Permission denied
 */
export class PermissionDeniedError extends APIError {
  constructor(message: string, errorData?: ConstructorParameters<typeof APIError>[2]) {
    super(message, 403, errorData);
    this.name = "PermissionDeniedError";
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends APIError {
  constructor(message: string, errorData?: ConstructorParameters<typeof APIError>[2]) {
    super(message, 404, errorData);
    this.name = "NotFoundError";
  }
}

/**
 * 422 Unprocessable Entity - Validation error
 */
export class ValidationError extends APIError {
  constructor(message: string, errorData?: ConstructorParameters<typeof APIError>[2]) {
    super(message, 422, errorData);
    this.name = "ValidationError";
  }
}

/**
 * 429 Too Many Requests
 */
export class RateLimitError extends APIError {
  constructor(message: string, errorData?: ConstructorParameters<typeof APIError>[2]) {
    super(message, 429, errorData);
    this.name = "RateLimitError";
  }
}

/**
 * 500+ Server errors
 */
export class InternalServerError extends APIError {
  constructor(
    message: string,
    status?: number,
    errorData?: ConstructorParameters<typeof APIError>[2],
  ) {
    super(message, status || 500, errorData);
    this.name = "InternalServerError";
  }
}

/**
 * Network connection error
 */
export class APIConnectionError extends SdkError {
  cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "APIConnectionError";
    this.cause = cause;
  }
}

/**
 * Request timeout error
 */
export class APIConnectionTimeoutError extends APIConnectionError {
  constructor() {
    super("Request timed out");
    this.name = "APIConnectionTimeoutError";
  }
}

/**
 * User aborted request
 */
export class APIUserAbortError extends SdkError {
  constructor() {
    super("Request was aborted");
    this.name = "APIUserAbortError";
  }
}
