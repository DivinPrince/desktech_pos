import { APIClient } from "./core";
import { DemoResource } from "./resources/demo";
import { HealthResource } from "./resources/health";

export * from "./error";
export * from "./types";
export * from "./resources/demo";
export * from "./resources/health";

export interface SdkOptions {
  baseURL?: string;
  token?: string;
  credentials?: RequestCredentials;
  timeout?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export class Sdk extends APIClient {
  demo: DemoResource;
  health: HealthResource;

  constructor(options: SdkOptions = {}) {
    const {
      baseURL = "http://localhost:3001",
      token,
      credentials,
      timeout,
      maxRetries,
      fetch: customFetch,
      headers,
    } = options;

    super({
      baseURL,
      token,
      credentials,
      timeout,
      maxRetries,
      fetch: customFetch,
      headers,
    });

    this.demo = new DemoResource(this);
    this.health = new HealthResource(this);
  }
}

export default Sdk;
