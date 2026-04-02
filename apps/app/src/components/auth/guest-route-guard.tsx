import { Redirect } from "expo-router";
import React from "react";

import {
  useAuthSessionState,
} from "@/lib/auth-session";

type GuestRouteGuardProps = {
  children: React.ReactNode;
};

export function GuestRouteGuard({ children }: GuestRouteGuardProps) {
  const { handoffRoute } = useAuthSessionState();

  if (handoffRoute) {
    return <Redirect href={handoffRoute} />;
  }

  return <>{children}</>;
}
