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
  reportPeriodLabel,
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 96 },
  kpiStrip: { flexGrow: 0 },
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

    if (p.variants.length > 0) {
      for (const v of p.variants) {
        if (!v.active) continue;
        trackedSkuCount++;
        const q = v.quantityOnHand;
        if (q <= 0) skuOutOfStock++;
        else if (alertThreshold > 0 && q <= alertThreshold) skuLowStock++;
      }
    } else {
      trackedSkuCount++;
      const q = p.quantityOnHand;
      if (q <= 0) skuOutOfStock++;
      else if (alertThreshold > 0 && q <= alertThreshold) skuLowStock++;
    }
  }

  return { skuOutOfStock, skuLowStock, trackedSkuCount };
}

function ShortcutRow({
  icon,
  title,
  subtitle,
  onPress,
  iconTint,
  iconBgClass,
  muted,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  iconTint: string;
  iconBgClass: string;
  muted: string;
  isLast?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className={`min-h-[58px] flex-row items-center gap-3.5 px-3.5 py-2.5 active:opacity-92 ${isLast ? "" : "border-b border-border/55"}`}
    >
      <View
        className={`h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconBgClass}`}
      >
        <Ionicons name={icon} size={22} color={iconTint} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[16px] font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-[13px] leading-4 text-muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={muted} />
    </Pressable>
  );
}

function RecentSaleRow({
  sale,
  businessCurrency,
  muted,
  onPress,
  isLast,
}: {
  sale: CounterSaleRow;
  businessCurrency: string;
  muted: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const r = sale.receipt;
  const pay = paymentDisplayForKey(r.paymentMethodKey);
  const timeLabel = formatSaleCompletedAt(r.completedAtIso);
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 py-3.5 pl-1 pr-1 active:opacity-90 ${isLast ? "" : "border-b border-border/45"}`}
    >
      <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/80">
        <Ionicons name={pay.icon} size={20} color={pay.iconHex} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {r.paymentMethodLabel}
        </Text>
        <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
          {timeLabel}
        </Text>
      </View>
      <Text className="text-[15px] font-bold tabular-nums text-foreground">
        {formatMinorUnitsToCurrency(r.totalCents, r.currency || businessCurrency)}
      </Text>
    </Pressable>
  );
}

export default function DashboardTab() {
  const router = useRouter();
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const foreground = useThemeColor("foreground");

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

  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
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

  const avgAllTimeLabel =
    allReport.saleCount > 0
      ? formatMinorUnitsToCurrency(allReport.averageTicketCents, businessCurrency)
      : "—";

  const avgMonthLabel =
    monthReport.saleCount > 0
      ? formatMinorUnitsToCurrency(monthReport.averageTicketCents, businessCurrency)
      : "—";

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
            <View className="rounded-2xl border border-border/70 bg-surface px-5 py-8">
              <View className="mb-3 h-[52px] w-[52px] items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="log-in-outline" size={28} color={accent} />
              </View>
              <Text className="text-[17px] font-bold text-foreground">You’re signed out</Text>
              <Text className="mt-2 text-[15px] leading-5 text-muted">
                Sign in from the menu after you open the app to see sales, inventory signals, and shortcuts.
              </Text>
            </View>
          ) : businessesQuery.isError ? (
            <View className="rounded-2xl border border-border/70 bg-surface px-5 py-8">
              <View className="mb-3 h-[52px] w-[52px] items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="cloud-offline-outline" size={28} color={accent} />
              </View>
              <Text className="text-[17px] font-bold text-foreground">Couldn’t load workspace</Text>
              <Text className="mt-2 text-[15px] leading-5 text-muted">
                Check your connection and try again from the side menu.
              </Text>
            </View>
          ) : !businessId ? (
            <View className="rounded-2xl border border-border/70 bg-surface px-5 py-8">
              <View className="mb-3 h-[52px] w-[52px] items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="storefront-outline" size={28} color={accent} />
              </View>
              <Text className="text-[17px] font-bold text-foreground">Finish setup</Text>
              <Text className="mt-2 text-[15px] leading-5 text-muted">
                Create or select a business to see your dashboard and start selling.
              </Text>
            </View>
          ) : (
            <>
              {dataRefreshing ? (
                <View className="mb-3 flex-row items-center gap-2 rounded-xl bg-accent/10 px-3 py-2">
                  <Ionicons name="phone-portrait-outline" size={18} color={accent} />
                  <Text className="flex-1 text-[13px] font-medium text-foreground">
                    Syncing local data — sales and catalog stay usable offline-first.
                  </Text>
                </View>
              ) : null}

              <View className="mb-4 overflow-hidden rounded-[22px] border border-border/65 bg-surface">
                <View className="bg-accent/12 px-4 pb-4 pt-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className="h-2 w-2 rounded-full bg-accent" />
                      <Text className="text-[12px] font-bold uppercase tracking-wider text-muted">
                        All-time revenue
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => router.push("/(tabs)/reports")}
                      className="flex-row items-center gap-0.5 rounded-full bg-background/60 px-2.5 py-1 active:opacity-80"
                    >
                      <Text className="text-[12px] font-semibold text-accent">Reports</Text>
                      <Ionicons name="chevron-forward" size={14} color={accent} />
                    </Pressable>
                  </View>
                  <Text className="mt-2 text-[34px] font-bold tabular-nums leading-[38px] tracking-tight text-foreground">
                    {formatMinorUnitsToCurrency(allReport.totalRevenueCents, businessCurrency)}
                  </Text>
                  <Text className="mt-1.5 text-[14px] leading-5 text-muted">
                    {allReport.saleCount} lifetime {allReport.saleCount === 1 ? "sale" : "sales"}
                    {allReport.saleCount > 0 ? ` · ${avgAllTimeLabel} avg ticket` : ""}
                  </Text>
                </View>
                <View className="flex-row border-t border-border/55 bg-background/40">
                  <View className="min-w-0 flex-1 border-r border-border/50 px-3.5 py-3">
                    <Text
                      className="text-[11px] font-bold uppercase tracking-wide text-muted"
                      numberOfLines={1}
                    >
                      Catalog
                    </Text>
                    <Text className="mt-1 text-[20px] font-bold tabular-nums text-foreground">
                      {products.length}
                    </Text>
                    <Text className="text-[11px] text-muted">active products</Text>
                  </View>
                  <View className="min-w-0 flex-1 border-r border-border/50 px-3.5 py-3">
                    <Text
                      className="text-[11px] font-bold uppercase tracking-wide text-muted"
                      numberOfLines={1}
                    >
                      Categories
                    </Text>
                    <Text className="mt-1 text-[20px] font-bold tabular-nums text-foreground">
                      {categories.length}
                    </Text>
                    <Text className="text-[11px] text-muted">groups</Text>
                  </View>
                  <View className="min-w-0 flex-1 px-3.5 py-3">
                    <Text
                      className="text-[11px] font-bold uppercase tracking-wide text-muted"
                      numberOfLines={1}
                    >
                      Stock SKUs
                    </Text>
                    <Text className="mt-1 text-[20px] font-bold tabular-nums text-foreground">
                      {stockSignals.trackedSkuCount}
                    </Text>
                    <Text className="text-[11px] text-muted">tracked</Text>
                  </View>
                </View>
              </View>

              <Text className="mb-2.5 px-0.5 text-[12px] font-bold uppercase tracking-wider text-muted">
                Performance window
              </Text>
              <ScrollView
                horizontal
                style={styles.kpiStrip}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 6, paddingRight: 4 }}
              >
                <View className="w-[154px] rounded-2xl border border-border/65 bg-surface p-3.5">
                  <Text className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    {reportPeriodLabel("today")}
                  </Text>
                  <Text className="mt-2 text-[20px] font-bold tabular-nums text-foreground">
                    {formatMinorUnitsToCurrency(todayReport.totalRevenueCents, businessCurrency)}
                  </Text>
                  <Text className="mt-1 text-[12px] text-muted">
                    {todayReport.saleCount} sales
                    {todayReport.saleCount > 0
                      ? ` · ${formatMinorUnitsToCurrency(todayReport.averageTicketCents, businessCurrency)} avg`
                      : ""}
                  </Text>
                </View>
                <View className="w-[154px] rounded-2xl border border-border/65 bg-surface p-3.5">
                  <Text className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    {reportPeriodLabel("month")}
                  </Text>
                  <Text className="mt-2 text-[20px] font-bold tabular-nums text-foreground">
                    {formatMinorUnitsToCurrency(monthReport.totalRevenueCents, businessCurrency)}
                  </Text>
                  <Text className="mt-1 text-[12px] text-muted">
                    {monthReport.saleCount} sales
                    {monthReport.saleCount > 0 ? ` · ${avgMonthLabel} avg` : ""}
                  </Text>
                </View>
                <View className="w-[154px] rounded-2xl border border-border/65 bg-surface p-3.5">
                  <Text className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    {reportPeriodLabel("last7")}
                  </Text>
                  <Text className="mt-2 text-[20px] font-bold tabular-nums text-foreground">
                    {formatMinorUnitsToCurrency(weekReport.totalRevenueCents, businessCurrency)}
                  </Text>
                  <Text className="mt-1 text-[12px] text-muted">
                    {weekReport.saleCount} sales
                    {weekReport.saleCount > 0
                      ? ` · ${formatMinorUnitsToCurrency(weekReport.averageTicketCents, businessCurrency)} avg`
                      : ""}
                  </Text>
                </View>
              </ScrollView>

              {stockIssueCount > 0 ? (
                <Pressable
                  onPress={() => router.push("/(tabs)/items/inventory")}
                  className="mb-4 mt-3 overflow-hidden rounded-2xl border border-orange-500/45 bg-orange-500/10 active:opacity-92 dark:border-orange-400/35 dark:bg-orange-400/12"
                >
                  <View className="flex-row items-start gap-3 px-4 py-3.5">
                    <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-xl bg-orange-500/22">
                      <Ionicons name="warning-outline" size={22} color="#ea580c" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[16px] font-bold text-foreground">Stock needs attention</Text>
                      <Text className="mt-1 text-[14px] leading-5 text-muted">
                        {stockSignals.skuOutOfStock} out of stock
                        {stockSignals.skuLowStock > 0
                          ? ` · ${stockSignals.skuLowStock} at or below alert`
                          : ""}
                      </Text>
                      <Text className="mt-2 text-[13px] font-semibold text-orange-700 dark:text-orange-300">
                        Open inventory →
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ) : stockSignals.trackedSkuCount > 0 ? (
                <View className="mb-4 mt-3 flex-row items-center gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/8 px-4 py-3 dark:border-emerald-400/30 dark:bg-emerald-400/10">
                  <Ionicons name="checkmark-circle-outline" size={22} color="#059669" />
                  <View className="min-w-0 flex-1">
                    <Text className="text-[15px] font-semibold text-foreground">Inventory looks healthy</Text>
                    <Text className="mt-0.5 text-[13px] text-muted">
                      No SKUs below alert or at zero right now.
                    </Text>
                  </View>
                </View>
              ) : null}

              {recentSales.length > 0 ? (
                <View className="mb-4 mt-1 overflow-hidden rounded-[20px] border border-border/65 bg-surface">
                  <View className="flex-row items-center justify-between border-b border-border/55 bg-background/35 px-4 py-3">
                    <Text className="text-[15px] font-bold text-foreground">Recent sales</Text>
                    <Pressable
                      onPress={() => router.push("/(tabs)/today")}
                      className="flex-row items-center gap-0.5 active:opacity-70"
                    >
                      <Text className="text-[13px] font-semibold text-accent">Today</Text>
                      <Ionicons name="chevron-forward" size={16} color={accent} />
                    </Pressable>
                  </View>
                  <View className="px-3">
                    {recentSales.map((sale, idx) => (
                      <RecentSaleRow
                        key={sale.id}
                        sale={sale}
                        businessCurrency={businessCurrency}
                        muted={muted}
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
              ) : null}

              <Text className="mb-2 mt-1 px-0.5 text-[12px] font-bold uppercase tracking-wider text-muted">
                Shortcuts
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a sale at the counter"
                onPress={() => router.push("/(tabs)/counter")}
                className="mb-3 min-h-[76px] flex-row items-center justify-between overflow-hidden rounded-2xl border border-accent/25 px-5 py-4 active:opacity-92"
                style={{ backgroundColor: accent }}
              >
                <View className="min-w-0 flex-1 pr-3">
                  <Text className="text-[18px] font-bold" style={{ color: accentFg }} numberOfLines={1}>
                    New sale
                  </Text>
                  <Text
                    className="mt-0.5 text-[14px]"
                    style={{ color: accentFg, opacity: 0.9 }}
                    numberOfLines={2}
                  >
                    Counter checkout — works offline, syncs when you’re back online
                  </Text>
                </View>
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  <Ionicons name="storefront" size={26} color={accentFg} />
                </View>
              </Pressable>

              <View className="mb-2 overflow-hidden rounded-[20px] border border-border/70 bg-surface">
                <ShortcutRow
                  icon="add-circle-outline"
                  title="Add product"
                  subtitle="Create a new item in your catalog"
                  onPress={() => router.push("/(tabs)/items/product/new")}
                  iconTint={accent}
                  iconBgClass="bg-accent/14"
                  muted={muted}
                />
                <ShortcutRow
                  icon="folder-open-outline"
                  title="Add category"
                  subtitle="Organize items into groups"
                  onPress={() => router.push("/(tabs)/items/category/new")}
                  iconTint={foreground}
                  iconBgClass="bg-foreground/8"
                  muted={muted}
                />
                <ShortcutRow
                  icon="calendar-outline"
                  title="Today’s activity"
                  subtitle="Expandable list of today’s completed sales"
                  onPress={() => router.push("/(tabs)/today")}
                  iconTint={foreground}
                  iconBgClass="bg-foreground/8"
                  muted={muted}
                />
                <ShortcutRow
                  icon="bar-chart-outline"
                  title="Reports & trends"
                  subtitle="Payments, best sellers, and history by period"
                  onPress={() => router.push("/(tabs)/reports")}
                  iconTint={foreground}
                  iconBgClass="bg-foreground/8"
                  muted={muted}
                />
                <ShortcutRow
                  icon="receipt-outline"
                  title="Receipts"
                  subtitle="Search and revisit past receipts"
                  onPress={() => router.push("/(tabs)/receipts")}
                  iconTint={foreground}
                  iconBgClass="bg-foreground/8"
                  muted={muted}
                />
                <ShortcutRow
                  icon="albums-outline"
                  title="Inventory"
                  subtitle="Stock levels, adjustments, and alerts"
                  onPress={() => router.push("/(tabs)/items/inventory")}
                  iconTint={foreground}
                  iconBgClass="bg-foreground/8"
                  muted={muted}
                />
                <ShortcutRow
                  icon="cube-outline"
                  title="Product catalog"
                  subtitle="Browse and edit items"
                  onPress={() => router.push("/(tabs)/items")}
                  iconTint={foreground}
                  iconBgClass="bg-foreground/8"
                  muted={muted}
                  isLast
                />
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
