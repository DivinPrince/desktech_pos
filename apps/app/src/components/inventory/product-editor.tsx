import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { Switch } from "heroui-native/switch";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import { APIError } from "@repo/sdk";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FormSectionCard,
  SearchablePickerSheet,
  type SearchablePickerOption,
} from "@/components/desktech-ui";
import { KeyboardScreen } from "@/components/layout/keyboard-screen";
import { StockManagementSheet } from "@/components/inventory/stock-management-sheet";
import type { ProductRow } from "@/lib/data/catalog/types";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import {
  formatMinorUnitsToCurrency,
  minorUnitsToMajorDecimalString,
  parseMajorUnitsToMinorUnits,
} from "@/lib/format-money";
import { useNetworkReachable } from "@/lib/hooks/use-network-reachable";
import {
  type ProductCreateBody,
  useBusinessesQuery,
  useCategoriesQuery,
  useCreateProductMutation,
  useCreateProductVariantMutation,
  useDeleteProductMutation,
  useDeleteProductVariantMutation,
  useProductQuery,
  useUpdateProductMutation,
  useUpdateProductVariantMutation,
} from "@/lib/queries/business-catalog";

type ProductVariantRow = ProductRow["variants"][number];

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-transparent rounded-xl py-2.5 px-3 text-[15px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

/** Multiline: same borderless row as `INPUT_ROW_CLASS`, taller body. */
const DESCRIPTION_INPUT_CLASS =
  "min-h-[100px] border-0 border-transparent bg-transparent rounded-xl py-2.5 px-3 text-[15px] leading-[22px] text-field-foreground shadow-none ios:shadow-none android:shadow-none";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

function productRowUpdatedAtMs(row: ProductRow): number | null {
  const raw = row.updatedAt;
  const ms = raw instanceof Date ? raw.getTime() : new Date(raw as string).getTime();
  return Number.isNaN(ms) ? null : ms;
}

type ProductEditorProps = {
  productId?: string;
};

export function ProductEditor({ productId }: ProductEditorProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const networkOnline = useNetworkReachable();
  const { toast } = useToast();
  const fieldPlaceholder = useThemeColor("field-placeholder");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const danger = useThemeColor("danger");

  const isEdit = Boolean(productId);

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = resolveActiveBusiness(session, businessesQuery.data);
  const businessId = currentBusiness?.id;
  const currency = currentBusiness?.currency ?? "USD";

  const categoriesQuery = useCategoriesQuery(businessId, Boolean(businessId));
  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );

  const productQuery = useProductQuery(businessId, productId, isEdit);
  const product = productQuery.data as ProductRow | undefined;

  const createMutation = useCreateProductMutation(businessId);
  const updateMutation = useUpdateProductMutation(businessId, productId);
  const deleteMutation = useDeleteProductMutation(businessId);
  const createVariantMutation = useCreateProductVariantMutation(businessId, productId);
  const deleteVariantMutation = useDeleteProductVariantMutation(businessId, productId);
  const updateVariantMutation = useUpdateProductVariantMutation(businessId, productId);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("ea");
  const [description, setDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [costStr, setCostStr] = useState("");
  const [reorderStr, setReorderStr] = useState("0");
  const [trackStock, setTrackStock] = useState(true);
  const [active, setActive] = useState(true);

  const [stockSheetOpen, setStockSheetOpen] = useState(false);
  const [stockVariantId, setStockVariantId] = useState<string | null>(null);
  const [variantEditOpen, setVariantEditOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPriceStr, setNewVariantPriceStr] = useState("");
  const [newVariantSku, setNewVariantSku] = useState("");
  const [editVarName, setEditVarName] = useState("");
  const [editVarPriceStr, setEditVarPriceStr] = useState("");
  const [editVarSku, setEditVarSku] = useState("");

  const [nameError, setNameError] = useState("");
  const [priceError, setPriceError] = useState("");
  const [costError, setCostError] = useState("");

  /** Ignore stale snapshots; include currency so price strings re-format when business currency changes. */
  const lastHydratedUpdatedAtMsRef = React.useRef<number>(-1);
  const lastHydrationKeyRef = React.useRef<string>("");

  useEffect(() => {
    lastHydratedUpdatedAtMsRef.current = -1;
    lastHydrationKeyRef.current = "";
    if (productId) return;
    setCategoryId(null);
    setName("");
    setSku("");
    setUnit("ea");
    setDescription("");
    setPriceStr("");
    setCostStr("");
    setReorderStr("0");
    setTrackStock(true);
    setActive(true);
  }, [productId]);

  useEffect(() => {
    if (!isEdit || !product) return;
    const updatedMs = productRowUpdatedAtMs(product);
    if (updatedMs == null) return;
    if (updatedMs < lastHydratedUpdatedAtMsRef.current) return;

    const hydrationKey = `${product.id}:${updatedMs}:${currency}`;
    if (hydrationKey === lastHydrationKeyRef.current) return;
    lastHydrationKeyRef.current = hydrationKey;
    lastHydratedUpdatedAtMsRef.current = updatedMs;
    setCategoryId(product.categoryId);
    setName(product.name);
    setSku(product.sku ?? "");
    setUnit(product.unit || "ea");
    setDescription(product.description ?? "");
    setPriceStr(minorUnitsToMajorDecimalString(product.priceCents, currency));
    setCostStr(
      product.costCents != null
        ? minorUnitsToMajorDecimalString(product.costCents, currency)
        : "",
    );
    setReorderStr(String(product.reorderLevel));
    setTrackStock(product.trackStock);
    setActive(product.active);
  }, [isEdit, product, currency]);

  const categoryLeadingOptions = useMemo((): SearchablePickerOption[] => {
    return [
      {
        value: "",
        label: "None · Uncategorized",
        searchText: "none uncategorized",
      },
    ];
  }, []);

  const categoryPickerOptions = useMemo((): SearchablePickerOption[] => {
    return categories.map((c) => ({
      value: c.id,
      label: c.name,
      searchText: c.name.toLowerCase(),
    }));
  }, [categories]);

  const saving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    createVariantMutation.isPending ||
    deleteVariantMutation.isPending ||
    updateVariantMutation.isPending;

  const onSave = useCallback(() => {
    setNameError("");
    setPriceError("");
    setCostError("");
    const n = name.trim();
    if (!n) {
      setNameError("Name is required");
      return;
    }
    const priceCents = parseMajorUnitsToMinorUnits(priceStr, currency);
    if (priceCents === null) {
      setPriceError("Enter a valid price");
      return;
    }
    let costCents: number | null | undefined;
    const costTrim = costStr.trim();
    if (costTrim === "") {
      costCents = isEdit ? null : undefined;
    } else {
      const parsed = parseMajorUnitsToMinorUnits(costTrim, currency);
      if (parsed === null) {
        setCostError("Enter a valid cost or leave blank");
        return;
      }
      costCents = parsed;
    }
    const reorderParsed = Number.parseInt(reorderStr, 10);
    const reorderLevel = Number.isFinite(reorderParsed) && reorderParsed >= 0 ? reorderParsed : 0;

    if (!businessId) return;

    if (isEdit && productId) {
      updateMutation.mutate(
        {
          name: n,
          categoryId,
          sku: sku.trim() === "" ? null : sku.trim(),
          unit: unit.trim() || "ea",
          description: description.trim() === "" ? null : description.trim(),
          priceCents,
          ...(costTrim === "" ? { costCents: null } : { costCents: costCents as number }),
          reorderLevel,
          trackStock,
          active,
        },
        {
          onSuccess: () => {
            toast.show({ variant: "success", label: "Product updated" });
            router.back();
          },
          onError: (e) => {
            toast.show({ variant: "danger", label: errorMessage(e) });
          },
        },
      );
    } else {
      const createPayload: ProductCreateBody = {
        name: n,
        priceCents,
        unit: unit.trim() || "ea",
        reorderLevel,
        trackStock,
        active,
      };
      if (categoryId) createPayload.categoryId = categoryId;
      if (sku.trim()) createPayload.sku = sku.trim();
      if (description.trim()) createPayload.description = description.trim();
      if (typeof costCents === "number") createPayload.costCents = costCents;
      createMutation.mutate(
        createPayload,
        {
          onSuccess: () => {
            toast.show({ variant: "success", label: "Product created" });
            router.back();
          },
          onError: (e) => {
            toast.show({ variant: "danger", label: errorMessage(e) });
          },
        },
      );
    }
  }, [
    name,
    priceStr,
    costStr,
    reorderStr,
    categoryId,
    sku,
    unit,
    description,
    trackStock,
    active,
    businessId,
    isEdit,
    productId,
    currency,
    createMutation,
    updateMutation,
    router,
    toast,
  ]);

  const onDelete = useCallback(() => {
    if (!productId || !businessId) return;
    Alert.alert(
      "Delete product",
      "This cannot be undone. Products used on sales cannot be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(productId, {
              onSuccess: () => {
                toast.show({ variant: "success", label: "Product deleted" });
                router.back();
              },
              onError: (e) => {
                toast.show({ variant: "danger", label: errorMessage(e) });
              },
            });
          },
        },
      ],
    );
  }, [productId, businessId, deleteMutation, router, toast]);

  const openStockSheet = useCallback((variantId: string | null) => {
    setStockVariantId(variantId);
    setStockSheetOpen(true);
  }, []);

  const onCreateVariant = useCallback(() => {
    const nvName = newVariantName.trim();
    if (!nvName) {
      toast.show({ variant: "danger", label: "Variant name is required" });
      return;
    }
    const pc = parseMajorUnitsToMinorUnits(newVariantPriceStr.trim(), currency);
    if (pc === null) {
      toast.show({ variant: "danger", label: "Enter a valid variant price" });
      return;
    }
    if (!businessId || !productId) return;
    createVariantMutation.mutate(
      {
        name: nvName,
        priceCents: pc,
        sku: newVariantSku.trim() === "" ? null : newVariantSku.trim(),
      },
      {
        onSuccess: () => {
          toast.show({ variant: "success", label: "Variant added" });
          setNewVariantName("");
          setNewVariantPriceStr("");
          setNewVariantSku("");
        },
        onError: (e) => {
          toast.show({ variant: "danger", label: errorMessage(e) });
        },
      },
    );
  }, [
    newVariantName,
    newVariantPriceStr,
    newVariantSku,
    currency,
    businessId,
    productId,
    createVariantMutation,
    toast,
  ]);

  const onSaveVariantEdit = useCallback(() => {
    if (!editingVariantId) return;
    const n = editVarName.trim();
    if (!n) {
      toast.show({ variant: "danger", label: "Name is required" });
      return;
    }
    const pc = parseMajorUnitsToMinorUnits(editVarPriceStr.trim(), currency);
    if (pc === null) {
      toast.show({ variant: "danger", label: "Enter a valid price" });
      return;
    }
    updateVariantMutation.mutate(
      {
        variantId: editingVariantId,
        body: {
          name: n,
          priceCents: pc,
          sku: editVarSku.trim() === "" ? null : editVarSku.trim(),
        },
      },
      {
        onSuccess: () => {
          toast.show({ variant: "success", label: "Variant updated" });
          setVariantEditOpen(false);
          setEditingVariantId(null);
        },
        onError: (e) => {
          toast.show({ variant: "danger", label: errorMessage(e) });
        },
      },
    );
  }, [
    editingVariantId,
    editVarName,
    editVarPriceStr,
    editVarSku,
    currency,
    updateVariantMutation,
    toast,
  ]);

  const onDeleteVariant = useCallback(
    (variantId: string, label: string) => {
      Alert.alert(
        "Delete variant",
        `Remove “${label}”? This cannot be undone if the variant was never sold.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              deleteVariantMutation.mutate(variantId, {
                onSuccess: () => {
                  toast.show({ variant: "success", label: "Variant removed" });
                },
                onError: (e) => {
                  toast.show({ variant: "danger", label: errorMessage(e) });
                },
              });
            },
          },
        ],
      );
    },
    [deleteVariantMutation, toast],
  );

  const businesses = businessesQuery.data ?? [];
  if (!signedIn || (businesses.length === 0 && businessesQuery.isPending)) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-[15px] text-muted">Loading…</Text>
      </View>
    );
  }

  if (!businessId) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-muted">No business found.</Text>
        <Button className="mt-4" onPress={() => router.back()}>
          <Button.Label className="font-semibold text-accent-foreground">
            Go back
          </Button.Label>
        </Button>
      </View>
    );
  }

  /** Only initial load — not `isFetching` (refetch) so background updates never flash this screen. */
  if (isEdit && productQuery.isPending && !product) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-[15px] text-muted">Loading product…</Text>
      </View>
    );
  }

  if (isEdit && productQuery.isError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-muted">Could not load this product.</Text>
        <Button className="mt-4" onPress={() => router.back()}>
          <Button.Label className="font-semibold text-accent-foreground">
            Go back
          </Button.Label>
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.fill} className="bg-background">
      <StatusBar style="light" />
      <KeyboardScreen
        edges={["left", "right"]}
        keyboardVerticalOffset={Platform.OS === "ios" ? Math.max(insets.top, 8) : 0}
        scrollContentStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 24,
        }}
        scrollProps={{
          overScrollMode: "never",
          alwaysBounceVertical: false,
        }}
      >
        <View
          className="flex-row items-center px-2 py-2"
          style={{
            backgroundColor: accent,
            paddingTop: Math.max(insets.top, 8),
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-white/15"
          >
            <Ionicons name="chevron-back" size={26} color={accentFg} />
          </Pressable>
          <Text
            className="min-w-0 flex-1 text-center text-[17px] font-semibold"
            style={{ color: accentFg }}
          >
            {isEdit ? "Edit product" : "New product"}
          </Text>
          <View className="h-10 w-10" />
        </View>

        {!networkOnline ? (
          <View className="bg-muted px-3 py-2">
            <Text className="text-center text-[13px] leading-[18px] text-foreground">
              Offline — catalog changes are saved on this device and sync when you are back online.
            </Text>
          </View>
        ) : null}

        <View style={styles.fill}>
          <View className="gap-4">
            <FormSectionCard title="Basics">
              <SearchablePickerSheet
              fieldLabel="Category"
              placeholder="Select category"
              title="Category"
              searchPlaceholder="Search categories or type a new name…"
              leadingOptions={categoryLeadingOptions}
              options={categoryPickerOptions}
              selectedValue={categoryId ?? ""}
              onSelect={(v) => setCategoryId(v === "" ? null : v)}
              onCreateFromQuery={(suggestedName) => {
                router.push({
                  pathname: "/items/category/new",
                  params: { suggestName: suggestedName },
                });
              }}
              createFromQueryLabel={(q) => `Create category “${q}”`}
              onEmptyOptions={() => {
                router.push({ pathname: "/items/category/new" });
              }}
              emptyOptionsLabel="Create category"
            />

            <View className="gap-1">
              <Text className="text-[14px] font-medium text-foreground">Name *</Text>
              <TextField className="gap-0">
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Product name"
                  variant="secondary"
                  className={INPUT_ROW_CLASS}
                />
              </TextField>
              {nameError ? (
                <Text className="text-[13px] text-danger">{nameError}</Text>
              ) : null}
            </View>

            <View className="gap-1">
              <Text className="text-[14px] font-medium text-foreground">SKU</Text>
              <TextField className="gap-0">
                <Input
                  value={sku}
                  onChangeText={setSku}
                  placeholder="Optional"
                  variant="secondary"
                  autoCapitalize="none"
                  className={INPUT_ROW_CLASS}
                />
              </TextField>
            </View>

            <View className="gap-1">
              <Text className="text-[14px] font-medium text-foreground">Unit</Text>
              <TextField className="gap-0">
                <Input
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="ea"
                  variant="secondary"
                  className={INPUT_ROW_CLASS}
                />
              </TextField>
            </View>

            <View className="gap-1">
              <Text className="text-[14px] font-medium text-foreground">Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional notes"
                placeholderTextColor={fieldPlaceholder}
                multiline
                textAlignVertical="top"
                className={DESCRIPTION_INPUT_CLASS}
              />
            </View>
            </FormSectionCard>

            <FormSectionCard title="Pricing">
              <View className="gap-1">
                <Text className="text-[14px] font-medium text-foreground">
                  Price ({currency}) *
                </Text>
                <TextField className="gap-0">
                  <Input
                    value={priceStr}
                    onChangeText={setPriceStr}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
                {priceError ? (
                  <Text className="text-[13px] text-danger">{priceError}</Text>
                ) : null}
              </View>
              <View className="gap-1">
                <Text className="text-[14px] font-medium text-foreground">
                  Cost ({currency})
                </Text>
                <TextField className="gap-0">
                  <Input
                    value={costStr}
                    onChangeText={setCostStr}
                    placeholder="Optional"
                    keyboardType="decimal-pad"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
                {costError ? (
                  <Text className="text-[13px] text-danger">{costError}</Text>
                ) : null}
              </View>
            </FormSectionCard>

          <FormSectionCard title="Inventory & status">
            {isEdit && product ? (
              product.variants.length > 0 ? (
                <View className="gap-3">
                  <Text className="text-[13px] leading-5 text-muted">
                    Each variant has its own price and stock.
                  </Text>
                  {product.variants.map((v: ProductVariantRow) => (
                    <View
                      key={v.id}
                      className="rounded-xl border border-border/70 bg-surface-secondary/40 p-3"
                    >
                      <View className="flex-row items-start justify-between gap-2">
                        <View className="min-w-0 flex-1">
                          <Text
                            className="text-[16px] font-semibold text-foreground"
                            numberOfLines={2}
                          >
                            {v.name}
                          </Text>
                          <Text className="mt-0.5 text-[14px] text-muted">
                            {formatMinorUnitsToCurrency(v.priceCents, currency)}
                            {v.sku ? ` · SKU ${v.sku}` : ""}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Pressable
                            onPress={() => {
                              setEditingVariantId(v.id);
                              setEditVarName(v.name);
                              setEditVarPriceStr(
                                minorUnitsToMajorDecimalString(v.priceCents, currency),
                              );
                              setEditVarSku(v.sku ?? "");
                              setVariantEditOpen(true);
                            }}
                            hitSlop={8}
                            className="h-9 w-9 items-center justify-center rounded-full active:bg-accent/10"
                          >
                            <Ionicons name="create-outline" size={22} color={accent} />
                          </Pressable>
                          <Pressable
                            onPress={() => onDeleteVariant(v.id, v.name)}
                            hitSlop={8}
                            className="h-9 w-9 items-center justify-center rounded-full active:bg-danger/10"
                          >
                            <Ionicons name="trash-outline" size={20} color={danger} />
                          </Pressable>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => openStockSheet(v.id)}
                        className="mt-3 rounded-xl bg-background/90 px-3 py-2.5 active:opacity-80"
                      >
                        <Text className="text-[12px] font-medium uppercase text-muted">
                          Available to sell
                        </Text>
                        <Text className="mt-0.5 text-[18px] font-semibold tabular-nums text-foreground">
                          {v.quantityOnHand}
                        </Text>
                        <Text className="mt-1 text-[12px] text-accent">Tap to adjust</Text>
                      </Pressable>
                    </View>
                  ))}
                  <View className="gap-2 rounded-xl border border-dashed border-border/80 bg-surface-secondary/30 p-3">
                    <Text className="text-[14px] font-medium text-foreground">Add variant</Text>
                    <TextField className="gap-0">
                      <Input
                        value={newVariantName}
                        onChangeText={setNewVariantName}
                        placeholder="Name (e.g. Large / Red)"
                        variant="secondary"
                        className={INPUT_ROW_CLASS}
                      />
                    </TextField>
                    <TextField className="gap-0">
                      <Input
                        value={newVariantPriceStr}
                        onChangeText={setNewVariantPriceStr}
                        placeholder={`Price (${currency})`}
                        keyboardType="decimal-pad"
                        variant="secondary"
                        className={INPUT_ROW_CLASS}
                      />
                    </TextField>
                    <TextField className="gap-0">
                      <Input
                        value={newVariantSku}
                        onChangeText={setNewVariantSku}
                        placeholder="SKU (optional)"
                        autoCapitalize="none"
                        variant="secondary"
                        className={INPUT_ROW_CLASS}
                      />
                    </TextField>
                    <Button
                      variant="secondary"
                      onPress={onCreateVariant}
                      isDisabled={createVariantMutation.isPending}
                    >
                      <Button.Label className="font-semibold">Add variant</Button.Label>
                    </Button>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => openStockSheet(null)}
                  className="rounded-xl bg-surface-secondary/50 px-3 py-3 active:opacity-80"
                >
                  <Text className="text-[12px] font-medium uppercase text-muted">
                    Available to sell
                  </Text>
                  <TextField className="mt-1 gap-0" pointerEvents="none">
                    <Input
                      editable={false}
                      value={String(product.quantityOnHand)}
                      variant="secondary"
                      className={INPUT_ROW_CLASS}
                    />
                  </TextField>
                  <Text className="mt-2 text-[12px] text-accent">Tap to adjust</Text>
                </Pressable>
              )
            ) : (
              <Text className="text-[13px] text-muted">
                Save the product first to set stock and variants.
              </Text>
            )}

            <View className="gap-1">
              <Text className="text-[14px] font-medium text-foreground">
                Reorder level
              </Text>
              <TextField className="gap-0">
                <Input
                  value={reorderStr}
                  onChangeText={setReorderStr}
                  placeholder="0"
                  keyboardType="number-pad"
                  variant="secondary"
                  className={INPUT_ROW_CLASS}
                />
              </TextField>
            </View>

            <View className="flex-row items-center justify-between py-2">
              <Text className="text-[15px] text-foreground">Track stock</Text>
              <Switch isSelected={trackStock} onSelectedChange={setTrackStock} />
            </View>
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-[15px] text-foreground">Active</Text>
              <Switch isSelected={active} onSelectedChange={setActive} />
            </View>
          </FormSectionCard>
          </View>
        </View>

        <View
          className="border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {isEdit ? (
            <Button
              variant="secondary"
              className="mb-2 border-danger/40"
              onPress={onDelete}
              isDisabled={saving}
            >
              <Button.Label style={{ color: danger }} className="font-semibold">
                Delete product
              </Button.Label>
            </Button>
          ) : null}
          <Button className="w-full" onPress={onSave} isDisabled={saving}>
            <Button.Label className="font-semibold text-accent-foreground">
              {saving ? "Saving…" : "Save"}
            </Button.Label>
          </Button>
        </View>
      </View>

      {isEdit && product ? (
        <StockManagementSheet
          visible={stockSheetOpen}
          onClose={() => setStockSheetOpen(false)}
          businessId={businessId}
          productId={product.id}
          productVariantId={stockVariantId ?? undefined}
          title="Stock"
          subtitle={
            stockVariantId
              ? (product.variants.find((v: ProductVariantRow) => v.id === stockVariantId)?.name ??
                undefined)
              : undefined
          }
          currentQuantity={
            stockVariantId
              ? (product.variants.find((v: ProductVariantRow) => v.id === stockVariantId)
                  ?.quantityOnHand ?? 0)
              : product.quantityOnHand
          }
          trackStock={product.trackStock}
        />
      ) : null}

      <Modal
        visible={variantEditOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setVariantEditOpen(false);
          setEditingVariantId(null);
        }}
      >
        <Pressable
          style={styles.fill}
          className="justify-end bg-black/45"
          onPress={() => {
            setVariantEditOpen(false);
            setEditingVariantId(null);
          }}
        >
          <Pressable
            className="max-h-[80%] rounded-t-3xl bg-background px-4 pb-6 pt-4"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-muted" />
            <Text className="text-[18px] font-semibold text-foreground">Edit variant</Text>
            <View className="mt-4 gap-1">
              <Text className="text-[14px] font-medium text-foreground">Name</Text>
              <TextField className="gap-0">
                <Input
                  value={editVarName}
                  onChangeText={setEditVarName}
                  variant="secondary"
                  className={INPUT_ROW_CLASS}
                />
              </TextField>
            </View>
            <View className="mt-3 gap-1">
              <Text className="text-[14px] font-medium text-foreground">Price ({currency})</Text>
              <TextField className="gap-0">
                <Input
                  value={editVarPriceStr}
                  onChangeText={setEditVarPriceStr}
                  keyboardType="decimal-pad"
                  variant="secondary"
                  className={INPUT_ROW_CLASS}
                />
              </TextField>
            </View>
            <View className="mt-3 gap-1">
              <Text className="text-[14px] font-medium text-foreground">SKU</Text>
              <TextField className="gap-0">
                <Input
                  value={editVarSku}
                  onChangeText={setEditVarSku}
                  autoCapitalize="none"
                  variant="secondary"
                  className={INPUT_ROW_CLASS}
                />
              </TextField>
            </View>
            <Button className="mt-5" onPress={onSaveVariantEdit} isDisabled={saving}>
              <Button.Label className="font-semibold text-accent-foreground">Save variant</Button.Label>
            </Button>
            <Button
              variant="secondary"
              className="mt-2"
              onPress={() => {
                setVariantEditOpen(false);
                setEditingVariantId(null);
              }}
            >
              <Button.Label className="font-semibold">Cancel</Button.Label>
            </Button>
          </Pressable>
        </Pressable>
      </Modal>

      </KeyboardScreen>
    </View>
  );
}
