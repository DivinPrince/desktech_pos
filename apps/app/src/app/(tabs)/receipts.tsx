import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ReceiptsSaleRow } from "@/components/receipts-sale-row";
import { NavigationMenuTrigger } from "@/components/navigation/navigation-shell";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { useLocalSalesRange } from "@/lib/data/local-counter-sales/hooks";
import {
  reportPeriodBounds,
  reportPeriodLabel,
  type ReportPeriodPreset,
} from "@/lib/data/local-counter-sales/report-period-bounds";
import type { LocalCounterSaleRow } from "@/lib/data/local-counter-sales/types";
import { useOfflineExecutor } from "@/lib/data/offline/offline-executor-provider";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { fetchDeviceAppearsOnline } from "@/lib/network/fetch-device-online";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  chipScroll: { flexGrow: 0 },
});

const PERIOD_PRESETS: ReportPeriodPreset[] = ["today", "last7", "month", "all"];

function EmptyHint({
  icon,
  title,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  accent: string;
}) {
  return (
    <View className="mt-6 items-center px-1">
      <View className="w-full min-h-[120] items-center justify-center rounded-2xl border border-border/75 bg-surface px-5 py-8">
        <View className="mb-3 h-[52px] w-[52px] items-center justify-center rounded-full bg-accent/18">
          <Ionicons name={icon} size={28} color={accent} />
        </View>
        <Text className="text-center text-[16px] font-semibold text-foreground">{title}</Text>
      </View>
    </View>
  );
}

export default function ReceiptsTab() {
  const insets = useSafeAreaInsets();
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const businessId = currentBusiness?.id;
  const businessCurrency = currentBusiness?.currency ?? "USD";

  const [periodPreset, setPeriodPreset] = useState<ReportPeriodPreset>("last7");
  const bounds = useMemo(
    () => reportPeriodBounds(periodPreset, new Date()),
    [periodPreset],
  );

  const { rows, refresh } = useLocalSalesRange(
    signedIn ? businessId : undefined,
    signedIn && businessId ? bounds : null,
  );

  const offlineExecutor = useOfflineExecutor();

  useFocusEffect(
    useCallback(() => {
      refresh();
      let cancelled = false;
      void (async () => {
        const online = await fetchDeviceAppearsOnline();
        if (cancelled || !online || !offlineExecutor) return;
        try {
          offlineExecutor.getOnlineDetector().notifyOnline();
        } catch {
          /* detector best-effort */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [refresh, offlineExecutor]),
  );

  const totals = useMemo(() => {
    let sum = 0;
    for (const r of rows) {
      sum += r.receipt.totalCents;
    }
    return sum;
  }, [rows]);

  const periodTitle = reportPeriodLabel(periodPreset);

  const headerSubtitle = useMemo(() => {
    if (!signedIn) return "Sign in to view receipts";
    if (businessesQuery.isError) return "Could not load workspace";
    if (!businessId) return "Finish setup to track sales";
    if (rows.length === 0) {
      return periodTitle;
    }
    return `${periodTitle} · ${rows.length} ${rows.length === 1 ? "receipt" : "receipts"} · ${formatMinorUnitsToCurrency(totals, businessCurrency)}`;
  }, [
    businessCurrency,
    businessesQuery.isError,
    businessId,
    periodTitle,
    rows.length,
    signedIn,
    totals,
  ]);

  const listHeader = useMemo(() => {
    if (!signedIn) {
      return <EmptyHint icon="log-in-outline" title="Sign in to view receipts" accent={accent} />;
    }
    if (businessesQuery.isError) {
      return (
        <EmptyHint icon="cloud-offline-outline" title="Couldn’t load your business" accent={accent} />
      );
    }
    if (!businessId) {
      return <EmptyHint icon="storefront-outline" title="Finish setup to track sales" accent={accent} />;
    }

    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {PERIOD_PRESETS.map((preset) => {
            const selected = preset === periodPreset;
            return (
              <Pressable
                key={preset}
                onPress={() => setPeriodPreset(preset)}
                className={`rounded-full px-4 py-2.5 active:opacity-88 ${
                  selected ? "bg-accent" : "border border-border/70 bg-surface"
                }`}
              >
                <Text
                  className={`text-[14px] font-semibold ${selected ? "text-accent-foreground" : "text-foreground"}`}
                >
                  {reportPeriodLabel(preset)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {rows.length === 0 ? (
          <EmptyHint icon="receipt-outline" title="No receipts in this period" accent={accent} />
        ) : null}
      </>
    );
  }, [accent, businessId, businessesQuery.isError, periodPreset, rows.length, signedIn]);

  const renderItem: ListRenderItem<LocalCounterSaleRow> = useCallback(
    ({ item }) => (
      <ReceiptsSaleRow item={item} businessCurrency={businessCurrency} muted={muted} />
    ),
    [businessCurrency, muted],
  );

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="inverted" />
      <View
        style={{
          backgroundColor: accent,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 14,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <NavigationMenuTrigger iconColor={accentFg} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: accentFg, fontSize: 22, fontWeight: "700" }}>Receipts</Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 14,
                marginTop: 4,
              }}
              numberOfLines={2}
            >
              {headerSubtitle}
            </Text>
          </View>
        </View>
      </View>

      <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
        <FlatList
          style={styles.list}
          data={signedIn && businessId ? rows : []}
          extraData={{ count: rows.length, period: periodPreset }}
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
