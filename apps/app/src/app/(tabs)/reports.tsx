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
} from "react-native-safe-area-context";

import { CounterSaleCard } from "@/components/counter-sale-card";
import { TabScreenHeader } from "@/components/desktech-ui/tab-screen-header";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { buildSalesReport } from "@/lib/data/sales/build-sales-report";
import {
  reportPeriodBounds,
  reportPeriodLabel,
  type ReportPeriodPreset,
} from "@/lib/data/sales/report-period-bounds";
import type { CounterSaleRow } from "@/lib/data/sales/types";
import { hydrateSaleReceiptExtras } from "@/lib/data/sales/receipt-extras";
import { useOfflineExecutor } from "@/lib/data/offline/offline-executor-provider";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { fetchDeviceAppearsOnline } from "@/lib/network/fetch-device-online";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";
import { useSalesRangeQuery } from "@/lib/queries/business-sales";

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 0, paddingTop: 16 },
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

  const { data: rows, refetch } = useSalesRangeQuery(
    signedIn ? businessId : undefined,
    signedIn,
    signedIn && businessId ? bounds : null,
    { currency: businessCurrency, businessName: currentBusiness?.name },
  );
  const listRows = useMemo(() => rows ?? [], [rows]);

  const report = useMemo(() => buildSalesReport(listRows), [listRows]);

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
            /* best-effort */
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

  const periodTitle = reportPeriodLabel(periodPreset);

  const headerLines = useMemo(() => {
    if (!signedIn) return { primary: "Sign in to continue", secondary: null as string | null };
    if (businessesQuery.isError) return { primary: "Something went wrong", secondary: null };
    if (!businessId) return { primary: "Set up your shop first", secondary: null };
    if (listRows.length === 0) return { primary: periodTitle, secondary: "No sales yet" };
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
    listRows.length,
    signedIn,
  ]);

  const listHeader = useMemo(() => {
    if (!signedIn) {
      return (
        <EmptyHint 
          icon="log-in-outline" 
          title="You’re signed out" 
          subtitle="Sign in from the menu to view your sales reports and analytics."
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
          subtitle="Create or select a business to see your reports and start selling."
          accent={accent} 
        />
      );
    }

    const topProductsToShow = topProductsExpanded
      ? report.topProducts
      : report.topProducts.slice(0, TOP_PRODUCTS_PREVIEW);

    const revenueForBars = report.totalRevenueCents > 0 ? report.totalRevenueCents : 1;

    return (
      <>
        {listRows.length === 0 ? (
          <View className="mx-4 mt-2 rounded-[36px] border border-border/40 bg-surface px-6 py-12 shadow-sm items-center justify-center">
            <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-accent/10">
              <Ionicons name="bar-chart-outline" size={40} color={accent} />
            </View>
            <Text className="text-[22px] font-black tracking-tight text-foreground text-center mb-2">
              No sales yet
            </Text>
            <Text className="text-[15px] leading-6 text-muted text-center px-4">
              There are no recorded sales for {periodTitle.toLowerCase()}. Try selecting a different time period or check back later.
            </Text>
            
            <View className="mt-8 flex-row items-center bg-black/5 dark:bg-white/5 rounded-full p-1 self-center">
              {PERIOD_PRESETS.map((preset) => {
                const selected = preset === periodPreset;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => {
                      setPeriodPreset(preset);
                      setTopProductsExpanded(false);
                    }}
                    className={`px-3 py-1.5 rounded-full ${selected ? "bg-surface shadow-sm" : ""}`}
                  >
                    <Text
                      style={{ color: selected ? accent : muted }}
                      className={`text-[13px] font-bold ${selected ? "" : "opacity-80"}`}
                    >
                      {reportPeriodLabel(preset)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <>
            {/* Hero Section */}
            <View
              className="mx-4 mb-8 overflow-hidden rounded-[36px] p-6 shadow-sm relative"
              style={{ backgroundColor: accent }}
            >
              {/* Background Pattern */}
              <View className="absolute inset-0 overflow-hidden pointer-events-none">
                <View className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
                <View className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-white/10" />
                <View className="absolute top-1/2 left-1/2 w-48 h-48 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white/5 rounded-3xl" />
              </View>

              <View className="relative z-10">
                {/* Inline Period Selector */}
                <View className="flex-row items-center bg-black/10 rounded-full p-1 mb-6 self-start">
                  {PERIOD_PRESETS.map((preset) => {
                    const selected = preset === periodPreset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => {
                          setPeriodPreset(preset);
                          setTopProductsExpanded(false);
                        }}
                        className={`px-3 py-1.5 rounded-full ${selected ? "bg-white shadow-sm" : ""}`}
                      >
                        <Text
                          style={{ color: selected ? accent : accentFg }}
                          className={`text-[13px] font-bold ${selected ? "" : "opacity-80"}`}
                        >
                          {reportPeriodLabel(preset)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View className="flex-row items-start justify-between">
                  <View>
                    <Text
                      style={{ color: accentFg, opacity: 0.8 }}
                      className="mb-1 text-[13px] font-bold uppercase tracking-widest"
                    >
                      {periodTitle} Revenue
                    </Text>
                    <Text
                      style={{ color: accentFg }}
                      className="text-[44px] font-black leading-[52px] tracking-tighter"
                    >
                      {formatMinorUnitsToCurrency(report.totalRevenueCents, businessCurrency)}
                    </Text>
                    <Text
                      style={{ color: accentFg, opacity: 0.9 }}
                      className="mt-1 text-[15px] font-semibold"
                    >
                      {report.saleCount} {report.saleCount === 1 ? "sale" : "sales"}
                    </Text>
                  </View>
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <Ionicons name="bar-chart" size={24} color={accentFg} />
                  </View>
                </View>

                <View className="mt-8 flex-row items-center justify-between rounded-[24px] bg-black/10 px-5 py-4">
                  <View>
                    <Text style={{ color: accentFg, opacity: 0.8 }} className="text-[12px] font-bold uppercase tracking-widest">
                      Avg Ticket
                    </Text>
                    <Text style={{ color: accentFg }} className="mt-0.5 text-[20px] font-black tracking-tight">
                      {report.saleCount > 0
                        ? formatMinorUnitsToCurrency(report.averageTicketCents, businessCurrency)
                        : "—"}
                    </Text>
                  </View>
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Ionicons name="receipt" size={18} color={accentFg} />
                  </View>
                </View>
              </View>
            </View>

            {report.byPaymentMethod.length > 0 ? (
              <View className="mb-8">
                <SectionHeader icon="wallet" title="Payments" mutedColor={muted} />
                <View className="mx-4 overflow-hidden rounded-[32px] border border-border/40 bg-surface">
                  {report.byPaymentMethod.map((p, idx) => {
                    const pct = Math.min(100, Math.round((p.totalCents / revenueForBars) * 100));
                    const isLast = idx === report.byPaymentMethod.length - 1;
                    return (
                      <View
                        key={String(p.paymentMethodKey)}
                        className={`px-5 py-4 ${isLast ? "" : "border-b border-border/40"}`}
                      >
                        <View className="mb-3 flex-row items-baseline justify-between gap-2">
                          <Text className="min-w-0 flex-1 text-[16px] font-bold tracking-tight text-foreground" numberOfLines={1}>
                            {p.paymentMethodLabel}
                          </Text>
                          <Text className="text-[16px] font-black tabular-nums tracking-tight text-foreground">
                            {formatMinorUnitsToCurrency(p.totalCents, businessCurrency)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <View className="h-2 flex-1 overflow-hidden rounded-full bg-muted/20">
                            <View
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: accent }}
                            />
                          </View>
                          <Text className="text-[13px] font-bold text-muted">
                            {p.count}×
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {report.topProducts.length > 0 ? (
              <View className="mb-8">
                <SectionHeader icon="ribbon" title="Best Sellers" mutedColor={muted} />
                <View className="mx-4 overflow-hidden rounded-[32px] border border-border/40 bg-surface">
                  {topProductsToShow.map((p, idx) => {
                    const isLast = idx === topProductsToShow.length - 1;
                    return (
                      <View
                        key={p.productId}
                        className={`flex-row items-center gap-4 px-5 py-4 ${isLast ? "" : "border-b border-border/40"}`}
                      >
                        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent/10">
                          <Text className="text-[15px] font-black text-accent">{idx + 1}</Text>
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-[16px] font-bold tracking-tight text-foreground" numberOfLines={2}>
                            {p.name || p.productId}
                          </Text>
                          <Text className="mt-0.5 text-[13px] font-medium text-muted">{p.unitsSold} sold</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-[16px] font-black tabular-nums tracking-tight text-foreground">
                            {formatMinorUnitsToCurrency(p.lineTotalCents, businessCurrency)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {report.topProducts.length > TOP_PRODUCTS_PREVIEW ? (
                    <Pressable
                      onPress={() => setTopProductsExpanded((v) => !v)}
                      className="border-t border-border/40 bg-muted/5 py-4 active:bg-muted/10"
                    >
                      <Text className="text-center text-[14px] font-bold tracking-tight text-accent">
                        {topProductsExpanded ? "Show less" : `See all ${report.topProducts.length}`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            {report.byDay.length > 1 ? (
              <View className="mb-8">
                <SectionHeader icon="calendar" title="Daily Breakdown" mutedColor={muted} />
                <View className="mx-4 overflow-hidden rounded-[32px] border border-border/40 bg-surface">
                  {[...report.byDay].reverse().map((d, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    return (
                      <View
                        key={d.dayKey}
                        className={`flex-row items-center justify-between gap-3 px-5 py-4 ${isLast ? "" : "border-b border-border/40"}`}
                      >
                        <View>
                          <Text className="text-[16px] font-bold tracking-tight text-foreground">
                            {formatDayKeyForLocale(d.dayKey)}
                          </Text>
                          <Text className="mt-0.5 text-[13px] font-medium text-muted">
                            {d.saleCount} sale{d.saleCount === 1 ? "" : "s"}
                          </Text>
                        </View>
                        <Text className="text-[16px] font-black tabular-nums tracking-tight text-foreground">
                          {formatMinorUnitsToCurrency(d.totalCents, businessCurrency)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View className="mb-2 mt-2">
              <SectionHeader icon="receipt" title="Recent Sales" mutedColor={muted} />
            </View>
          </>
        )}
      </>
    );
  }, [
    accent,
    accentFg,
    businessesQuery.isError,
    businessId,
    muted,
    periodPreset,
    periodTitle,
    report,
    listRows.length,
    signedIn,
    topProductsExpanded,
    businessCurrency,
  ]);

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

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="inverted" />
      <TabScreenHeader
        title="Reports"
        subtitle={headerLines.primary}
        tertiaryText={headerLines.secondary}
        subtitleNumberOfLines={1}
      />

      <SafeAreaView style={styles.root} edges={["left", "right"]}>
        <FlatList
          style={styles.list}
          data={signedIn && businessId ? listRows : []}
          extraData={{
            expanded: expandedIds.size,
            period: periodPreset,
            topEx: topProductsExpanded,
            rowCount: listRows.length,
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
