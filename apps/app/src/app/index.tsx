import { Redirect } from "expo-router";
import React from "react";

import { useAuthSessionState } from "@/lib/auth-session";

export default function Index() {
  const { handoffRoute } = useAuthSessionState();

  return <Redirect href={handoffRoute ?? "/login"} />;
}
