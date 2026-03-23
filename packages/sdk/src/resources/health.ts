import { APIResource, type APIClient } from "../core";

export type ApiMeta = {
  name: string;
  status: string;
  routes: string[];
};

export class HealthResource extends APIResource {
  constructor(client: APIClient) {
    super(client);
  }

  get() {
    return this._client.get<ApiMeta>("/api");
  }
}
