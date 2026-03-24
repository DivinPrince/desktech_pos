import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

import React from "react";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native/provider";

import { AppQueryProvider } from "@/lib/query-provider";

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
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: "transparent",
                flex: 1,
              },
            }}
          />
        </HeroUINativeProvider>
      </AppQueryProvider>
    </GestureHandlerRootView>
  );
}
