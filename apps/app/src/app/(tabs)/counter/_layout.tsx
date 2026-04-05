import { Stack } from "expo-router";
import React from "react";

import { CounterCheckoutProvider } from "@/lib/counter-checkout/counter-checkout-context";

export default function CounterStackLayout() {
  return (
    <CounterCheckoutProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "transparent",
            flex: 1,
          },
        }}
      />
    </CounterCheckoutProvider>
  );
}
