import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useThemeColor } from "heroui-native/hooks";
import React, { useEffect, useMemo } from "react";
import { Text, View } from "react-native";

import {
  AUTH_APP_ROUTE,
  AUTH_ONBOARDING_ROUTE,
  resolveActiveBusiness,
  useAuthSessionState,
} from "@/lib/auth-session";
import { CounterCartProvider } from "@/lib/counter-cart/counter-cart";
import { OfflineExecutorProvider } from "@/lib/data/offline/offline-executor-provider";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";

type IconName = keyof typeof Ionicons.glyphMap;

/** 
 * Tab bar icons must not be new function references every render — React Navigation
 * merges options into state and unstable references can cause a maximum update depth loop.
 * Per-screen options are memoized with [] because `color` comes from the navigator.
 */
function tabScreenOptions(
  title: string,
  filled: IconName,
  outline: IconName,
) {
  return {
    title,
    tabBarIcon: ({
      color,
      focused,
    }: {
      color: string;
      focused: boolean;
    }) => (
      <Ionicons name={focused ? filled : outline} size={24} color={color} />
    ),
  };
}

export default function TabsLayout() {
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");
  const backgroundColor = useThemeColor("background");
  const { session, user, needsOnboarding, handoffRoute, refetch } =
    useAuthSessionState();
  const businessesQuery = useBusinessesQuery(Boolean(user));
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );

  useEffect(() => {
    if (handoffRoute === AUTH_APP_ROUTE && !user) {
      void refetch();
    }
  }, [handoffRoute, refetch, user]);

  const reportsOptions = useMemo(
    () => tabScreenOptions("Reports", "bar-chart", "bar-chart-outline"),
    [],
  );
  const todayOptions = useMemo(
    () => tabScreenOptions("Today", "calendar", "calendar-outline"),
    [],
  );
  const counterOptions = useMemo(
    () => tabScreenOptions("Counter", "storefront", "storefront-outline"),
    [],
  );
  const itemsOptions = useMemo(
    () => tabScreenOptions("Items", "cube", "cube-outline"),
    [],
  );

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: accentColor,
      tabBarInactiveTintColor: mutedColor,
      tabBarStyle: {
        backgroundColor,
        borderTopColor: "rgba(0,0,0,0.06)",
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: "600" as const,
      },
    }),
    [accentColor, mutedColor, backgroundColor],
  );

  if (needsOnboarding) {
    return <Redirect href={AUTH_ONBOARDING_ROUTE} />;
  }

  if (handoffRoute === AUTH_APP_ROUTE && !user) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-[15px] text-muted">Loading…</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <OfflineExecutorProvider businessId={currentBusiness?.id}>
      <CounterCartProvider>
        <Tabs initialRouteName="today" screenOptions={screenOptions}>
          <Tabs.Screen name="reports" options={reportsOptions} />
          <Tabs.Screen name="today" options={todayOptions} />
          <Tabs.Screen name="counter" options={counterOptions} />
          <Tabs.Screen name="items" options={itemsOptions} />
        </Tabs>
      </CounterCartProvider>
    </OfflineExecutorProvider>
  );
}
