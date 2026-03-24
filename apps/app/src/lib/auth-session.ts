import type { Href } from "expo-router";

export type SessionPayload = {
  user?: { name?: string | null; email?: string | null };
  onboardingRedirect?: boolean;
};

export function sessionNeedsOnboarding(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as SessionPayload).onboardingRedirect === true
  );
}

const ONBOARDING_SESSION_POLL_MAX_MS = 25_000;
const ONBOARDING_SESSION_POLL_INTERVAL_MS = 450;

/**
 * After the server marks onboarding complete, the session cookie may still
 * carry `onboardingRedirect` until the next get-session. Poll until it clears
 * or `maxMs` elapses.
 */
export async function waitForOnboardingSessionClear(
  getSession: () => Promise<{ data: unknown; error: unknown }>,
  options?: { maxMs?: number; intervalMs?: number },
): Promise<boolean> {
  const maxMs = options?.maxMs ?? ONBOARDING_SESSION_POLL_MAX_MS;
  const intervalMs = options?.intervalMs ?? ONBOARDING_SESSION_POLL_INTERVAL_MS;
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const res = await getSession();
    if (res && typeof res === "object" && "error" in res && res.error) {
      return false;
    }
    const data =
      res && typeof res === "object" && "data" in res
        ? (res as { data: unknown }).data
        : undefined;
    if (data != null && !sessionNeedsOnboarding(data)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const last = await getSession();
  if (last && typeof last === "object" && "error" in last && last.error) {
    return false;
  }
  const data =
    last && typeof last === "object" && "data" in last
      ? (last as { data: unknown }).data
      : undefined;
  return data != null && !sessionNeedsOnboarding(data);
}

/**
 * If the user is authenticated (session or onboarding flow), where they should be
 * sent. `null` means treat as signed out (guest routes may render).
 */
export function postAuthRoute(session: unknown): Href | null {
  if (sessionNeedsOnboarding(session)) {
    return "/onboarding";
  }
  const user = (session as SessionPayload | null | undefined)?.user;
  if (user) {
    return "/(tabs)/today";
  }
  return null;
}
