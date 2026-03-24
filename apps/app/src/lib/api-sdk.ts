import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useMemo } from "react";
import { Platform } from "react-native";

import { Sdk } from "@repo/sdk";

import { authClient } from "./auth-client";

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type AuthClientWithCookie = typeof authClient & {
  getCookie?: () => string;
};

function expoOriginHeader(): string {
  const rawScheme = Constants.expoConfig?.scheme ?? Constants.platform?.scheme;
  const scheme = Array.isArray(rawScheme) ? rawScheme[0] : rawScheme;
  return Linking.createURL("", { scheme: scheme ?? "desktech" });
}

/**
 * Fetch that attaches Better Auth session cookies on native (matches @better-auth/expo).
 */
export function createAuthedFetch(): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (Platform.OS === "web") {
      return globalThis.fetch(input, {
        ...init,
        credentials: "include",
      });
    }

    const headers = new Headers(init?.headers ?? undefined);
    const cookie = (authClient as AuthClientWithCookie).getCookie?.();
    if (cookie) {
      headers.set("Cookie", cookie);
    }
    headers.set("expo-origin", expoOriginHeader());
    headers.set("x-skip-oauth-proxy", "true");

    return globalThis.fetch(url, {
      ...init,
      headers,
      credentials: "omit",
    });
  };
}

let singleton: Sdk | null = null;

export function getApiSdk(): Sdk {
  if (!singleton) {
    singleton = new Sdk({
      baseURL,
      fetch: createAuthedFetch(),
      credentials: Platform.OS === "web" ? "include" : "omit",
    });
  }
  return singleton;
}

/** Same SDK instance as {@link getApiSdk}; memoized for hook usage. */
export function useApiSdk(): Sdk {
  return useMemo(() => getApiSdk(), []);
}
