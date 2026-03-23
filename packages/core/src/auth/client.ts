import { createAuthClient } from "better-auth/client";
import { adminClient, customSessionClient } from "better-auth/client/plugins";
import { ac, adminRole, userRole } from "./permissions";
import type { auth } from "./index";

export function createClient(baseURL?: string) {
  return createAuthClient({
    baseURL:
      baseURL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
    plugins: [
      adminClient({
        ac,
        roles: {
          admin: adminRole,
          user: userRole,
        },
      }),
      customSessionClient<typeof auth>(),
    ],
  });
}

export const authClient = createClient();

export type AuthClient = typeof authClient;
