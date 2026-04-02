import type { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import { onboardingClient } from "@better-auth-extended/onboarding/client";
import * as SecureStore from "expo-secure-store";
import type { auth } from "@repo/core/auth";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

/** better-auth/react does not merge plugin methods into its public type; onboarding exists at runtime. */
type OnboardingApi = {
  onboarding: {
    shouldOnboard: () => Promise<{
      data?: boolean;
      error?: { message?: string } | null;
    }>;
    step: {
      firstBusiness: (body: {
        name: string;
        timezone?: string;
        currency?: string;
      }) => Promise<{
        data?: unknown;
        error?: { message?: string } | null;
      }>;
    };
  };
};

type PasswordResetApi = {
  forgetPassword: (body: {
    email: string;
    redirectTo: string;
  }) => Promise<{
    data?: unknown;
    error?: { message?: string } | null;
  }>;
};

const baseClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: "desktech",
      storagePrefix: "desktech",
      storage: SecureStore,
    }),
    onboardingClient({
      // Do not navigate here: this runs on every get-session success while
      // onboarding is pending, which remounts /onboarding and traps the user
      // on "Loading setup…". Expo Router redirects are handled by index + guest guard.
      onOnboardingRedirect: () => {},
    }) as unknown as BetterAuthClientPlugin,
    customSessionClient<typeof auth>(),
  ],
});

export const authClient = baseClient as typeof baseClient &
  OnboardingApi &
  PasswordResetApi;
