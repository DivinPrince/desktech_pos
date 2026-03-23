import { bus } from "./bus";
import { mediaBucket } from "./bucket";
import { domain } from "./dns";
import { neonDatabase } from "./neon";
import { allSecrets, secret } from "./secret";

const apiDomain = "api." + domain;
const publicApiUrl = "https://" + apiDomain;

export const urls = new sst.Linkable("Urls", {
  properties: {
    api: publicApiUrl,
    auth: `${publicApiUrl}/api/auth`,
    openapi: `${publicApiUrl}/api/doc`,
    site: secret.FrontendUrl.value,
  },
});

const apiFn = new sst.aws.Function("ApiFn", {
  handler: "./packages/core/src/functions/index.handler",
  streaming: !$dev,
  link: [bus, mediaBucket, neonDatabase, urls, ...allSecrets],
  url: {
    cors: false,
  },
  environment: {
    API_URL: publicApiUrl,
    BETTER_AUTH_URL: publicApiUrl,
    FRONTEND_URL: secret.FrontendUrl.value,
    BETTER_AUTH_SECRET: secret.BetterAuthSecret.value,
    S3_BUCKET_NAME: mediaBucket.name,
  },
});

export const api = new sst.aws.Router("Api", {
  routes: {
    "/*": apiFn.url,
  },
  domain: {
    name: apiDomain,
    dns: sst.cloudflare.dns(),
  },
});

export const outputs = {
  apiUrl: publicApiUrl,
  apiDomain,
  api: api.url,
  apiFunction: apiFn.url,
};
