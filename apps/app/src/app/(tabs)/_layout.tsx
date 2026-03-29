import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useThemeColor } from "heroui-native/hooks";
import React, { useMemo } from "react";
import { Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { sessionNeedsOnboarding, type SessionPayload } from "@/lib/auth-session";
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
  const { data: session, isPending } = authClient.useSession();
  const user = (session as SessionPayload | null | undefined)?.user;
  const canLoadBusinesses = !isPending && Boolean(user) && !sessionNeedsOnboarding(session);
  const businessesQuery = useBusinessesQuery(canLoadBusinesses);
  const offlineBusinessId = businessesQuery.data?.[0]?.id;

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
  const moreOptions = useMemo(
    () =>
      tabScreenOptions(
        "More",
        "ellipsis-horizontal-circle",
        "ellipsis-horizontal-circle-outline",
      ),
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

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-[15px] text-muted">Loading…</Text>
      </View>
    );
  }

  if (sessionNeedsOnboarding(session)) {
    return <Redirect href="/onboarding" />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <OfflineExecutorProvider businessId={offlineBusinessId}>
      <Tabs initialRouteName="today" screenOptions={screenOptions}>
        <Tabs.Screen name="reports" options={reportsOptions} />
        <Tabs.Screen name="today" options={todayOptions} />
        <Tabs.Screen name="counter" options={counterOptions} />
        <Tabs.Screen name="items" options={itemsOptions} />
        <Tabs.Screen name="more" options={moreOptions} />
      </Tabs>
    </OfflineExecutorProvider>
  );
}
