import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import { useToast } from "heroui-native/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandedLoading, KeyboardAvoidingScaffold } from "@/components/desktech-ui";
import { NavigationMenuTrigger } from "@/components/navigation/navigation-shell";
import { ProductListGrid } from "@/components/desktech-ui/product-list-grid";
import type { CartLine } from "@/lib/counter-cart/counter-cart";
import { useCounterCart } from "@/lib/counter-cart/counter-cart";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { productMatchesListFilters } from "@/lib/data/catalog/collections";
import type { ProductRow } from "@/lib/data/catalog/types";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import {
  catalogKeys,
  useBusinessesQuery,
  useProductsQuery,
} from "@/lib/queries/business-catalog";

const styles = StyleSheet.create({
  root: { flex: 1 },
  variantModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  variantModalCard: {
    borderRadius: 16,
    padding: 16,
    maxHeight: "80%",
  },
  scroll: { flex: 1 },
  searchShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
  },
});

const SEARCH_DEBOUNCE_MS = 300;

function lineQuantity(
  lines: CartLine[],
  productId: string,
  productVariantId?: string,
): number {
  const hit = lines.find(
    (l) =>
      l.productId === productId &&
      (l.productVariantId ?? "") === (productVariantId ?? ""),
  );
  return hit?.quantity ?? 0;
}

function activeVariantsStockTotal(p: ProductRow): number {
  return p.variants.filter((v) => v.active).reduce((s, v) => s + v.quantityOnHand, 0);
}

function productGridStockHint(
  p: ProductRow,
): { footerHint?: string; footerHintCritical?: boolean; isOutOfStock?: boolean } {
  if (!p.trackStock) return {};
  if (p.variants.length > 0) {
    if (activeVariantsStockTotal(p) <= 0) {
      return { isOutOfStock: true };
    }
    return {};
  }
  if (p.quantityOnHand <= 0) {
    return { isOutOfStock: true };
  }
  if (p.quantityOnHand <= 3) {
    return { footerHint: `${p.quantityOnHand} left` };
  }
  return {};
}

/** Uses the active business from session, falling back to cached businesses offline. */
export default function ItemsTab() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const cardBg = useThemeColor("background");
  const queryClient = useQueryClient();
  const { addProduct, decrementProduct, getQuantity, lines } = useCounterCart();

  const [searchInput, setSearchInput] = useState("");
  const [variantPickerProduct, setVariantPickerProduct] = useState<ProductRow | null>(null);
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

  const variantPickerOptions = useMemo(() => {
    if (!variantPickerProduct) return [];
    return variantPickerProduct.variants
      .filter((v) => v.active)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [variantPickerProduct]);
  const workspaceColdLoad = businesses.length === 0 && businessesQuery.isPending;
  const productsInitialLoad =
    Boolean(businessId) && (products?.length ?? 0) === 0 && productsQuery.isPending;

  const showCatalogContent = signedIn && businessId && !catalogError;

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="light" />
      <KeyboardAvoidingScaffold>
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
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <NavigationMenuTrigger iconColor={accentFg} />
              <Text className="text-[28px] font-black tracking-tighter" style={{ color: accentFg }}>
                Catalog
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan barcode (coming soon)"
              hitSlop={8}
              onPress={() => {}}
              style={({ pressed }) => ({
                height: 44,
                width: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.2)",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="barcode-outline" size={22} color={accentFg} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={[
                styles.searchShell,
                { backgroundColor: "rgba(255,255,255,0.2)" },
              ]}
            >
              <Ionicons name="search" size={22} color={accentFg} style={{ opacity: 0.8 }} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search items…"
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={{
                  flex: 1,
                  marginLeft: 10,
                  color: accentFg,
                  fontSize: 16,
                  fontWeight: "600",
                  paddingVertical: 12,
                }}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
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
          <BrandedLoading
            variant="embedded"
            message="Loading your workspace…"
          />
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
                const stockHintProps = productGridStockHint(p);
                return (
                  <ProductListGrid.ProductCard
                    key={p.id}
                    title={p.active ? p.name : `${p.name} · Inactive`}
                    price={formatMinorUnitsToCurrency(p.priceCents, currency)}
                    quantityLabel={qty}
                    {...stockHintProps}
                    onPress={
                      p.active
                        ? () => {
                            if (p.variants.length > 0) {
                              void Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                              setVariantPickerProduct(p);
                              return;
                            }
                            const inCart = lineQuantity(lines, p.id);
                            if (p.trackStock && inCart >= p.quantityOnHand) {
                              void Haptics.notificationAsync(
                                Haptics.NotificationFeedbackType.Error,
                              );
                              toast.show({
                                variant: "danger",
                                label: "Out of stock",
                                description:
                                  p.quantityOnHand <= 0
                                    ? `${p.name} has no units available.`
                                    : `All ${p.quantityOnHand} units of ${p.name} are already on the counter.`,
                              });
                              return;
                            }
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
                            const forProduct = lines.filter((l) => l.productId === p.id);
                            if (forProduct.length !== 1) return;
                            void Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Medium,
                            );
                            decrementProduct({
                              productId: p.id,
                              productVariantId: forProduct[0]!.productVariantId,
                            });
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
              <BrandedLoading
                variant="inline"
                className="mt-3 self-center"
                message="Loading products…"
              />
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
      </KeyboardAvoidingScaffold>

      <Modal
        visible={variantPickerProduct != null}
        transparent
        animationType="fade"
        onRequestClose={() => setVariantPickerProduct(null)}
      >
        <View style={styles.variantModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss variant picker"
            style={StyleSheet.absoluteFillObject}
            onPress={() => setVariantPickerProduct(null)}
          />
          <View style={[styles.variantModalCard, { backgroundColor: cardBg }]}>
            <Text className="text-[18px] font-semibold text-foreground">
              {variantPickerProduct?.name}
            </Text>
            <Text className="mb-3 mt-1 text-[14px] text-muted">Choose an option</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
            >
              {variantPickerOptions.length === 0 ? (
                <Text className="py-2 text-[14px] text-muted">
                  No active variants. Turn on or add options in Inventory.
                </Text>
              ) : (
                variantPickerOptions.map((v) => {
                  const parent = variantPickerProduct;
                  const variantOos = Boolean(
                    parent?.trackStock && v.quantityOnHand <= 0,
                  );
                  return (
                    <Pressable
                      key={v.id}
                      accessibilityRole="button"
                      onPress={() => {
                        const par = variantPickerProduct;
                        if (!par) return;
                        const inCart = lineQuantity(lines, par.id, v.id);
                        if (par.trackStock && inCart >= v.quantityOnHand) {
                          void Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Error,
                          );
                          toast.show({
                            variant: "danger",
                            label: "Out of stock",
                            description:
                              v.quantityOnHand <= 0
                                ? `${par.name} · ${v.name} has no units available.`
                                : `All ${v.quantityOnHand} units of ${v.name} are already on the counter.`,
                          });
                          return;
                        }
                        void Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light,
                        );
                        addProduct({
                          productId: par.id,
                          name: `${par.name} · ${v.name}`,
                          priceCents: v.priceCents,
                          productVariantId: v.id,
                        });
                        setVariantPickerProduct(null);
                      }}
                      className={`mb-2 rounded-xl border border-border/75 bg-surface px-4 py-3.5 active:opacity-80 ${
                        variantOos ? "opacity-55" : ""
                      }`}
                    >
                      <Text className="text-[15px] font-medium text-foreground">{v.name}</Text>
                      <Text className="mt-0.5 text-[13px] tabular-nums text-muted">
                        {formatMinorUnitsToCurrency(v.priceCents, currency)}
                      </Text>
                      {parent?.trackStock ? (
                        <Text
                          className={`mt-1 text-[12px] font-semibold ${
                            v.quantityOnHand <= 0 ? "text-danger" : "text-muted"
                          }`}
                        >
                          {v.quantityOnHand <= 0
                            ? "Out of stock"
                            : `${v.quantityOnHand} available`}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => setVariantPickerProduct(null)}
              className="mt-3 py-2"
            >
              <Text className="text-center text-[15px] text-muted">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
