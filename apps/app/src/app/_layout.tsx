import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

import React from "react";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native/provider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <Stack />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
