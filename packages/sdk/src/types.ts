/**
 * Standard response wrapper
 */
export interface Response<T> {
  data: T;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Request options that can be passed to any API method
 */
export interface RequestOptions {
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Maximum number of retries for failed requests
   */
  maxRetries?: number;

  /**
   * AbortSignal to cancel the request
   */
  signal?: AbortSignal;

  /**
   * Additional headers to include
   */
  headers?: Record<string, string>;
}

/**
 * Headers type
 */
export type Headers = Record<string, string | null | undefined>;

/**
 * HTTP methods
 */
export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Final request options with all defaults applied
 */
export interface FinalRequestOptions<Body = unknown> {
  method: HTTPMethod;
  path: string;
  query?: Record<string, string | undefined>;
  body?: Body;
  headers?: Headers;
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

/**
 * Sleep utility
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if object is empty
 */
export const isEmptyObj = (obj: unknown): boolean => {
  if (!obj || typeof obj !== "object") return true;
  for (const _key in obj) return false;
  return true;
};

/**
 * Safe JSON parse
 */
export const safeJSON = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Cast to Error
 */
export const castToError = (err: unknown): Error => {
  if (err instanceof Error) return err;
  if (typeof err === "object" && err !== null) {
    try {
      return new Error(JSON.stringify(err));
    } catch {
      // Fall back to string coercion below.
    }
  }
  return new Error(String(err));
};
