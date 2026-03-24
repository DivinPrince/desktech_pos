import { Redirect } from "expo-router";
import { useThemeColor } from "heroui-native/hooks";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { postAuthRoute } from "@/lib/auth-session";

type GuestRouteGuardProps = {
  children: React.ReactNode;
};

export function GuestRouteGuard({ children }: GuestRouteGuardProps) {
  const accentColor = useThemeColor("accent");
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  const dest = postAuthRoute(session);
  if (dest) {
    return <Redirect href={dest} />;
  }

  return <>{children}</>;
}
