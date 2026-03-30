import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native/provider";
import { Text, View } from "react-native";

import { AppQueryProvider } from "@/lib/query-provider";
import { useAuthSessionState } from "@/lib/auth-session";

function AuthBootScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <StatusBar style="inverted" />
      <Text className="text-center text-[15px] text-muted">Loading…</Text>
    </View>
  );
}

function AppNavigator() {
  const { isPending } = useAuthSessionState();

  if (isPending) {
    return <AuthBootScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: "transparent",
          flex: 1,
        },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppQueryProvider>
        <HeroUINativeProvider
          config={{
            toast: {
              defaultProps: {
                placement: "bottom",
              },
            },
          }}
        >
          <AppNavigator />
        </HeroUINativeProvider>
      </AppQueryProvider>
    </GestureHandlerRootView>
  );
}
