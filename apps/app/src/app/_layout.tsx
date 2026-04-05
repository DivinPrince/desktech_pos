import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

import React, { useEffect } from "react";
import { SplashScreen, Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native/provider";
import { ActivityIndicator, Platform, View } from "react-native";

import { AppQueryProvider } from "@/lib/query-provider";
import { useAuthSessionState } from "@/lib/auth-session";

void SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { isPending, needsOnboarding, user } = useAuthSessionState();

  useEffect(() => {
    if (!isPending) {
      void SplashScreen.hideAsync();
    }
  }, [isPending]);

  if (isPending) {
    if (Platform.OS !== "web") {
      return null;
    }

    return (
      <View className="flex-1 flex items-center justify-center">
        <ActivityIndicator />
      </View>
    );
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
