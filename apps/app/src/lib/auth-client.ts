import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

const apiUrl = import.meta.env.VITE_API_URL || "";

export const authClient = createAuthClient({
  baseURL: apiUrl,
  plugins: [adminClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
