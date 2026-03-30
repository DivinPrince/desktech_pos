import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
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

import { LocalCounterSaleCard, isPendingSyncSaleId } from "@/components/local-counter-sale-card";
import { NavigationMenuTrigger } from "@/components/navigation/navigation-shell";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { buildLocalSalesReport } from "@/lib/data/local-counter-sales/build-local-report";
import { useLocalSalesRange } from "@/lib/data/local-counter-sales/hooks";
import {
  reportPeriodBounds,
  reportPeriodLabel,
  type ReportPeriodPreset,
} from "@/lib/data/local-counter-sales/report-period-bounds";
import type { LocalCounterSaleRow } from "@/lib/data/local-counter-sales/types";
import { useOfflineExecutor } from "@/lib/data/offline/offline-executor-provider";
import { syncPendingSalesToday } from "@/lib/data/local-counter-sales/sync-pending-sales-today";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { fetchDeviceAppearsOnline } from "@/lib/network/fetch-device-online";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 10 },
  chipScroll: { flexGrow: 0 },
});

const PERIOD_PRESETS: ReportPeriodPreset[] = ["today", "last7", "month", "all"];

const TOP_PRODUCTS_PREVIEW = 5;

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
    <View className="mb-2.5 flex-row items-center gap-2">
      <Ionicons name={icon} size={18} color={mutedColor} />
      <Text className="text-[16px] font-bold tracking-tight text-foreground">{title}</Text>
    </View>
  );
}

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
    <View className="mt-5 items-center px-1">
      <View className="w-full min-h-[108] items-center justify-center rounded-2xl border border-border/60 bg-surface px-5 py-7">
        <View className="mb-2.5 h-12 w-12 items-center justify-center rounded-2xl bg-accent/12">
          <Ionicons name={icon} size={26} color={accent} />
        </View>
        <Text className="text-center text-[15px] font-semibold leading-5 text-foreground">{title}</Text>
      </View>
    </View>
  );
}

/** Matches Counter tab cart lines: one fused outline, dividers between rows only (no nested card border clash). */
function mergedGroupRowClassName(opts: {
  index: number;
  count: number;
  extra?: string;
}): string {
  const { index, count, extra = "" } = opts;
  const isOnly = count === 1;
  const isFirst = index === 0;
  const isLast = index === count - 1;
  const edge = "border-border/75";
  const prefix = extra.length > 0 ? `${extra} ` : "";
  if (isOnly) {
    return `${prefix}mb-2 rounded-2xl border ${edge} bg-surface`;
  }
  if (isFirst) {
    return `${prefix}rounded-t-2xl border-b border-l border-r border-t ${edge} bg-surface`;
  }
  if (isLast) {
    return `${prefix}mb-2 rounded-b-2xl border-b border-l border-r ${edge} bg-surface`;
  }
  return `${prefix}border-b border-l border-r ${edge} bg-surface`;
}

function formatDayKeyForLocale(dayKey: string): string {
  const parts = dayKey.split("-").map((p) => Number(p));
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (y === undefined || mo === undefined || d === undefined) return dayKey;
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function ReportsTab() {
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

  const report = useMemo(() => buildLocalSalesReport(rows), [rows]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [topProductsExpanded, setTopProductsExpanded] = useState(false);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const queryClient = useQueryClient();
  const offlineExecutor = useOfflineExecutor();
  const [manualSyncWorking, setManualSyncWorking] = useState(false);

  const hasPendingSync = useMemo(
    () => rows.some((r) => isPendingSyncSaleId(r.id)),
    [rows],
  );

  const onManualRetryServerSync = useCallback(async () => {
    if (!businessId) return;
    setManualSyncWorking(true);
    try {
      const result = await syncPendingSalesToday({
        executor: offlineExecutor,
        businessId,
        queryClient,
      });
      refresh();
      Alert.alert(result.title, result.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Retry failed", msg);
    } finally {
      setManualSyncWorking(false);
    }
  }, [businessId, offlineExecutor, refresh, queryClient]);

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
          /* best-effort */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [refresh, offlineExecutor]),
  );

  const periodTitle = reportPeriodLabel(periodPreset);

  const headerLines = useMemo(() => {
    if (!signedIn) return { primary: "Sign in to continue", secondary: null as string | null };
    if (businessesQuery.isError) return { primary: "Something went wrong", secondary: null };
    if (!businessId) return { primary: "Set up your shop first", secondary: null };
    if (rows.length === 0) return { primary: periodTitle, secondary: "No sales yet" };
    return {
      primary: formatMinorUnitsToCurrency(report.totalRevenueCents, businessCurrency),
      secondary: `${periodTitle} · ${report.saleCount} ${report.saleCount === 1 ? "sale" : "sales"}`,
    };
  }, [
    businessCurrency,
    businessesQuery.isError,
    businessId,
    periodTitle,
    report.saleCount,
    report.totalRevenueCents,
    rows.length,
    signedIn,
  ]);

  const listHeader = useMemo(() => {
    if (!signedIn) {
      return <EmptyHint icon="log-in-outline" title="Sign in to see your numbers" accent={accent} />;
    }
    if (businessesQuery.isError) {
      return (
        <EmptyHint icon="cloud-offline-outline" title="Couldn’t load your shop" accent={accent} />
      );
    }
    if (!businessId) {
      return <EmptyHint icon="storefront-outline" title="Finish setup to track sales" accent={accent} />;
    }

    const topProductsToShow = topProductsExpanded
      ? report.topProducts
      : report.topProducts.slice(0, TOP_PRODUCTS_PREVIEW);

    const revenueForBars = report.totalRevenueCents > 0 ? report.totalRevenueCents : 1;

    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
        >
          {PERIOD_PRESETS.map((preset) => {
            const selected = preset === periodPreset;
            return (
              <Pressable
                key={preset}
                onPress={() => {
                  setPeriodPreset(preset);
                  setTopProductsExpanded(false);
                }}
                className={`rounded-full px-4 py-2.5 active:opacity-88 ${
                  selected ? "bg-accent" : "bg-surface border border-border/70"
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
          <EmptyHint icon="bar-chart-outline" title="Nothing in this time range" accent={accent} />
        ) : (
          <>
            <View className="mb-5 overflow-hidden rounded-2xl bg-surface border border-border/70">
              <View className="px-4 pb-4 pt-5">
                <Text className="text-[28px] font-bold leading-8 tabular-nums tracking-tight text-foreground">
                  {formatMinorUnitsToCurrency(report.totalRevenueCents, businessCurrency)}
                </Text>
              </View>
              <View className="flex-row border-t border-border/60 bg-background/40">
                <View className="min-w-0 flex-1 border-r border-border/50 px-4 py-3.5">
                  <Text className="text-[20px] font-bold tabular-nums text-foreground">
                    {report.saleCount}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-muted">Sales</Text>
                </View>
                <View className="min-w-0 flex-1 px-4 py-3.5">
                  <Text className="text-[20px] font-bold tabular-nums text-foreground">
                    {report.saleCount > 0
                      ? formatMinorUnitsToCurrency(report.averageTicketCents, businessCurrency)
                      : "—"}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-muted">Average per sale</Text>
                </View>
              </View>
            </View>

            {report.byPaymentMethod.length > 0 ? (
              <View className="mb-5">
                <SectionHeader icon="wallet-outline" title="Payments" mutedColor={muted} />
                {report.byPaymentMethod.map((p, idx) => {
                  const pct = Math.min(100, Math.round((p.totalCents / revenueForBars) * 100));
                  const count = report.byPaymentMethod.length;
                  return (
                    <View
                      key={String(p.paymentMethodKey)}
                      className={mergedGroupRowClassName({
                        index: idx,
                        count,
                        extra: "px-3 py-3.5",
                      })}
                    >
                      <View className="mb-2 flex-row items-baseline justify-between gap-2">
                        <Text className="min-w-0 flex-1 text-[15px] font-semibold text-foreground" numberOfLines={1}>
                          {p.paymentMethodLabel}
                        </Text>
                        <Text className="text-[15px] font-bold tabular-nums text-foreground">
                          {formatMinorUnitsToCurrency(p.totalCents, businessCurrency)}
                        </Text>
                      </View>
                      <View className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                        <View
                          className="h-full rounded-full bg-accent/80"
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                      <Text className="mt-1.5 text-[11px] text-muted">
                        {p.count}×
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {report.topProducts.length > 0 ? (
              <View className="mb-5">
                <SectionHeader icon="ribbon-outline" title="Best sellers" mutedColor={muted} />
                {topProductsToShow.map((p, idx) => {
                  const rowCount = topProductsToShow.length;
                  return (
                    <View
                      key={p.productId}
                      className={mergedGroupRowClassName({
                        index: idx,
                        count: rowCount,
                        extra: "flex-row items-center gap-3 px-3 py-3.5",
                      })}
                    >
                      <View className="h-8 w-8 items-center justify-center rounded-lg bg-accent/14">
                        <Text className="text-[13px] font-bold text-accent">{idx + 1}</Text>
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
                          {p.name || p.productId}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[15px] font-bold tabular-nums text-foreground">
                          {formatMinorUnitsToCurrency(p.lineTotalCents, businessCurrency)}
                        </Text>
                        <Text className="text-[11px] text-muted">{p.unitsSold} sold</Text>
                      </View>
                    </View>
                  );
                })}
                {report.topProducts.length > TOP_PRODUCTS_PREVIEW ? (
                  <Pressable
                    onPress={() => setTopProductsExpanded((v) => !v)}
                    className="mt-2 items-center py-2 active:opacity-75"
                  >
                    <Text className="text-[14px] font-semibold text-accent">
                      {topProductsExpanded ? "Show less" : `See all ${report.topProducts.length}`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {report.byDay.length > 1 ? (
              <View className="mb-5">
                <SectionHeader icon="calendar-outline" title="Each day" mutedColor={muted} />
                {[...report.byDay].reverse().map((d, idx, arr) => (
                  <View
                    key={d.dayKey}
                    className={mergedGroupRowClassName({
                      index: idx,
                      count: arr.length,
                      extra: "flex-row items-center justify-between gap-3 px-3 py-3.5",
                    })}
                  >
                    <Text className="text-[15px] font-semibold text-foreground">
                      {formatDayKeyForLocale(d.dayKey)}
                    </Text>
                    <View className="items-end">
                      <Text className="text-[15px] font-bold tabular-nums text-foreground">
                        {formatMinorUnitsToCurrency(d.totalCents, businessCurrency)}
                      </Text>
                      <Text className="text-[11px] text-muted">
                        {d.saleCount} sale{d.saleCount === 1 ? "" : "s"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="mb-1 mt-1 border-t border-border/50 pt-5">
              <SectionHeader icon="receipt-outline" title="Sales" mutedColor={muted} />
            </View>
          </>
        )}
      </>
    );
  }, [
    accent,
    businessesQuery.isError,
    businessId,
    muted,
    periodPreset,
    report,
    rows.length,
    signedIn,
    topProductsExpanded,
    businessCurrency,
  ]);

  const renderItem: ListRenderItem<LocalCounterSaleRow> = useCallback(
    ({ item }) => (
      <LocalCounterSaleCard
        item={item}
        expanded={expandedIds.has(item.id)}
        onToggle={() => toggleExpanded(item.id)}
        businessCurrency={businessCurrency}
        muted={muted}
      />
    ),
    [businessCurrency, expandedIds, muted, toggleExpanded],
  );

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="inverted" />
      <View
        style={{
          backgroundColor: accent,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <NavigationMenuTrigger iconColor={accentFg} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: accentFg, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 }}>
              Reports
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.92)",
                fontSize: 20,
                fontWeight: "700",
                marginTop: 6,
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {headerLines.primary}
            </Text>
            {headerLines.secondary ? (
              <Text
                style={{
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 13,
                  marginTop: 4,
                  fontWeight: "500",
                }}
                numberOfLines={2}
              >
                {headerLines.secondary}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
        {signedIn && businessId && hasPendingSync ? (
          <View className="mx-4 mt-3 rounded-2xl border border-amber-500/35 bg-amber-500/12 px-3.5 py-3.5">
            <View className="flex-row items-start gap-2.5">
              <Ionicons name="cloud-upload-outline" size={22} color="#d97706" />
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-bold text-foreground">Not synced yet</Text>
                <Text className="mt-1 text-[13px] leading-[18px] text-muted">
                  Connect to the internet, then tap below.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => void onManualRetryServerSync()}
              disabled={manualSyncWorking}
              className="mt-3 items-center justify-center rounded-xl bg-amber-600/90 py-3 active:opacity-90 disabled:opacity-50 dark:bg-amber-500/85"
            >
              <Text className="text-[15px] font-bold text-white">
                {manualSyncWorking ? "Working…" : "Sync now"}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <FlatList
          style={styles.list}
          data={signedIn && businessId ? rows : []}
          extraData={{
            expanded: expandedIds.size,
            period: periodPreset,
            topEx: topProductsExpanded,
            rowCount: rows.length,
          }}
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
