import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
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

import { useCounterCheckout } from "@/app/(tabs)/counter/_counter-checkout-context";
import { BrandedLoading } from "@/components/desktech-ui";
import { NavigationMenuTrigger } from "@/components/navigation/navigation-shell";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import type { CartLine } from "@/lib/counter-cart/counter-cart";
import { cartLineKey, useCounterCart } from "@/lib/counter-cart/counter-cart";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
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
  const muted = useThemeColor("muted");

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const businessId = currentBusiness?.id;
  const currency = currentBusiness?.currency ?? "USD";

  const { lines, clear, totalCents, totalUnits, decrementProduct } = useCounterCart();
  const lineCount = lines.length;

  const onCharge = useCallback(() => {
    if (totalCents <= 0) return;
    resetForNewCheckout();
    router.push("/counter/checkout-details");
  }, [resetForNewCheckout, router, totalCents]);

  const renderLine: ListRenderItem<CartLine> = useCallback(
    ({ item }) => {
      const lineCents = item.priceCents * item.quantity;

      return (
        <View className="mb-3 flex-row items-center rounded-[24px] bg-surface px-4 py-4">
          <View className="min-w-0 flex-1 pr-3">
            <Text
              className="text-[17px] font-bold tracking-tight text-foreground"
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <Text className="mt-1 text-[14px] font-medium text-muted">
              {formatMinorUnitsToCurrency(item.priceCents, currency)} each
            </Text>
          </View>
          
          <View className="items-end gap-1.5">
            <Text className="text-[18px] font-black tabular-nums tracking-tight text-foreground">
              {formatMinorUnitsToCurrency(lineCents, currency)}
            </Text>
            <View className="flex-row items-center rounded-full bg-background/80 px-1 py-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove one unit from line"
                hitSlop={8}
                onPress={() =>
                  decrementProduct({
                    productId: item.productId,
                    productVariantId: item.productVariantId,
                  })
                }
                className="h-7 w-7 items-center justify-center rounded-full bg-surface active:bg-accent/10"
              >
                <Ionicons name="remove" size={18} color={accent} />
              </Pressable>
              <Text className="mx-3 text-[14px] font-bold tabular-nums text-foreground">
                {item.quantity}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [accent, currency, decrementProduct],
  );

  const listEmptyDesign = useMemo(
    () => (
      <View className="mt-4 px-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New sale, open Items"
          accessibilityHint="Opens the Items tab so you can add products"
          onPress={() => router.push("/items")}
          className="w-full min-h-[200px] items-center justify-center rounded-[32px] border border-dashed border-border/80 bg-surface/50 px-6 py-10 active:opacity-80"
        >
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <Ionicons name="cart-outline" size={32} color={accent} />
          </View>
          <Text className="text-center text-[20px] font-black tracking-tight text-foreground">
            Counter is empty
          </Text>
          <Text className="mt-2 max-w-[240px] text-center text-[15px] leading-6 text-muted">
            Tap to open your catalog and add items to this sale.
          </Text>
          
          <View className="mt-6 flex-row items-center rounded-full bg-accent px-5 py-2.5">
            <Ionicons name="add" size={18} color={accentFg} />
            <Text className="ml-1.5 text-[15px] font-bold" style={{ color: accentFg }}>
              Add Items
            </Text>
          </View>
        </Pressable>
      </View>
    ),
    [accent, accentFg, router],
  );

  const listFooterActions = useMemo(
    () => (
      <View className="mt-4 flex-row gap-3 px-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add items"
          onPress={() => router.push("/items")}
          className="min-h-[56px] min-w-0 flex-1 flex-row items-center justify-center rounded-[20px] bg-accent/10 active:opacity-80"
        >
          <Ionicons name="add-circle-outline" size={20} color={accent} />
          <Text className="ml-2 text-[16px] font-bold" style={{ color: accent }}>
            Add items
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear counter"
          onPress={() => clear()}
          className="min-h-[56px] min-w-0 flex-1 flex-row items-center justify-center rounded-[20px] bg-surface border border-border/40 active:opacity-80"
        >
          <Ionicons name="trash-outline" size={18} color={muted} />
          <Text className="ml-2 text-[16px] font-bold text-muted">Clear</Text>
        </Pressable>
      </View>
    ),
    [accent, clear, muted, router],
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
          paddingBottom: 24,
          paddingHorizontal: 16,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <View className="flex-row items-center justify-between gap-2 py-1 mb-2 mt-2">
          <View className="h-11 w-11 items-center justify-center">
            <NavigationMenuTrigger iconColor={accentFg} />
          </View>
          <View className="flex-1 items-center">
            <Text
              className="text-[24px] font-black tracking-tighter"
              style={{ color: accentFg }}
              numberOfLines={1}
            >
              Counter
            </Text>
            <Text
              className="mt-1 text-[14px] font-medium"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {totalUnits === 0
                ? "New sale"
                : `${totalUnits} ${totalUnits === 1 ? "unit" : "units"} · ${lines.length} ${lines.length === 1 ? "line" : "lines"}`}
            </Text>
          </View>
          <View className="h-11 w-11" />
        </View>
      </View>

      <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
        {!signedIn ? (
          <View className="flex-1 justify-center px-4">
            <View className="mx-4 rounded-[32px] border border-border/70 bg-surface px-6 py-10 shadow-sm">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="log-in-outline" size={30} color={accent} />
              </View>
              <Text className="text-[20px] font-black tracking-tight text-foreground">You’re signed out</Text>
              <Text className="mt-2 text-[15px] leading-6 text-muted">
                Sign in from the menu to use the checkout counter.
              </Text>
            </View>
          </View>
        ) : businessesQuery.isError ? (
          <View className="flex-1 justify-center px-4">
            <View className="mx-4 rounded-[32px] border border-border/70 bg-surface px-6 py-10 shadow-sm">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="cloud-offline-outline" size={30} color={accent} />
              </View>
              <Text className="text-[20px] font-black tracking-tight text-foreground">Couldn’t load workspace</Text>
              <Text className="mt-2 text-[15px] leading-6 text-muted">
                Check your connection and try again from the side menu.
              </Text>
            </View>
          </View>
        ) : workspaceColdLoad ? (
          <BrandedLoading message="Loading your workspace…" />
        ) : !businessId ? (
          <View className="flex-1 justify-center px-4">
            <View className="mx-4 rounded-[32px] border border-border/70 bg-surface px-6 py-10 shadow-sm">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-accent/18">
                <Ionicons name="storefront-outline" size={30} color={accent} />
              </View>
              <Text className="text-[20px] font-black tracking-tight text-foreground">Finish setup</Text>
              <Text className="mt-2 text-[15px] leading-6 text-muted">
                Create or select a business to start selling.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <FlatList
              style={styles.list}
              data={lines}
              extraData={lineCount}
              keyExtractor={(item) => cartLineKey(item)}
              renderItem={renderLine}
              ListEmptyComponent={listEmptyDesign}
              ListFooterComponent={
                lineCount > 0 ? listFooterActions : null
              }
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 24 },
              ]}
              showsVerticalScrollIndicator={false}
            />

            <View
              style={[
                styles.footer,
                {
                  paddingHorizontal: 20,
                  paddingTop: 16,
                  paddingBottom: FOOTER_ABOVE_TAB_GAP + 8,
                  backgroundColor: background,
                },
              ]}
            >
              <View className="mb-4 flex-row items-end justify-between">
                <Text className="text-[16px] font-bold text-muted uppercase tracking-widest">Total Due</Text>
                <Text className="text-[36px] font-black tabular-nums tracking-tighter text-foreground leading-none">
                  {formatMinorUnitsToCurrency(totalCents, currency)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={totalCents <= 0}
                onPress={onCharge}
                className={`flex-row items-center justify-center rounded-[24px] py-4 ${
                  totalCents <= 0 ? "bg-surface border border-border/40" : ""
                }`}
                style={totalCents > 0 ? { backgroundColor: accent } : undefined}
              >
                <Text 
                  className={`text-[18px] font-black tracking-tight ${
                    totalCents <= 0 ? "text-muted" : ""
                  }`}
                  style={totalCents > 0 ? { color: accentFg } : undefined}
                >
                  Charge {formatMinorUnitsToCurrency(totalCents, currency)}
                </Text>
                {totalCents > 0 && (
                  <Ionicons name="arrow-forward" size={20} color={accentFg} style={{ marginLeft: 8 }} />
                )}
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
