import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import {
  SafeAreaView,
} from "react-native-safe-area-context";

import { CounterSaleCard } from "@/components/counter-sale-card";
import { TabScreenHeader } from "@/components/desktech-ui/tab-screen-header";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import type { CounterSaleRow } from "@/lib/data/sales/types";
import {
  hydrateSaleReceiptExtras,
} from "@/lib/data/sales/receipt-extras";
import { useOfflineExecutor } from "@/lib/data/offline/offline-executor-provider";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { fetchDeviceAppearsOnline } from "@/lib/network/fetch-device-online";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";
import { useSalesTodayQuery } from "@/lib/queries/business-sales";

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 0, paddingTop: 16 },
});

function firstNameFromDisplay(displayName: string): string {
  const part = displayName.split(/\s+/)[0];
  return part && part.length > 0 ? part : displayName;
}

function SectionHeader({
  icon,
  title,
  mutedColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  mutedColor: string;
}) {
  return (
    <View className="mb-4 flex-row items-center gap-2 px-4">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-surface border border-border/40">
        <Ionicons name={icon} size={16} color={mutedColor} />
      </View>
      <Text className="text-[18px] font-black tracking-tight text-foreground">{title}</Text>
    </View>
  );
}

function EmptyHint({
  icon,
  title,
  subtitle,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <View className="mx-4 mt-2 rounded-[32px] border border-border/70 bg-surface px-6 py-10 shadow-sm">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-accent/18">
        <Ionicons name={icon} size={30} color={accent} />
      </View>
      <Text className="text-[20px] font-black tracking-tight text-foreground">{title}</Text>
      <Text className="mt-2 text-[15px] leading-6 text-muted">
        {subtitle}
      </Text>
    </View>
  );
}

export default function TodayTab() {
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");

  const { session, user } = useAuthSessionState();
  const displayName =
    typeof user?.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : user?.email ?? "there";
  const shortName = firstNameFromDisplay(displayName);

  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const businessId = currentBusiness?.id;
  const businessCurrency = currentBusiness?.currency ?? "USD";

  const businessName = currentBusiness?.name?.trim() ?? "";

  const { data: rows, refetch } = useSalesTodayQuery(signedIn ? businessId : undefined, signedIn, {
    currency: businessCurrency,
    businessName: currentBusiness?.name,
  });
  const listRows = useMemo(() => rows ?? [], [rows]);
  const offlineExecutor = useOfflineExecutor();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        await hydrateSaleReceiptExtras();
        const online = await fetchDeviceAppearsOnline();
        if (cancelled) return;
        if (online && offlineExecutor) {
          try {
            offlineExecutor.getOnlineDetector().notifyOnline();
          } catch {
            /* detector best-effort — flushes outbox when NetInfo was stale */
          }
        }
        if (cancelled) return;
        await refetch();
      })();
      return () => {
        cancelled = true;
      };
    }, [refetch, offlineExecutor]),
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    let sum = 0;
    for (const r of listRows) {
      sum += r.receipt.totalCents;
    }
    return sum;
  }, [listRows]);

  const dateLine = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const renderItem: ListRenderItem<CounterSaleRow> = useCallback(
    ({ item }) => (
      <View className="px-4 mb-3">
        <CounterSaleCard
          item={item}
          expanded={expandedIds.has(item.id)}
          onToggle={() => toggleExpanded(item.id)}
          businessCurrency={businessCurrency}
          muted={muted}
        />
      </View>
    ),
    [businessCurrency, expandedIds, muted, toggleExpanded],
  );

  const headerSubtitle = useMemo(() => {
    if (!signedIn) return "Sign in to see today’s activity";
    if (businessesQuery.isError) return "Could not load workspace";
    if (!businessId) return "Finish setup to track sales";
    if (businessName.length > 0) return businessName;
    return `Hi, ${shortName}`;
  }, [
    businessesQuery.isError,
    businessId,
    businessName,
    shortName,
    signedIn,
  ]);

  const headerTertiary = useMemo(() => {
    if (!signedIn || !businessId) return null;
    return `${dateLine} · ${shortName}`;
  }, [businessId, dateLine, shortName, signedIn]);

  const listHeader = useMemo(() => {
    if (!signedIn) {
      return (
        <EmptyHint 
          icon="log-in-outline" 
          title="You’re signed out" 
          subtitle="Sign in from the menu to see today’s sales and activity."
          accent={accent} 
        />
      );
    }
    if (businessesQuery.isError) {
      return (
        <EmptyHint 
          icon="cloud-offline-outline" 
          title="Couldn’t load workspace" 
          subtitle="Check your connection and try again from the side menu."
          accent={accent} 
        />
      );
    }
    if (!businessId) {
      return (
        <EmptyHint 
          icon="storefront-outline" 
          title="Finish setup" 
          subtitle="Create or select a business to track your daily sales."
          accent={accent} 
        />
      );
    }

    return (
      <View className="mb-2">
        {/* Hero Section */}
        <View
          className="mx-4 mb-8 overflow-hidden rounded-[36px] p-6 shadow-sm"
          style={{ backgroundColor: accent }}
        >
          <View className="flex-row items-start justify-between">
            <View>
              <Text
                style={{ color: accentFg, opacity: 0.8 }}
                className="mb-1 text-[13px] font-bold uppercase tracking-widest"
              >
                Today&apos;s Revenue
              </Text>
              <Text
                style={{ color: accentFg }}
                className="text-[44px] font-black leading-[52px] tracking-tighter"
              >
                {formatMinorUnitsToCurrency(totals, businessCurrency)}
              </Text>
              <Text
                style={{ color: accentFg, opacity: 0.9 }}
                className="mt-1 text-[15px] font-semibold"
              >
                {listRows.length} {listRows.length === 1 ? "sale" : "sales"} today
              </Text>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <Ionicons name="today" size={24} color={accentFg} />
            </View>
          </View>
        </View>

        {listRows.length === 0 ? (
          <EmptyHint 
            icon="cart-outline" 
            title="No sales yet today" 
            subtitle="Sales you complete at the counter will appear here."
            accent={accent} 
          />
        ) : (
          <SectionHeader icon="receipt" title="Recent Sales" mutedColor={muted} />
        )}
      </View>
    );
  }, [accent, accentFg, businessId, businessesQuery.isError, listRows.length, signedIn, totals, businessCurrency, muted]);

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="inverted" />
      <TabScreenHeader
        title="Today"
        subtitle={headerSubtitle}
        tertiaryText={headerTertiary}
        subtitleNumberOfLines={2}
        tertiaryNumberOfLines={1}
      />

      <SafeAreaView style={styles.root} edges={["left", "right"]}>
        <FlatList
          style={styles.list}
          data={signedIn && businessId ? listRows : []}
          extraData={{ expanded: expandedIds.size, count: listRows.length }}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(24, 88) }]}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}
