import {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
} from "./error";
import type {
  FinalRequestOptions,
  Headers,
  RequestOptions,
} from "./types";
import { castToError, isEmptyObj, safeJSON, sleep } from "./types";

/**
 * Abstract base class for API resources
 */
export abstract class APIResource {
  protected _client: APIClient;

  constructor(client: APIClient) {
    this._client = client;
  }
}

/**
 * Promise wrapper for API responses
 */
export class APIPromise<T> extends Promise<T> {
  constructor(
    private responsePromise: Promise<Response>,
    private parseResponse: (response: Response) => Promise<T>,
  ) {
    super((resolve) => {
      resolve(undefined as never);
    });
  }

  private parse(): Promise<T> {
    return this.responsePromise.then(this.parseResponse);
  }

  /**
   * Get the raw Response object
   */
  async asResponse(): Promise<Response> {
    return this.responsePromise;
  }

  /**
   * Get both the parsed data and the Response object
   */
  async withResponse(): Promise<{ data: T; response: Response }> {
    const [data, response] = await Promise.all([
      this.parse(),
      this.asResponse(),
    ]);
    return { data, response };
  }

  override then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.parse().then(onfulfilled, onrejected);
  }

  override catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this.parse().catch(onrejected);
  }

  override finally(onfinally?: (() => void) | null): Promise<T> {
    return this.parse().finally(onfinally);
  }
}

function isFormDataBody(body: unknown): body is FormData {
  if (body == null || typeof body !== "object") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;

  return (
    Object.prototype.toString.call(body) === "[object FormData]" ||
    ("append" in body &&
      typeof body.append === "function" &&
      "get" in body &&
      typeof body.get === "function" &&
      "entries" in body &&
      typeof body.entries === "function")
  );
}

/**
 * Base API client with request handling, retries, and error handling
 */
export abstract class APIClient {
  baseURL: string;
  maxRetries: number;
  timeout: number;
  private fetch: typeof fetch;
  protected token?: string;
  protected credentials?: RequestCredentials;
  protected defaultHeaders: Headers;

  constructor(options: {
    baseURL: string;
    token?: string;
    credentials?: RequestCredentials;
    maxRetries?: number;
    timeout?: number;
    fetch?: typeof fetch;
    headers?: Headers;
  }) {
    this.baseURL = options.baseURL;
    this.token = options.token;
    this.credentials = options.credentials;
    this.maxRetries = options.maxRetries ?? 2;
    this.timeout = options.timeout ?? 60000; // 1 minute
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.headers ?? {};
  }

  /**
   * Build headers for the request
   */
  protected buildHeaders(options: FinalRequestOptions): HeadersInit {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.defaultHeaders,
    };

    const isFormData = isFormDataBody(options.body);

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    // Add authorization if token is provided
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    // Merge custom headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        if (value !== null && value !== undefined) {
          headers[key] = value;
        }
      }
    }

    return headers;
  }

  /**
   * Build URL with query parameters
   */
  protected buildURL(
    path: string,
    query?: Record<string, string | undefined>,
  ): string {
    const url = new URL(path, this.baseURL);

    if (query && !isEmptyObj(query)) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    return url.toString();
  }

  /**
   * Parse response body
   */
  protected async parseResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return null as T;
    }

    const contentType = response.headers.get("content-type");
    const isJSON = contentType?.includes("application/json");

    if (isJSON) {
      return response.json() as Promise<T>;
    }

    return response.text() as Promise<T>;
  }

  /**
   * Check if response should be retried
   */
  protected shouldRetry(response: Response): boolean {
    // Retry on request timeouts
    if (response.status === 408) return true;
    // Retry on lock timeouts
    if (response.status === 409) return true;
    // Retry on rate limits
    if (response.status === 429) return true;
    // Retry internal errors
    if (response.status >= 500) return true;

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  protected calculateRetryDelay(
    retriesRemaining: number,
    maxRetries: number,
  ): number {
    const initialDelay = 500; // 0.5 seconds
    const maxDelay = 8000; // 8 seconds

    const numRetries = maxRetries - retriesRemaining;
    const delay = Math.min(initialDelay * Math.pow(2, numRetries), maxDelay);

    // Add jitter (up to 25%)
    const jitter = 1 - Math.random() * 0.25;

    return delay * jitter;
  }

  /**
   * Make HTTP request with retries
   */
  protected async makeRequest(
    options: FinalRequestOptions,
    retriesRemaining: number | null = null,
  ): Promise<Response> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining === null) {
      retriesRemaining = maxRetries;
    }

    const url = this.buildURL(options.path, options.query);
    const headers = this.buildHeaders(options);
    const timeout = options.timeout ?? this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const isFormData = isFormDataBody(options.body);
    const body: BodyInit | null | undefined =
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as BodyInit)
          : JSON.stringify(options.body);

    // Combine signals
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const response = await this.fetch(url, {
        method: options.method,
        headers,
        body,
        signal: controller.signal,
        credentials: this.credentials,
      });

      clearTimeout(timeoutId);

      // Handle non-ok responses
      if (!response.ok) {
        // Check if we should retry
        if (retriesRemaining > 0 && this.shouldRetry(response)) {
          const delay = this.calculateRetryDelay(retriesRemaining, maxRetries);
          await sleep(delay);
          return this.makeRequest(options, retriesRemaining - 1);
        }

        // Parse error response
        const errorText = await response.text();
        const errorJSON = safeJSON(errorText) as Record<string, unknown> | undefined;
        const errorMessage =
          (errorJSON?.message as string) || errorText || response.statusText;

        throw APIError.generate(response.status, errorJSON, errorMessage);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (options.signal?.aborted) {
        throw new APIUserAbortError();
      }

      if (error instanceof APIError) {
        throw error;
      }

      const err = castToError(error);

      if (err.name === "AbortError") {
        throw new APIConnectionTimeoutError();
      }

      // Retry on connection errors
      if (retriesRemaining > 0) {
        const delay = this.calculateRetryDelay(retriesRemaining, maxRetries);
        await sleep(delay);
        return this.makeRequest(options, retriesRemaining - 1);
      }

      throw new APIConnectionError("Failed to connect to API", err);
    }
  }

  /**
   * Perform a request and return APIPromise
   */
  protected request<Req, Res>(
    options: FinalRequestOptions<Req>,
  ): APIPromise<Res> {
    return new APIPromise(this.makeRequest(options), (response) =>
      this.parseResponse<Res>(response),
    );
  }

  /**
   * GET request
   */
  get<Res>(
    path: string,
    options?: RequestOptions & { query?: Record<string, string | undefined> },
  ): APIPromise<Res> {
    return this.request<never, Res>({
      method: "GET",
      path,
      query: options?.query,
      headers: options?.headers,
      timeout: options?.timeout,
      maxRetries: options?.maxRetries,
      signal: options?.signal,
    });
  }

  /**
   * POST request
   */
  post<Req, Res>(
    path: string,
    options?: RequestOptions & { body?: Req },
  ): APIPromise<Res> {
    return this.request<Req, Res>({
      method: "POST",
      path,
      body: options?.body,
      headers: options?.headers,
      timeout: options?.timeout,
      maxRetries: options?.maxRetries,
      signal: options?.signal,
    });
  }

  /**
   * PUT request
   */
  put<Req, Res>(
    path: string,
    options?: RequestOptions & { body?: Req },
  ): APIPromise<Res> {
    return this.request<Req, Res>({
      method: "PUT",
      path,
      body: options?.body,
      headers: options?.headers,
      timeout: options?.timeout,
      maxRetries: options?.maxRetries,
      signal: options?.signal,
    });
  }

  /**
   * PATCH request
   */
  patch<Req, Res>(
    path: string,
    options?: RequestOptions & { body?: Req },
  ): APIPromise<Res> {
    return this.request<Req, Res>({
      method: "PATCH",
      path,
      body: options?.body,
      headers: options?.headers,
      timeout: options?.timeout,
      maxRetries: options?.maxRetries,
      signal: options?.signal,
    });
  }

  /**
   * DELETE request
   */
  delete<Res>(path: string, options?: RequestOptions): APIPromise<Res> {
    return this.request<never, Res>({
      method: "DELETE",
      path,
      headers: options?.headers,
      timeout: options?.timeout,
      maxRetries: options?.maxRetries,
      signal: options?.signal,
    });
  }
}
