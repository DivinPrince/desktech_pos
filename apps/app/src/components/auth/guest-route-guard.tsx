import { Redirect } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { postAuthRoute } from "@/lib/auth-session";

type GuestRouteGuardProps = {
  children: React.ReactNode;
};

export function GuestRouteGuard({ children }: GuestRouteGuardProps) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-[15px] text-muted">Loading…</Text>
      </View>
    );
  }

  const dest = postAuthRoute(session);
  if (dest) {
    return <Redirect href={dest} />;
  }

  return <>{children}</>;
}
