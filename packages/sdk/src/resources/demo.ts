import type { DemoItemInfo } from "@repo/core/demo";
import { APIResource, type APIClient } from "../core";

type Data<T> = { data: T };

export class DemoResource extends APIResource {
  constructor(client: APIClient) {
    super(client);
  }

  list() {
    return this._client.get<Data<DemoItemInfo[]>>("/api/demo");
  }

  get(id: string) {
    return this._client.get<Data<DemoItemInfo>>(`/api/demo/${id}`);
  }

  create(body: { label: string; body?: string }) {
    return this._client.post<{ label: string; body?: string }, Data<DemoItemInfo>>("/api/demo", {
      body,
    });
  }

  remove(id: string) {
    return this._client.delete<{ success: boolean }>(`/api/demo/${id}`);
  }
}
