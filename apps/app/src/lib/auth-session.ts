import type { Href } from "expo-router";

import type { BusinessRow } from "@/lib/data/catalog/types";

import { authClient } from "./auth-client";

type SessionResult = Awaited<ReturnType<typeof authClient.getSession>>;

export type SessionPayload = NonNullable<SessionResult["data"]>;
export type SessionUser = SessionPayload["user"];
export type SessionActiveBusiness = NonNullable<SessionPayload["activeBusiness"]>;
export const AUTH_ONBOARDING_ROUTE = "/onboarding" as const;
export const AUTH_APP_ROUTE = "/(tabs)/today" as const;

export type PostAuthRoute =
  | typeof AUTH_ONBOARDING_ROUTE
  | typeof AUTH_APP_ROUTE;

let pendingAuthRoute: PostAuthRoute | null = null;

export function getSessionUser(
  data: SessionResult["data"] | null | undefined,
): SessionUser | null {
  return data?.user ?? null;
}

export function getSessionActiveBusiness(
  data: SessionResult["data"] | null | undefined,
): SessionActiveBusiness | null {
  return data?.activeBusiness ?? null;
}

export function sessionNeedsOnboarding(
  data: SessionResult["data"] | null | undefined,
): boolean {
  return data?.onboardingRedirect === true;
}

export function resolveSessionAuthRoute(
  session: SessionResult["data"] | null | undefined,
): PostAuthRoute | null {
  if (sessionNeedsOnboarding(session)) {
    return AUTH_ONBOARDING_ROUTE;
  }
  if (getSessionUser(session)) {
    return AUTH_APP_ROUTE;
  }
  return null;
}

export function resolvePostAuthRoute(
  session: SessionResult["data"] | null | undefined,
  shouldOnboard?: boolean | null,
): PostAuthRoute | null {
  if (shouldOnboard === true) {
    return AUTH_ONBOARDING_ROUTE;
  }

  const sessionRoute = resolveSessionAuthRoute(session);
  if (sessionRoute) {
    return sessionRoute;
  }

  if (shouldOnboard === false) {
    return AUTH_APP_ROUTE;
  }

  return null;
}

export function resolveAuthHandoffRoute(
  session: SessionResult["data"] | null | undefined,
): PostAuthRoute | null {
  return resolveSessionAuthRoute(session) ?? pendingAuthRoute;
}

export function resolveActiveBusiness(
  data: SessionResult["data"] | null | undefined,
  businesses?: readonly BusinessRow[] | null,
): SessionActiveBusiness | BusinessRow | null {
  const activeBusiness = getSessionActiveBusiness(data);
  if (activeBusiness) {
    return businesses?.find((business) => business.id === activeBusiness.id) ?? activeBusiness;
  }
  return businesses?.[0] ?? null;
}

export function beginAuthTransition(route: PostAuthRoute) {
  pendingAuthRoute = route;
}

export function clearAuthTransition() {
  pendingAuthRoute = null;
}

export function getPendingAuthRoute(): PostAuthRoute | null {
  return pendingAuthRoute;
}

export async function determineFreshPostAuthRoute(): Promise<{
  route: PostAuthRoute | null;
  session: SessionResult["data"] | null | undefined;
  shouldOnboard: boolean | null | undefined;
}> {
  const [sessionResult, onboardingResult] = await Promise.all([
    authClient.getSession(),
    authClient.onboarding.shouldOnboard().catch(
      () =>
        ({
          data: undefined,
          error: null,
        }) as Awaited<ReturnType<typeof authClient.onboarding.shouldOnboard>>,
    ),
  ]);

  return {
    route: resolvePostAuthRoute(sessionResult.data, onboardingResult.data),
    session: sessionResult.data,
    shouldOnboard: onboardingResult.data,
  };
}

export function useAuthSessionState() {
  const query = authClient.useSession();
  const session = query.data;
  const sessionRoute = resolveSessionAuthRoute(session);
  if (sessionRoute) {
    clearAuthTransition();
  }

  return {
    ...query,
    session,
    user: getSessionUser(session),
    activeBusiness: getSessionActiveBusiness(session),
    needsOnboarding: sessionNeedsOnboarding(session),
    sessionRoute,
    handoffRoute: sessionRoute ?? pendingAuthRoute,
    pendingAuthRoute,
  };
}

export function postAuthRoute(
  session: SessionResult["data"] | null | undefined,
): Href | null {
  return resolveSessionAuthRoute(session);
}
