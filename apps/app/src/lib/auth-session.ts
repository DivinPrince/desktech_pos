import type { BusinessRow } from "@/lib/data/catalog/types";
import type { Href } from "expo-router";

import { authClient } from "./auth-client";

type SessionResult = Awaited<ReturnType<typeof authClient.getSession>>;

export type SessionPayload = NonNullable<SessionResult["data"]>;
export type SessionUser = SessionPayload["user"];
export type SessionActiveBusiness = NonNullable<SessionPayload["activeBusiness"]>;

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

export function useAuthSessionState() {
  const query = authClient.useSession();
  const session = query.data;

  return {
    ...query,
    session,
    user: getSessionUser(session),
    activeBusiness: getSessionActiveBusiness(session),
    needsOnboarding: sessionNeedsOnboarding(session),
  };
}

export function postAuthRoute(
  session: SessionResult["data"] | null | undefined,
): Href | null {
  if (sessionNeedsOnboarding(session)) {
    return "/onboarding";
  }
  if (getSessionUser(session)) {
    return "/(tabs)/dashboard";
  }
  return null;
}
