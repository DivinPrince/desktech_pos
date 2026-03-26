import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { postAuthRoute } from "@/lib/auth-session";

export default function Index() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <StatusBar style="dark" />
        <Text className="text-center text-[15px] text-muted">Loading…</Text>
      </View>
    );
  }

  const authedDest = postAuthRoute(session);
  if (authedDest === "/onboarding") {
    return <Redirect href="/onboarding" />;
  }
  if (authedDest === null) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={authedDest} />;
}
