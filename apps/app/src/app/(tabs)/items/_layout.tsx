import { Stack } from "expo-router";
import React from "react";

export default function ItemsStackLayout() {
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
