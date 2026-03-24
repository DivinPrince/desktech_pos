import type { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { onboardingClient } from "@better-auth-extended/onboarding/client";
import * as SecureStore from "expo-secure-store";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: "desktech",
      storagePrefix: "desktech",
      storage: SecureStore,
    }),
    onboardingClient({
      onOnboardingRedirect: () => {
        // Wire with expo-router when onboarding screens exist
      },
    }) as unknown as BetterAuthClientPlugin,
  ],
});
