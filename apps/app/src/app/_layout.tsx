import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native/provider";
import { View } from "react-native";

import { BrandedLoading } from "@/components/desktech-ui";
import { AppQueryProvider } from "@/lib/query-provider";
import { useAuthSessionState } from "@/lib/auth-session";

function AuthBootScreen() {
  return (
    <View className="flex-1 bg-background">
      <StatusBar style="inverted" />
      <BrandedLoading />
    </View>
  );
}

function AppNavigator() {
  const { isPending, needsOnboarding, user } = useAuthSessionState();

  if (isPending) {
    return <AuthBootScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        statusBarStyle: "dark",
      }}
    >
      <Stack.Screen name="index" />

      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(user && needsOnboarding)}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(user && !needsOnboarding)}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="receipt/sale" />
      </Stack.Protected>
    </Stack>
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
