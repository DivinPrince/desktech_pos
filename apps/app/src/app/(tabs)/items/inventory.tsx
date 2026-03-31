import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BrandedLoading, KeyboardAvoidingScaffold } from "@/components/desktech-ui";
import { SegmentedTwoTabs } from "@/components/desktech-ui/segmented-two-tabs";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import {
  catalogKeys,
  useBusinessesQuery,
  useCategoriesQuery,
  useProductsQuery,
} from "@/lib/queries/business-catalog";

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  searchShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
});

const SEARCH_DEBOUNCE_MS = 300;

type Segment = "products" | "categories";

export default function InventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const muted = useThemeColor("muted");
  const fg = useThemeColor("foreground");
  const queryClient = useQueryClient();

  const [segment, setSegment] = useState<Segment>(() =>
    tabParam === "categories" ? "categories" : "products",
  );

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setDebouncedSearch("");
  }, [segment]);

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const businessId = currentBusiness?.id;
  const currency = currentBusiness?.currency ?? "USD";

  const productsQuery = useProductsQuery(businessId, signedIn && segment === "products", {
    activeOnly: false,
    search: debouncedSearch,
  });
  /** Keep collection subscribed while on Inventory so creates/edits reflect immediately when switching to Categories. */
  const categoriesQuery = useCategoriesQuery(businessId, signedIn);

  /** Only true during explicit pull-to-refresh — avoids native refresh spinner over list on background refetch. */
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!businessId) return;
    setPullRefreshing(true);
    try {
      await queryClient.refetchQueries({
        queryKey: catalogKeys.all(businessId),
      });
    } finally {
      setPullRefreshing(false);
    }
  }, [businessId, queryClient]);

  const tabBarClearance = 72;
  const listBottomPad = Math.max(insets.bottom, 12) + tabBarClearance;

  const businesses = businessesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const categoriesRaw = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );
  const categorySearch = searchInput.trim().toLowerCase();
  const categories = useMemo(() => {
    if (!categorySearch) return categoriesRaw;
    return categoriesRaw.filter((c) =>
      c.name.toLowerCase().includes(categorySearch),
    );
  }, [categoriesRaw, categorySearch]);

  const listError =
    segment === "products" ? productsQuery.error : categoriesQuery.error;

  const productsInitialLoad =
    Boolean(businessId) && productsQuery.isPending && products.length === 0;
  const categoriesInitialLoad =
    Boolean(businessId) && categoriesQuery.isPending && categoriesRaw.length === 0;

  const showLists = signedIn && businessId && !listError;
  const workspaceColdLoad = businesses.length === 0 && businessesQuery.isPending;

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="light" />
      <View
        style={{
          backgroundColor: accent,
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center justify-between gap-2 py-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-white/15"
          >
            <Ionicons name="chevron-back" size={26} color={accentFg} />
          </Pressable>
          <Text
            className="min-w-0 flex-1 text-center text-[18px] font-semibold"
            style={{ color: accentFg }}
            numberOfLines={1}
          >
            Inventory
          </Text>
          <View className="h-10 w-10" />
        </View>
        <Text
          style={{ color: accentFg, opacity: 0.9 }}
          className="mt-1 text-center text-[14px] leading-5"
        >
          Manage products and categories
        </Text>
      </View>

      <KeyboardAvoidingScaffold>
        <SafeAreaView style={styles.root} edges={["left", "right"]}>
        <View className="px-4 pb-3 pt-4">
          <SegmentedTwoTabs
            tabs={[
              { id: "products", label: "Products" },
              { id: "categories", label: "Categories" },
            ]}
            value={segment}
            onChange={(id) => setSegment(id as Segment)}
          />
        </View>

        <View className="flex-row items-center gap-2 px-4 pb-3">
          <View
            style={[styles.searchShell, { backgroundColor: "rgba(0,0,0,0.06)" }]}
            className="flex-1"
          >
            <Ionicons name="search-outline" size={20} color={muted} />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder={
                segment === "products" ? "Search products…" : "Search categories…"
              }
              placeholderTextColor={muted}
              style={{
                flex: 1,
                marginLeft: 8,
                color: fg,
                fontSize: 15,
                paddingVertical: 10,
              }}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              segment === "products" ? "Add product" : "Add category"
            }
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (segment === "products") {
                router.push("/items/product/new");
              } else {
                router.push("/items/category/new");
              }
            }}
            style={({ pressed }) => ({
              height: 44,
              width: 44,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: accent,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Ionicons name="add" size={28} color={accentFg} />
          </Pressable>
        </View>

        {!signedIn ? (
          <Text className="px-4 text-[15px] text-muted">Sign in to manage catalog.</Text>
        ) : businessesQuery.isError ? (
          <Text className="px-4 text-[15px] text-muted">
            Could not load businesses. Pull to refresh.
          </Text>
        ) : workspaceColdLoad ? (
          <BrandedLoading
            variant="embedded"
            className="px-4"
            message="Loading your workspace…"
          />
        ) : !businessId ? (
          <Text className="px-4 text-[15px] text-muted">
            No business selected. Finish onboarding first.
          </Text>
        ) : listError ? (
          <Text className="px-4 text-[15px] text-muted">
            Failed to load. Pull to try again.
          </Text>
        ) : showLists ? (
          segment === "products" ? (
            <FlatList
              style={styles.list}
              data={products}
              keyExtractor={(p) => p.id}
              refreshControl={
                <RefreshControl
                  refreshing={pullRefreshing}
                  onRefresh={() => void onRefresh()}
                  tintColor={accent}
                />
              }
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: listBottomPad,
                flexGrow: 1,
              }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: p }) => (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/items/product/[id]",
                      params: { id: p.id },
                    })
                  }
                  className="mb-2 flex-row items-center rounded-2xl border border-border/80 bg-surface px-4 py-3.5 active:bg-accent/10"
                >
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-[16px] font-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    {p.sku ? (
                      <Text className="mt-0.5 text-[13px] text-muted" numberOfLines={1}>
                        SKU {p.sku}
                      </Text>
                    ) : null}
                  </View>
                  <View className="items-end gap-1 pl-2">
                    <Text className="text-[15px] font-semibold tabular-nums text-foreground">
                      {formatMinorUnitsToCurrency(p.priceCents, currency)}
                    </Text>
                    <View
                      className={`rounded-full px-2 py-0.5 ${p.active ? "bg-success/15" : "bg-muted/25"}`}
                    >
                      <Text
                        className={`text-[11px] font-semibold uppercase ${p.active ? "text-success" : "text-muted"}`}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={muted}
                    style={{ marginLeft: 4 }}
                  />
                </Pressable>
              )}
              ListEmptyComponent={
                productsInitialLoad ? (
                  <BrandedLoading
                    variant="embedded"
                    message="Loading products…"
                  />
                ) : (
                  <Text className="py-10 text-center text-[15px] text-muted">
                    {debouncedSearch.length > 0
                      ? "No matching products."
                      : "No products yet. Tap + to add one."}
                  </Text>
                )
              }
            />
          ) : (
            <FlatList
              style={styles.list}
              data={categories}
              keyExtractor={(c) => c.id}
              refreshControl={
                <RefreshControl
                  refreshing={pullRefreshing}
                  onRefresh={() => void onRefresh()}
                  tintColor={accent}
                />
              }
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: listBottomPad,
                flexGrow: 1,
              }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: c }) => (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/items/category/[id]",
                      params: { id: c.id },
                    })
                  }
                  className="mb-2 flex-row items-center rounded-2xl border border-border/80 bg-surface px-4 py-3.5 active:bg-accent/10"
                >
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-[16px] font-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                    <Text className="mt-0.5 text-[13px] text-muted">
                      Sort order {c.sortOrder}
                      {c.parentId ? " · Subcategory" : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={muted} />
                </Pressable>
              )}
              ListEmptyComponent={
                categoriesInitialLoad ? (
                  <BrandedLoading
                    variant="embedded"
                    message="Loading categories…"
                  />
                ) : (
                  <Text className="py-10 text-center text-[15px] text-muted">
                    {categorySearch.length > 0
                      ? "No matching categories."
                      : "No categories yet. Tap + to add one."}
                  </Text>
                )
              }
            />
          )
        ) : null}
        </SafeAreaView>
      </KeyboardAvoidingScaffold>
    </View>
  );
}
