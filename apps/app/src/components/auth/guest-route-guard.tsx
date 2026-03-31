import { Redirect } from "expo-router";
import React from "react";

import {
  getPendingAuthRoute,
  postAuthRoute,
  useAuthSessionState,
} from "@/lib/auth-session";

type GuestRouteGuardProps = {
  children: React.ReactNode;
};

export function GuestRouteGuard({ children }: GuestRouteGuardProps) {
  const { session } = useAuthSessionState();

  const dest = postAuthRoute(session) ?? getPendingAuthRoute();
  if (dest) {
    return <Redirect href={dest} />;
  }

  return <>{children}</>;
}
