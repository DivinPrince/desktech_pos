# @repo/env

Shared environment validation for **server** and **frontend** using [t3-env](https://env.t3.gg).

## Quick Start

```ts
import { env } from "@repo/env";

// Server (API, CLI, scripts) – server vars throw if accessed on client
console.log(env.DATABASE_URL);
console.log(env.API_URL);

// Client (Vite, React) – only VITE_* are safe in browser
console.log(env.VITE_API_URL);
```

---

## Server Variables

Use in: API server, CLI tools, database scripts. **Never access on client** – t3-env throws.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `DRIZZLE_LOG` | `false` | Enable Drizzle query logging |
| `DB2_*` | — | Experimental/secondary DB |
| `REDIS_URL`, `REDIS_PORT` | — | Redis |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | — | Better Auth |
| `FRONTEND_URL` | `http://localhost:5000` | Frontend origin (CORS) |
| `ADMIN_URL` | `http://localhost:5002` | Admin app origin |
| `API_URL` | `http://localhost:3000` | API base URL |
| `API_PORT` | `5001` | API server port |
| `RESEND_API_KEY`, `EMAIL_FROM` | — | Email (Resend) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | — | Stripe |
| `PAYMENT_PROVIDER` | `stripe` | `stripe` or `paypal` |
| `AWS_REGION`, `S3_BUCKET_NAME` | — | AWS S3 |
| `GCS_*` | — | Google Cloud Storage |
| `GOOGLE_GENERATIVE_AI_API_KEY`, `FIRECRAWL_API_KEY` | — | AI/integrations |
| `POS_API_URL`, `POS_API_TOKEN` | — | POS API |
| `AXIOM_*`, `OTEL_*` | — | Observability |
| `SEED_*`, `ADMIN_*` | — | CLI/seed overrides |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |

---

## Client Variables

Use in: Vite, React, browser. **Only `VITE_*` are exposed.**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | API base URL for frontend |

> **Security:** Never put secrets in `VITE_*`. They are bundled and visible in the browser.

---

## Setup

1. Copy example: `cp packages/env/.env.example packages/core/.env`
2. For Vite: `cp packages/env/.env.client.example apps/web/.env`
3. Validate on build – import in `vite.config.ts`:

```ts
import "@repo/env";
```
