import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useMemo } from "react";
import {
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useCounterCheckout } from "@/app/(tabs)/counter/counter-checkout-context";
import { authClient } from "@/lib/auth-client";
import type { SessionPayload } from "@/lib/auth-session";
import type { CartLine } from "@/lib/counter-cart/counter-cart";
import { useCounterCart } from "@/lib/counter-cart/counter-cart";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
});

/** Small gap above the tab bar; tab navigator already lays out content above the bar. */
const FOOTER_ABOVE_TAB_GAP = 10;

export default function CounterTab() {
  const router = useRouter();
  const { resetForNewCheckout } = useCounterCheckout();
  const insets = useSafeAreaInsets();
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const background = useThemeColor("background");

  const { data: session } = authClient.useSession();
  const user = (session as SessionPayload | null | undefined)?.user;
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = useMemo(
    () => businessesQuery.data?.[0],
    [businessesQuery.data],
  );
  const businessId = currentBusiness?.id;
  const currency = currentBusiness?.currency ?? "USD";

  const { lines, clear, totalCents, totalUnits } = useCounterCart();
  const lineCount = lines.length;

  const onCharge = useCallback(() => {
    if (totalCents <= 0) return;
    resetForNewCheckout();
    router.push("/counter/checkout-details");
  }, [resetForNewCheckout, router, totalCents]);

  const renderLine: ListRenderItem<CartLine> = useCallback(
    ({ item, index }) => {
      const lineCents = item.priceCents * item.quantity;
      const isOnly = lineCount === 1;
      const isFirst = index === 0;
      const isLast = index === lineCount - 1;

      const rowClass = isOnly
        ? "mb-2 flex-row items-center justify-between rounded-2xl border border-border/75 bg-surface px-3 py-3.5"
        : isFirst
          ? "flex-row items-center justify-between rounded-t-2xl border-b border-l border-r border-t border-border/75 bg-surface px-3 py-3.5"
          : isLast
            ? "mb-2 flex-row items-center justify-between rounded-b-2xl border-b border-l border-r border-border/75 bg-surface px-3 py-3.5"
            : "flex-row items-center justify-between border-b border-l border-r border-border/75 bg-surface px-3 py-3.5";

      return (
        <View className={rowClass}>
          <View className="min-w-0 flex-1 pr-2">
            <Text
              className="text-[15px] font-semibold leading-snug text-foreground"
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <Text className="mt-0.5 text-[13px] tabular-nums text-muted">
              {formatMinorUnitsToCurrency(item.priceCents, currency)} each ·{" "}
              {item.quantity}x
            </Text>
          </View>
          <Text className="text-[16px] font-semibold tabular-nums text-foreground">
            {formatMinorUnitsToCurrency(lineCents, currency)}
          </Text>
        </View>
      );
    },
    [currency, lineCount],
  );

  const listEmptyDesign = useMemo(
    () => (
      <View className="mt-6 items-center px-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New sale, open Items"
          accessibilityHint="Opens the Items tab so you can add products"
          onPress={() => router.push("/items")}
          className="w-full min-h-[148] items-center justify-center rounded-2xl border border-border/75 bg-surface-secondary px-5 py-8 active:opacity-80"
        >
          <View className="mb-3 h-[52px] w-[52px] items-center justify-center rounded-full bg-accent/18">
            <Ionicons name="add" size={32} color={accent} />
          </View>
          <Text className="text-center text-[18px] font-semibold text-foreground">
            New sale
          </Text>
          <Text className="mt-1.5 max-w-[280px] text-center text-[14px] leading-[20px] text-muted">
            Tap to open Items and add lines to this sale.
          </Text>
        </Pressable>
      </View>
    ),
    [accent, router],
  );

  const listFooterActions = useMemo(
    () => (
      <View className="mt-3 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add items"
          onPress={() => router.push("/items")}
          className="min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-xl border border-border/75 bg-surface-secondary active:opacity-80"
        >
          <Text className="text-[15px] font-medium text-foreground">
            Add items
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear counter"
          onPress={() => clear()}
          className="min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-xl border border-border/75 bg-background active:opacity-80"
        >
          <Text className="text-[15px] font-medium text-muted">Clear</Text>
        </Pressable>
      </View>
    ),
    [clear, router],
  );

  const businesses = businessesQuery.data ?? [];
  const workspaceColdLoad =
    businesses.length === 0 && businessesQuery.isPending;

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
        <Text
          style={{ color: accentFg, fontSize: 22, fontWeight: "700" }}
        >
          Counter
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 14,
            marginTop: 4,
          }}
        >
          {totalUnits === 0
            ? "New sale"
            : `${totalUnits} ${totalUnits === 1 ? "unit" : "units"} · ${lines.length} ${lines.length === 1 ? "line" : "lines"}`}
        </Text>
      </View>

      <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
        {!signedIn ? (
          <View className="flex-1 justify-center px-4">
            <Text className="text-[15px] text-muted">
              Sign in to use the counter.
            </Text>
          </View>
        ) : businessesQuery.isError ? (
          <View className="flex-1 justify-center px-4">
            <Text className="text-[15px] text-muted">
              Could not load workspace. Pull to refresh from another tab.
            </Text>
          </View>
        ) : workspaceColdLoad ? (
          <View className="flex-1 justify-center px-4">
            <Text className="text-[15px] text-muted">
              Loading your workspace…
            </Text>
          </View>
        ) : !businessId ? (
          <View className="flex-1 justify-center px-4">
            <Text className="text-[15px] text-muted">
              No business yet — finish onboarding or create a business on the
              server.
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              style={styles.list}
              data={lines}
              extraData={lineCount}
              keyExtractor={(item) => item.productId}
              renderItem={renderLine}
              ListEmptyComponent={listEmptyDesign}
              ListFooterComponent={
                lineCount > 0 ? listFooterActions : null
              }
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 16 },
              ]}
              showsVerticalScrollIndicator={false}
            />

            <View
              style={[
                styles.footer,
                {
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: FOOTER_ABOVE_TAB_GAP,
                  backgroundColor: background,
                },
              ]}
            >
              <View className="mb-2 flex-row items-baseline justify-between">
                <Text className="text-[15px] font-medium text-muted">Total</Text>
                <Text className="text-[26px] font-bold tabular-nums text-foreground">
                  {formatMinorUnitsToCurrency(totalCents, currency)}
                </Text>
              </View>
              <Button
                className="rounded-2xl"
                isDisabled={totalCents <= 0}
                onPress={onCharge}
              >
                <Button.Label className="font-semibold text-accent-foreground">
                  Charge {formatMinorUnitsToCurrency(totalCents, currency)}
                </Button.Label>
              </Button>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
