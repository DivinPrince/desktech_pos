import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { paymentDisplayForKey } from "@/lib/counter-checkout/payment-options";
import { useLocalSalesToday } from "@/lib/data/local-counter-sales/hooks";
import type { LocalCounterSaleRow } from "@/lib/data/local-counter-sales/types";
import { useOfflineExecutor } from "@/lib/data/offline/offline-executor-provider";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { formatSaleCompletedAt } from "@/lib/format-sale-completed-at";
import { fetchDeviceAppearsOnline } from "@/lib/network/fetch-device-online";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
});

function firstNameFromDisplay(displayName: string): string {
  const part = displayName.split(/\s+/)[0];
  return part && part.length > 0 ? part : displayName;
}

function customerHasDetails(r: LocalCounterSaleRow["receipt"]): boolean {
  const c = r.customer;
  return (
    c.name.trim().length > 0 ||
    c.phone.trim().length > 0 ||
    c.email.trim().length > 0 ||
    c.address.trim().length > 0
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

const SALE_CARD_CLASS =
  "mb-2 overflow-hidden rounded-2xl border border-border/75 bg-surface";

export default function TodayTab() {
  const insets = useSafeAreaInsets();
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

  const { rows, refresh } = useLocalSalesToday(
    signedIn ? businessId : undefined,
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
          /* detector best-effort — flushes outbox when NetInfo was stale */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [refresh, offlineExecutor]),
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
    for (const r of rows) {
      sum += r.receipt.totalCents;
    }
    return sum;
  }, [rows]);

  const dateLine = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const renderItem: ListRenderItem<LocalCounterSaleRow> = useCallback(
    ({ item }) => {
      const r = item.receipt;
      const expanded = expandedIds.has(item.id);
      const timeLabel = formatSaleCompletedAt(r.completedAtIso);
      const paymentUi = paymentDisplayForKey(r.paymentMethodKey);

      return (
        <View className={SALE_CARD_CLASS}>
          <Pressable
            onPress={() => toggleExpanded(item.id)}
            className="flex-row items-center gap-3.5 px-3.5 py-4 active:opacity-90"
          >
            <View className="h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/70">
              <Ionicons name={paymentUi.icon} size={22} color={paymentUi.iconHex} />
            </View>
            <View className="min-w-0 flex-1 pr-1">
              <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                {r.paymentMethodLabel}
              </Text>
              <Text className="mt-1 text-[12px] tabular-nums text-muted" numberOfLines={1}>
                {timeLabel}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text className="text-[16px] font-semibold tabular-nums text-foreground">
                {formatMinorUnitsToCurrency(r.totalCents, r.currency || businessCurrency)}
              </Text>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={muted} />
            </View>
          </Pressable>
          {expanded ? (
            <View className="border-t border-border/75 px-3 pb-3.5 pt-3">
              {r.lines.length === 0 ? (
                <Text className="text-[13px] text-muted">No items</Text>
              ) : (
                <View className="gap-2.5">
                  {r.lines.map((line) => (
                    <View key={line.productId} className="flex-row items-start justify-between gap-3">
                      <Text
                        className="min-w-0 flex-1 text-[14px] leading-5 text-foreground"
                        numberOfLines={3}
                      >
                        {line.name}
                        <Text className="text-muted">
                          {" "}
                          ×{line.quantity}
                        </Text>
                      </Text>
                      <Text className="pt-0.5 text-[14px] font-semibold tabular-nums text-foreground">
                        {formatMinorUnitsToCurrency(
                          line.priceCents * line.quantity,
                          r.currency || businessCurrency,
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {r.paymentNote.trim().length > 0 ? (
                <Text className="mt-3 text-[13px] text-muted" numberOfLines={4}>
                  {r.paymentNote}
                </Text>
              ) : null}
              {customerHasDetails(r) ? (
                <View className="mt-3 gap-1 border-t border-border/50 pt-3">
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="person-outline" size={15} color={muted} />
                    <Text className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                      Customer
                    </Text>
                  </View>
                  {r.customer.name.trim().length > 0 ? (
                    <Text className="text-[14px] font-medium text-foreground">{r.customer.name}</Text>
                  ) : null}
                  {r.customer.phone.trim().length > 0 ? (
                    <Text className="text-[13px] text-muted">
                      {r.customer.dialCode}
                      {r.customer.phone}
                    </Text>
                  ) : null}
                  {r.customer.email.trim().length > 0 ? (
                    <Text className="text-[13px] text-muted" numberOfLines={2}>
                      {r.customer.email}
                    </Text>
                  ) : null}
                  {r.customer.address.trim().length > 0 ? (
                    <Text className="text-[13px] text-muted" numberOfLines={3}>
                      {r.customer.address}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    [businessCurrency, expandedIds, muted, toggleExpanded],
  );

  const headerSubtitle2 = useMemo(() => {
    if (!signedIn) return "Sign in to see today’s activity";
    if (businessesQuery.isError) return "Could not load workspace";
    if (!businessId) return "Finish setup to track sales";
    if (rows.length === 0) {
      return `${dateLine} · ${shortName}`;
    }
    return `${rows.length} ${rows.length === 1 ? "sale" : "sales"} · ${formatMinorUnitsToCurrency(totals, businessCurrency)}`;
  }, [
    businessCurrency,
    businessesQuery.isError,
    dateLine,
    businessId,
    rows.length,
    shortName,
    signedIn,
    totals,
  ]);

  const listHeader = useMemo(() => {
    if (!signedIn) {
      return <EmptyHint icon="log-in-outline" title="Sign in to see today’s sales" accent={accent} />;
    }
    if (businessesQuery.isError) {
      return (
        <EmptyHint icon="cloud-offline-outline" title="Couldn’t load your business" accent={accent} />
      );
    }
    if (!businessId) {
      return <EmptyHint icon="storefront-outline" title="Finish setup to track sales" accent={accent} />;
    }
    if (rows.length === 0) {
      return <EmptyHint icon="cart-outline" title="No sales yet today" accent={accent} />;
    }
    return null;
  }, [accent, businessId, businessesQuery.isError, rows.length, signedIn]);

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="light" />
      <View
        style={{
          backgroundColor: accent,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 14,
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ color: accentFg, fontSize: 22, fontWeight: "700" }}>
          Today
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 14,
            marginTop: 4,
          }}
          numberOfLines={2}
        >
          {headerSubtitle2}
        </Text>
        {signedIn && businessId && rows.length > 0 ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: 13,
              marginTop: 4,
            }}
            numberOfLines={1}
          >
            {dateLine} · {shortName}
          </Text>
        ) : null}
      </View>

      <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
        <FlatList
          style={styles.list}
          data={signedIn && businessId ? rows : []}
          extraData={{ expanded: expandedIds.size, count: rows.length }}
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
