import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TabScreenHeader } from "@/components/desktech-ui/tab-screen-header";
import { paymentDisplayForKey } from "@/lib/counter-checkout/payment-options";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import type { ProductRow } from "@/lib/data/catalog/types";
import { buildSalesReport } from "@/lib/data/sales/build-sales-report";
import {
  reportPeriodBounds,
} from "@/lib/data/sales/report-period-bounds";
import { hydrateSaleReceiptExtras } from "@/lib/data/sales/receipt-extras";
import type { CounterSaleRow } from "@/lib/data/sales/types";
import { useOfflineExecutor } from "@/lib/data/offline/offline-executor-provider";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { formatSaleCompletedAt } from "@/lib/format-sale-completed-at";
import { fetchDeviceAppearsOnline } from "@/lib/network/fetch-device-online";
import {
  useBusinessesQuery,
  useCategoriesQuery,
  useProductsQuery,
} from "@/lib/queries/business-catalog";
import { useSalesRangeQuery, useSalesTodayQuery } from "@/lib/queries/business-sales";

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 96 },
});

function firstNameFromDisplay(displayName: string): string {
  const part = displayName.split(/\s+/)[0];
  return part && part.length > 0 ? part : displayName;
}

type StockSignals = {
  skuOutOfStock: number;
  skuLowStock: number;
  trackedSkuCount: number;
};

function inventorySignals(products: readonly ProductRow[]): StockSignals {
  let skuOutOfStock = 0;
  let skuLowStock = 0;
  let trackedSkuCount = 0;

  for (const p of products) {
    if (!p.active || !p.trackStock) continue;
    const alertThreshold = Math.max(0, p.stockAlert);
    trackedSkuCount++;
    const q = p.quantityOnHand;
    if (q <= 0) skuOutOfStock++;
    else if (alertThreshold > 0 && q <= alertThreshold) skuLowStock++;
  }

  return { skuOutOfStock, skuLowStock, trackedSkuCount };
}

function QuickAction({
  icon,
  label,
  onPress,
  iconColor,
  surfaceColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  iconColor: string;
  surfaceColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="w-[100px] h-[105px] rounded-[28px] items-center justify-center active:opacity-80"
      style={{ backgroundColor: surfaceColor }}
    >
      <View className="h-11 w-11 rounded-full items-center justify-center mb-2 bg-background/60">
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text className="text-[13px] font-bold text-foreground tracking-tight">{label}</Text>
    </Pressable>
  );
}

function OverviewCard({
  title,
  amount,
  subtitle,
  isNumber,
  currency,
}: {
  title: string;
  amount: number;
  subtitle: string;
  isNumber?: boolean;
  currency?: string;
}) {
  return (
    <View className="w-[48%] bg-surface rounded-[28px] p-5 mb-3 border border-border/40">
      <Text className="text-[12px] font-bold uppercase tracking-widest text-muted mb-2">
        {title}
      </Text>
      <Text className="text-[22px] font-black text-foreground tabular-nums tracking-tight">
        {isNumber ? amount : formatMinorUnitsToCurrency(amount, currency || "USD")}
      </Text>
      <Text className="text-[13px] font-medium text-muted mt-1">{subtitle}</Text>
    </View>
  );
}

function RecentSaleRow({
  sale,
  businessCurrency,
  onPress,
  isLast,
}: {
  sale: CounterSaleRow;
  businessCurrency: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const r = sale.receipt;
  const pay = paymentDisplayForKey(r.paymentMethodKey);
  const timeLabel = formatSaleCompletedAt(r.completedAtIso);
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center py-4 px-4 active:bg-foreground/5 ${
        isLast ? "" : "border-b border-border/40"
      }`}
    >
      <View
        className="h-11 w-11 rounded-full items-center justify-center"
        style={{ backgroundColor: `${pay.iconHex}20` }}
      >
        <Ionicons name={pay.icon} size={20} color={pay.iconHex} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[15px] font-bold text-foreground">{r.paymentMethodLabel}</Text>
        <Text className="text-[13px] font-medium text-muted mt-0.5">{timeLabel}</Text>
      </View>
      <Text className="text-[16px] font-black text-foreground tabular-nums tracking-tight">
        {formatMinorUnitsToCurrency(r.totalCents, r.currency || businessCurrency)}
      </Text>
    </Pressable>
  );
}

export default function DashboardTab() {
  const router = useRouter();
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const foreground = useThemeColor("foreground");
  const surface = useThemeColor("surface");

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);
  const displayName =
    typeof user?.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : user?.email ?? "there";
  const shortName = firstNameFromDisplay(displayName);

  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const businessId = currentBusiness?.id;
  const businessCurrency = currentBusiness?.currency ?? "USD";
  const businessName = currentBusiness?.name?.trim() ?? "";

  const catalogEnabled = Boolean(signedIn && businessId);
  const productsQuery = useProductsQuery(businessId, catalogEnabled, {
    activeOnly: true,
    search: "",
  });
  const categoriesQuery = useCategoriesQuery(businessId, catalogEnabled);

  const weekBounds = useMemo(() => reportPeriodBounds("last7", new Date()), []);
  const monthBounds = useMemo(() => reportPeriodBounds("month", new Date()), []);
  const allBounds = useMemo(() => reportPeriodBounds("all", new Date()), []);

  const salesMeta = useMemo(
    () => ({ currency: businessCurrency, businessName: currentBusiness?.name }),
    [businessCurrency, currentBusiness?.name],
  );

  const {
    data: todayRows,
    refetch: refetchToday,
    isFetching: todayFetching,
  } = useSalesTodayQuery(signedIn ? businessId : undefined, signedIn, salesMeta);
  const todayList = useMemo(() => todayRows ?? [], [todayRows]);
  const todayReport = useMemo(() => buildSalesReport(todayList), [todayList]);

  const {
    data: weekRows,
    refetch: refetchWeek,
    isFetching: weekFetching,
  } = useSalesRangeQuery(
    signedIn ? businessId : undefined,
    signedIn,
    signedIn && businessId ? weekBounds : null,
    salesMeta,
  );
  const weekList = useMemo(() => weekRows ?? [], [weekRows]);
  const weekReport = useMemo(() => buildSalesReport(weekList), [weekList]);

  const {
    data: monthRows,
    refetch: refetchMonth,
    isFetching: monthFetching,
  } = useSalesRangeQuery(
    signedIn ? businessId : undefined,
    signedIn,
    signedIn && businessId ? monthBounds : null,
    salesMeta,
  );
  const monthList = useMemo(() => monthRows ?? [], [monthRows]);
  const monthReport = useMemo(() => buildSalesReport(monthList), [monthList]);

  const {
    data: allRows,
    refetch: refetchAll,
    isFetching: allFetching,
  } = useSalesRangeQuery(
    signedIn ? businessId : undefined,
    signedIn,
    signedIn && businessId ? allBounds : null,
    salesMeta,
  );
  const allList = useMemo(() => allRows ?? [], [allRows]);
  const allReport = useMemo(() => buildSalesReport(allList), [allList]);

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const stockSignals = useMemo(() => inventorySignals(products), [products]);

  const recentSales = useMemo(() => allList.slice(0, 4), [allList]);

  const dataRefreshing =
    todayFetching ||
    weekFetching ||
    monthFetching ||
    allFetching ||
    productsQuery.isFetching ||
    categoriesQuery.isFetching;

  const offlineExecutor = useOfflineExecutor();

  useFocusEffect(
    useCallback(() => {
      void hydrateSaleReceiptExtras();
      void refetchToday();
      void refetchWeek();
      void refetchMonth();
      void refetchAll();
      void productsQuery.refetch();
      void categoriesQuery.refetch();
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
    }, [
      offlineExecutor,
      refetchAll,
      refetchMonth,
      refetchToday,
      refetchWeek,
      categoriesQuery,
      productsQuery,
    ]),
  );

  const dateLine = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const headerSubtitle = useMemo(() => {
    if (!signedIn) return "Sign in to manage your store";
    if (businessesQuery.isError) return "Something went wrong loading your workspace";
    if (!businessId) return "Complete setup to unlock your dashboard";
    if (businessName.length > 0) return businessName;
    return `Hi, ${shortName}`;
  }, [businessId, businessName, businessesQuery.isError, shortName, signedIn]);

  const headerTertiary = useMemo(() => {
    if (!signedIn || !businessId) return null;
    return `${dateLine} · ${shortName}`;
  }, [businessId, dateLine, shortName, signedIn]);

  const stockIssueCount = stockSignals.skuOutOfStock + stockSignals.skuLowStock;

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="inverted" />
      <TabScreenHeader
        title="Dashboard"
        subtitle={headerSubtitle}
        tertiaryText={headerTertiary}
        subtitleNumberOfLines={2}
        tertiaryNumberOfLines={1}
      />

      <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!signedIn ? (
            <View className="mx-4 rounded-[32px] border border-border/70 bg-surface px-6 py-10 shadow-sm">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="log-in-outline" size={30} color={accent} />
              </View>
              <Text className="text-[20px] font-black tracking-tight text-foreground">You’re signed out</Text>
              <Text className="mt-2 text-[15px] leading-6 text-muted">
                Sign in from the menu to see your daily sales, inventory signals, and quick actions.
              </Text>
            </View>
          ) : businessesQuery.isError ? (
            <View className="mx-4 rounded-[32px] border border-border/70 bg-surface px-6 py-10 shadow-sm">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="cloud-offline-outline" size={30} color={accent} />
              </View>
              <Text className="text-[20px] font-black tracking-tight text-foreground">Couldn’t load workspace</Text>
              <Text className="mt-2 text-[15px] leading-6 text-muted">
                Check your connection and try again from the side menu.
              </Text>
            </View>
          ) : !businessId ? (
            <View className="mx-4 rounded-[32px] border border-border/70 bg-surface px-6 py-10 shadow-sm">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="storefront-outline" size={30} color={accent} />
              </View>
              <Text className="text-[20px] font-black tracking-tight text-foreground">Finish setup</Text>
              <Text className="mt-2 text-[15px] leading-6 text-muted">
                Create or select a business to see your dashboard and start selling.
              </Text>
            </View>
          ) : (
            <>
              {dataRefreshing ? (
                <View className="mx-4 mb-4 flex-row items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3">
                  <Ionicons name="sync" size={18} color={accent} />
                  <Text className="flex-1 text-[13px] font-bold text-foreground">
                    Syncing data...
                  </Text>
                </View>
              ) : null}

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
                      {formatMinorUnitsToCurrency(todayReport.totalRevenueCents, businessCurrency)}
                    </Text>
                    <Text
                      style={{ color: accentFg, opacity: 0.9 }}
                      className="mt-1 text-[15px] font-semibold"
                    >
                      {todayReport.saleCount} {todayReport.saleCount === 1 ? "sale" : "sales"} today
                    </Text>
                  </View>
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <Ionicons name="trending-up" size={24} color={accentFg} />
                  </View>
                </View>

                <Pressable
                  onPress={() => router.push("/(tabs)/counter")}
                  className="mt-8 flex-row items-center justify-center rounded-[24px] py-4 active:opacity-90"
                  style={{ backgroundColor: accentFg }}
                >
                  <Ionicons name="scan" size={22} color={accent} />
                  <Text className="ml-2 text-[17px] font-black tracking-tight" style={{ color: accent }}>
                    Checkout Counter
                  </Text>
                </Pressable>
              </View>

              {/* Stock Alerts */}
              {stockIssueCount > 0 && (
                <Pressable
                  onPress={() => router.push("/(tabs)/items/inventory")}
                  className="mx-4 mb-8 flex-row items-center rounded-[28px] border border-orange-500/20 bg-orange-500/10 p-4 active:opacity-80 dark:border-orange-400/20 dark:bg-orange-400/10"
                >
                  <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-orange-500/20">
                    <Ionicons name="warning" size={24} color="#ea580c" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[16px] font-black tracking-tight text-foreground">
                      Inventory Alert
                    </Text>
                    <Text className="mt-0.5 text-[14px] font-medium text-muted">
                      {stockSignals.skuOutOfStock} empty, {stockSignals.skuLowStock} low
                    </Text>
                  </View>
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-background/50">
                    <Ionicons name="arrow-forward" size={18} color="#ea580c" />
                  </View>
                </Pressable>
              )}

              {/* Quick Actions */}
              <View className="mb-8">
                <Text className="mx-4 mb-4 text-[18px] font-black tracking-tight text-foreground">
                  Quick Actions
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                >
                  <QuickAction
                    icon="add"
                    label="Add Item"
                    onPress={() => router.push("/(tabs)/items/product/new")}
                    iconColor={accent}
                    surfaceColor={surface}
                  />
                  <QuickAction
                    icon="folder"
                    label="Categories"
                    onPress={() => router.push("/(tabs)/items/category/new")}
                    iconColor={foreground}
                    surfaceColor={surface}
                  />
                  <QuickAction
                    icon="bar-chart"
                    label="Reports"
                    onPress={() => router.push("/(tabs)/reports")}
                    iconColor={foreground}
                    surfaceColor={surface}
                  />
                  <QuickAction
                    icon="receipt"
                    label="Receipts"
                    onPress={() => router.push("/(tabs)/receipts")}
                    iconColor={foreground}
                    surfaceColor={surface}
                  />
                  <QuickAction
                    icon="albums"
                    label="Inventory"
                    onPress={() => router.push("/(tabs)/items/inventory")}
                    iconColor={foreground}
                    surfaceColor={surface}
                  />
                  <QuickAction
                    icon="cube"
                    label="Catalog"
                    onPress={() => router.push("/(tabs)/items")}
                    iconColor={foreground}
                    surfaceColor={surface}
                  />
                </ScrollView>
              </View>

              {/* Overview Stats */}
              <View className="mb-8 px-4">
                <Text className="mb-4 text-[18px] font-black tracking-tight text-foreground">
                  Performance
                </Text>
                <View className="flex-row flex-wrap justify-between">
                  <OverviewCard
                    title="7 Days"
                    amount={weekReport.totalRevenueCents}
                    subtitle={`${weekReport.saleCount} sales`}
                    currency={businessCurrency}
                  />
                  <OverviewCard
                    title="This Month"
                    amount={monthReport.totalRevenueCents}
                    subtitle={`${monthReport.saleCount} sales`}
                    currency={businessCurrency}
                  />
                  <OverviewCard
                    title="All Time"
                    amount={allReport.totalRevenueCents}
                    subtitle={`${allReport.saleCount} sales`}
                    currency={businessCurrency}
                  />
                  <OverviewCard
                    title="Catalog"
                    amount={products.length}
                    subtitle="active items"
                    isNumber
                  />
                </View>
              </View>

              {/* Recent Sales */}
              {recentSales.length > 0 && (
                <View className="mb-4 px-4">
                  <View className="mb-4 flex-row items-end justify-between">
                    <Text className="text-[18px] font-black tracking-tight text-foreground">
                      Recent Activity
                    </Text>
                    <Pressable onPress={() => router.push("/(tabs)/today")} className="active:opacity-70">
                      <Text className="text-[14px] font-bold text-accent">View All</Text>
                    </Pressable>
                  </View>
                  <View className="overflow-hidden rounded-[32px] border border-border/40 bg-surface">
                    {recentSales.map((sale, idx) => (
                      <RecentSaleRow
                        key={sale.id}
                        sale={sale}
                        businessCurrency={businessCurrency}
                        isLast={idx === recentSales.length - 1}
                        onPress={() =>
                          router.push({
                            pathname: "/receipt/sale",
                            params: { saleId: sale.id },
                          })
                        }
                      />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

