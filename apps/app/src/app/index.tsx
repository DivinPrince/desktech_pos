import { Redirect } from "expo-router";
import React from "react";

import { postAuthRoute, useAuthSessionState } from "@/lib/auth-session";

export default function Index() {
  const { session } = useAuthSessionState();

  const authedDest = postAuthRoute(session);
  return <Redirect href={authedDest ?? "/login"} />;
}
