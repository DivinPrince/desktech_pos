import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductListGrid } from "@/components/desktech-ui/product-list-grid";
import { useCounterCart } from "@/lib/counter-cart/counter-cart";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { productMatchesListFilters } from "@/lib/data/catalog/collections";
import {
  catalogKeys,
  useBusinessesQuery,
  useProductsQuery,
} from "@/lib/queries/business-catalog";

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  searchShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 12,
  },
});

const SEARCH_DEBOUNCE_MS = 300;

/** Uses the active business from session, falling back to cached businesses offline. */
export default function ItemsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const queryClient = useQueryClient();
  const { addProduct, decrementProduct, getQuantity } = useCounterCart();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const businessId = currentBusiness?.id;
  const currency = currentBusiness?.currency ?? "USD";

  /** Single persisted slice (no server `search` param) so SQLite/cache stays one source of truth; filter below. */
  const productsQuery = useProductsQuery(businessId, signedIn, {
    activeOnly: false,
  });

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
  const scrollBottomPad = Math.max(insets.bottom, 12) + tabBarClearance + 16;

  const catalogError = businessesQuery.error ?? productsQuery.error;

  const businesses = businessesQuery.data ?? [];
  const products = productsQuery.data;
  const filteredProducts = useMemo(() => {
    return (products ?? []).filter((p) =>
      productMatchesListFilters(p, false, debouncedSearch),
    );
  }, [products, debouncedSearch]);
  const workspaceColdLoad = businesses.length === 0 && businessesQuery.isPending;
  const productsInitialLoad =
    Boolean(businessId) && (products?.length ?? 0) === 0 && productsQuery.isPending;

  const showCatalogContent = signedIn && businessId && !catalogError;

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={[
              styles.searchShell,
              { backgroundColor: "rgba(255,255,255,0.22)" },
            ]}
          >
            <Ionicons name="search-outline" size={20} color={accentFg} />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search items…"
              placeholderTextColor="rgba(255,255,255,0.65)"
              style={{
                flex: 1,
                marginLeft: 8,
                color: accentFg,
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
            accessibilityLabel="Scan barcode (coming soon)"
            hitSlop={8}
            onPress={() => {}}
            style={({ pressed }) => ({
              height: 46,
              width: 46,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.22)",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="barcode-outline" size={26} color={accentFg} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: scrollBottomPad,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void onRefresh()}
            tintColor={accent}
          />
        }
      >
        {!signedIn ? (
          <Text
            style={{
              color: muted,
              fontSize: 15,
            }}
          >
            Sign in to load your catalog.
          </Text>
        ) : businessesQuery.isError ? (
          <Text
            style={{
              color: muted,
              fontSize: 15,
            }}
          >
            Could not load businesses. Pull to refresh when the API is reachable.
          </Text>
        ) : workspaceColdLoad ? (
          <Text style={{ color: muted, fontSize: 15 }}>Loading your workspace…</Text>
        ) : !businessId ? (
          <Text
            style={{
              color: muted,
              fontSize: 15,
            }}
          >
            No business yet — finish onboarding or create a business on the server.
          </Text>
        ) : catalogError ? (
          <Text
            style={{
              color: muted,
              fontSize: 15,
            }}
          >
            Failed to load products. Pull to try again.
          </Text>
        ) : showCatalogContent ? (
          <View>
            <ProductListGrid>
              {filteredProducts.map((p) => {
                const qty = getQuantity(p.id);
                return (
                  <ProductListGrid.ProductCard
                    key={p.id}
                    title={p.active ? p.name : `${p.name} · Inactive`}
                    price={formatMinorUnitsToCurrency(p.priceCents, currency)}
                    quantityLabel={qty}
                    onPress={
                      p.active
                        ? () => {
                            void Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            addProduct({
                              productId: p.id,
                              name: p.name,
                              priceCents: p.priceCents,
                            });
                          }
                        : undefined
                    }
                    onLongPress={
                      p.active && qty > 0
                        ? () => {
                            void Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Medium,
                            );
                            decrementProduct({ productId: p.id });
                          }
                        : undefined
                    }
                  />
                );
              })}
              <ProductListGrid.AddItemCard
                onPress={() => router.push("/items/inventory")}
                label="Add item"
              />
            </ProductListGrid>
            {productsInitialLoad ? (
              <Text
                style={{
                  color: muted,
                  fontSize: 14,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                Loading products…
              </Text>
            ) : products.length === 0 ? (
              <Text
                style={{
                  color: muted,
                  fontSize: 14,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                No products yet. Tap Add item to open inventory and add your first product.
              </Text>
            ) : filteredProducts.length === 0 ? (
              <Text
                style={{
                  color: muted,
                  fontSize: 14,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                No matches. Try another search or tap Add item to manage your catalog.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
