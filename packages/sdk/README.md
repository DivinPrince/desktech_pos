# @repo/sdk

HTTP client for the API in `packages/functions`. Extend `Sdk` with new resource classes under `src/resources/` (see `health.ts`).

```ts
import { Sdk } from "@repo/sdk";

const api = new Sdk({ baseURL: "http://127.0.0.1:3001", credentials: "include" });
const { data } = await api.health.get().withResponse();
```
