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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BrandedLoading,
  FormSectionCard,
  KeyboardAvoidingScaffold,
  SearchablePickerSheet,
  type SearchablePickerOption,
} from "@/components/desktech-ui";
import { StockManagementSheet } from "@/components/inventory/stock-management-sheet";
import { subscribeCategoryLocalIdRemap } from "@/lib/data/catalog/category-reconcile";
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
  useCreateCategoryMutation,
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
  "border-0 border-transparent bg-background/50 rounded-[16px] py-3.5 px-4 text-[16px] font-medium leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

/** Multiline: same borderless row as `INPUT_ROW_CLASS`, taller body. */
const DESCRIPTION_INPUT_CLASS =
  "min-h-[120px] border-0 border-transparent bg-background/50 rounded-[16px] py-3.5 px-4 text-[16px] font-medium leading-[22px] text-field-foreground shadow-none ios:shadow-none android:shadow-none";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

/** Common sell / stock units; values are stored on the product row (max 32 chars). */
const UNIT_PRESET_OPTIONS: SearchablePickerOption[] = [
  {
    value: "ea",
    label: "Each · ea",
    searchText: "ea each piece item unit retail",
  },
  {
    value: "pc",
    label: "Piece · pc",
    searchText: "pc pcs piece pieces",
  },
  {
    value: "dz",
    label: "Dozen · dz",
    searchText: "dz dozen 12",
  },
  {
    value: "pair",
    label: "Pair",
    searchText: "pair pairs pr",
  },
  {
    value: "set",
    label: "Set",
    searchText: "set kit bundle group",
  },
  {
    value: "kg",
    label: "Kilogram · kg",
    searchText: "kg kilo kilogram weight",
  },
  {
    value: "g",
    label: "Gram · g",
    searchText: "g gram grams weight",
  },
  {
    value: "lb",
    label: "Pound · lb",
    searchText: "lb lbs pound pounds weight",
  },
  {
    value: "oz",
    label: "Ounce · oz",
    searchText: "oz ounce ounces weight",
  },
  {
    value: "L",
    label: "Liter · L",
    searchText: "l liter litre volume",
  },
  {
    value: "mL",
    label: "Milliliter · mL",
    searchText: "ml milliliter millilitre ml cc volume",
  },
  {
    value: "gal",
    label: "Gallon · gal",
    searchText: "gal gallon gallon volume",
  },
  {
    value: "box",
    label: "Box",
    searchText: "box carton",
  },
  {
    value: "case",
    label: "Case",
    searchText: "case crate",
  },
  {
    value: "pack",
    label: "Pack",
    searchText: "pack package pkt",
  },
  {
    value: "bottle",
    label: "Bottle",
    searchText: "bottle btl",
  },
  {
    value: "can",
    label: "Can",
    searchText: "can tin",
  },
  {
    value: "bag",
    label: "Bag",
    searchText: "bag sack",
  },
  {
    value: "roll",
    label: "Roll",
    searchText: "roll rolls",
  },
  {
    value: "sheet",
    label: "Sheet",
    searchText: "sheet sheets",
  },
];

function isPresetUnitValue(unit: string): boolean {
  const t = unit.trim().toLowerCase();
  return UNIT_PRESET_OPTIONS.some((o) => o.value.toLowerCase() === t);
}

/** Aligns free-text units with preset spellings (e.g. `l` → `L`); trims and enforces API max length. */
function canonicalUnitValue(raw: string): string {
  const t = raw.trim();
  if (!t) return "ea";
  const hit = UNIT_PRESET_OPTIONS.find((o) => o.value.toLowerCase() === t.toLowerCase());
  if (hit) return hit.value;
  return t.slice(0, 32);
}

function parseNonNegativeWholeNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return 0;
  if (!/^\d+$/.test(t)) return null;
  const parsed = Number.parseInt(t, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  const createCategoryMutation = useCreateCategoryMutation(businessId);
  const updateMutation = useUpdateProductMutation(businessId, productId);
  const deleteMutation = useDeleteProductMutation(businessId);
  const createVariantMutation = useCreateProductVariantMutation(businessId, productId);
  const deleteVariantMutation = useDeleteProductVariantMutation(businessId, productId);
  const updateVariantMutation = useUpdateProductVariantMutation(businessId, productId);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categoryRemapDisposersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    return () => {
      for (const d of categoryRemapDisposersRef.current) d();
      categoryRemapDisposersRef.current = [];
    };
  }, []);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("ea");
  const [description, setDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [costStr, setCostStr] = useState("");
  const [stockAlertStr, setStockAlertStr] = useState("0");
  const [initialQuantityStr, setInitialQuantityStr] = useState("0");
  const [trackStock, setTrackStock] = useState(false);
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
  const [initialQuantityError, setInitialQuantityError] = useState("");

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
    setStockAlertStr("0");
    setInitialQuantityStr("0");
    setTrackStock(false);
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
    setUnit(canonicalUnitValue(product.unit || "ea"));
    setDescription(product.description ?? "");
    setPriceStr(minorUnitsToMajorDecimalString(product.priceCents, currency));
    setCostStr(
      product.costCents != null
        ? minorUnitsToMajorDecimalString(product.costCents, currency)
        : "",
    );
    setStockAlertStr(String(product.stockAlert));
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

  const createCategoryFromPicker = useCallback(
    (suggestedName: string) => {
      const n = suggestedName.trim();
      if (!n) {
        toast.show({ variant: "danger", label: "Enter a category name" });
        return;
      }
      if (!businessId) return;
      createCategoryMutation.mutate(
        { name: n },
        {
          onSuccess: (row) => {
            setCategoryId(row.id);
            categoryRemapDisposersRef.current.push(
              subscribeCategoryLocalIdRemap(row.id, (serverId) => {
                setCategoryId((c) => (c === row.id ? serverId : c));
              }),
            );
          },
          onError: (e) => {
            toast.show({ variant: "danger", label: errorMessage(e) });
          },
        },
      );
    },
    [businessId, createCategoryMutation, toast],
  );

  const unitPickerOptions = useMemo((): SearchablePickerOption[] => {
    const trimmed = unit.trim();
    if (!trimmed || isPresetUnitValue(trimmed)) return UNIT_PRESET_OPTIONS;
    return [
      {
        value: trimmed,
        label: `${trimmed} · Custom`,
        searchText: trimmed,
      },
      ...UNIT_PRESET_OPTIONS,
    ];
  }, [unit]);

  const saving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    createVariantMutation.isPending ||
    deleteVariantMutation.isPending ||
    updateVariantMutation.isPending ||
    createCategoryMutation.isPending;

  const onSave = useCallback(() => {
    setNameError("");
    setPriceError("");
    setCostError("");
    setInitialQuantityError("");
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
    const stockAlertParsed = Number.parseInt(stockAlertStr, 10);
    const stockAlert =
      Number.isFinite(stockAlertParsed) && stockAlertParsed >= 0 ? stockAlertParsed : 0;
    const initialQuantity = !isEdit && trackStock
      ? parseNonNegativeWholeNumber(initialQuantityStr)
      : 0;
    if (!isEdit && trackStock && initialQuantity == null) {
      setInitialQuantityError("Enter a valid stock quantity");
      return;
    }

    if (!businessId) return;

    if (isEdit && productId) {
      updateMutation.mutate(
        {
          name: n,
          categoryId,
          sku: sku.trim() === "" ? null : sku.trim(),
          unit: canonicalUnitValue(unit),
          description: description.trim() === "" ? null : description.trim(),
          priceCents,
          ...(costTrim === "" ? { costCents: null } : { costCents: costCents as number }),
          stockAlert,
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
        unit: canonicalUnitValue(unit),
        stockAlert,
        trackStock,
        active,
      };
      if (categoryId) createPayload.categoryId = categoryId;
      if (sku.trim()) createPayload.sku = sku.trim();
      if (description.trim()) createPayload.description = description.trim();
      if (typeof costCents === "number") createPayload.costCents = costCents;
      if (trackStock && typeof initialQuantity === "number" && initialQuantity > 0) {
        createPayload.initialQuantity = initialQuantity;
      }
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
    stockAlertStr,
    initialQuantityStr,
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
    return <BrandedLoading />;
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
    return <BrandedLoading message="Loading product…" />;
  }

  if (isEdit && productQuery.isError && !product) {
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
    <KeyboardAvoidingScaffold className="bg-background">
      <StatusBar style="light" />
      <View style={styles.fill}>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={10}
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-white/20 active:bg-white/30"
            >
              <Ionicons name="chevron-back" size={24} color={accentFg} />
            </Pressable>
            <Text
              className="min-w-0 flex-1 text-center text-[24px] font-black tracking-tighter"
              style={{ color: accentFg }}
              numberOfLines={1}
            >
              {isEdit ? "Edit Product" : "New Product"}
            </Text>
            <View className="h-11 w-11" />
          </View>
        </View>

        {!networkOnline ? (
          <View className="bg-muted px-3 py-2">
            <Text className="text-center text-[13px] leading-[18px] text-foreground">
              Offline — catalog changes are saved on this device and sync when you are back online.
            </Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.fill}
          keyboardShouldPersistTaps="handled"
          overScrollMode="never"
          alwaysBounceVertical={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 24,
          }}
        >
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
                createCategoryFromPicker(suggestedName);
              }}
              createFromQueryLabel={(q) => `Create category “${q}”`}
              onEmptyOptions={() => {
                createCategoryFromPicker("New category");
              }}
              emptyOptionsLabel="Create category"
            />

            <View className="gap-1.5">
              <Text className="text-[15px] font-bold text-foreground ml-1">Name *</Text>
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
                <Text className="text-[13px] font-medium text-danger ml-1">{nameError}</Text>
              ) : null}
            </View>

            <View className="gap-1.5">
              <Text className="text-[15px] font-bold text-foreground ml-1">SKU</Text>
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

            <SearchablePickerSheet
              fieldLabel="Unit"
              placeholder="Select unit"
              title="Unit"
              searchPlaceholder="Search presets or type a custom unit…"
              options={unitPickerOptions}
              selectedValue={canonicalUnitValue(unit)}
              onSelect={(v) => setUnit(canonicalUnitValue(v))}
              onCreateFromQuery={(q) => setUnit(canonicalUnitValue(q))}
              createFromQueryLabel={(q) => `Use “${q}”`}
            />

            <View className="gap-1.5">
              <Text className="text-[15px] font-bold text-foreground ml-1">Description</Text>
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
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1.5">
                <Text className="text-[15px] font-bold text-foreground ml-1">
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
                  <Text className="text-[13px] font-medium text-danger ml-1">{priceError}</Text>
                ) : null}
              </View>
              <View className="flex-1 gap-1.5">
                <Text className="text-[15px] font-bold text-foreground ml-1">
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
                  <Text className="text-[13px] font-medium text-danger ml-1">{costError}</Text>
                ) : null}
              </View>
            </View>
          </FormSectionCard>

          <FormSectionCard title="Inventory & status">
            <View className="flex-row items-center justify-between py-2 px-1">
              <Text className="text-[16px] font-bold text-foreground">Active</Text>
              <Switch isSelected={active} onSelectedChange={setActive} />
            </View>

            <View className="flex-row items-center justify-between py-3 px-1 mt-2 border-t border-border/40">
              <Text className="text-[16px] font-bold text-foreground">Track stock</Text>
              <Switch isSelected={trackStock} onSelectedChange={setTrackStock} />
            </View>

            {trackStock ? (
              isEdit && product ? (
                product.variants.length > 0 ? (
                  <View className="gap-3 mt-2">
                  <Text className="text-[14px] font-medium leading-5 text-muted ml-1">
                    Each variant has its own price and stock.
                  </Text>
                  {product.variants.map((v: ProductVariantRow) => (
                    <View
                      key={v.id}
                      className="rounded-[20px] bg-background/50 p-4"
                    >
                      <View className="flex-row items-start justify-between gap-2">
                        <View className="min-w-0 flex-1">
                          <Text
                            className="text-[17px] font-bold text-foreground tracking-tight"
                            numberOfLines={2}
                          >
                            {v.name}
                          </Text>
                          <Text className="mt-1 text-[15px] font-medium text-muted">
                            {formatMinorUnitsToCurrency(v.priceCents, currency)}
                            {v.sku ? ` · SKU ${v.sku}` : ""}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
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
                            className="h-10 w-10 items-center justify-center rounded-full bg-accent/10 active:bg-accent/20"
                          >
                            <Ionicons name="create" size={20} color={accent} />
                          </Pressable>
                          <Pressable
                            onPress={() => onDeleteVariant(v.id, v.name)}
                            hitSlop={8}
                            className="h-10 w-10 items-center justify-center rounded-full bg-danger/10 active:bg-danger/20"
                          >
                            <Ionicons name="trash" size={20} color={danger} />
                          </Pressable>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => openStockSheet(v.id)}
                        className="mt-4 rounded-[16px] bg-surface px-4 py-3.5 active:opacity-80 shadow-sm"
                      >
                        <Text className="text-[12px] font-bold uppercase tracking-widest text-muted">
                          Available to sell
                        </Text>
                        <View className="flex-row items-baseline justify-between mt-1">
                          <Text className="text-[24px] font-black tabular-nums tracking-tight text-foreground">
                            {v.quantityOnHand}
                          </Text>
                          <Text className="text-[13px] font-bold text-accent">Tap to adjust</Text>
                        </View>
                      </Pressable>
                    </View>
                  ))}
                  <View className="gap-3 rounded-[20px] border-2 border-dashed border-border/40 bg-background/30 p-4 mt-2">
                    <Text className="text-[15px] font-bold text-foreground">Add variant</Text>
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
                      className="mt-1"
                      onPress={onCreateVariant}
                      isDisabled={createVariantMutation.isPending}
                    >
                      <Button.Label className="font-bold text-[15px]">Add variant</Button.Label>
                    </Button>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => openStockSheet(null)}
                  className="rounded-[20px] bg-background/50 px-4 py-4 active:opacity-80 mt-2"
                >
                  <Text className="text-[12px] font-bold uppercase tracking-widest text-muted">
                    Available to sell
                  </Text>
                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-[32px] font-black tabular-nums tracking-tighter text-foreground">
                      {product.quantityOnHand}
                    </Text>
                    <View className="bg-accent/10 px-3 py-1.5 rounded-full">
                      <Text className="text-[13px] font-bold text-accent">Tap to adjust</Text>
                    </View>
                  </View>
                </Pressable>
              )
            ) : (
              <View className="gap-1.5 mt-2">
                <Text className="text-[15px] font-bold text-foreground ml-1">
                  Initial stock
                </Text>
                <Text className="text-[13px] font-medium text-muted ml-1 mb-1">
                  Start this product with stock on its first save. You can adjust it later.
                </Text>
                <TextField className="gap-0">
                  <Input
                    value={initialQuantityStr}
                    onChangeText={setInitialQuantityStr}
                    placeholder="0"
                    keyboardType="number-pad"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
                {initialQuantityError ? (
                  <Text className="text-[13px] font-medium text-danger ml-1">
                    {initialQuantityError}
                  </Text>
                ) : null}
                <Text className="text-[13px] font-medium text-muted ml-1 mt-1">
                  Variants can be added after the product is saved.
                </Text>
              </View>
            )
            ) : null}

            {trackStock ? (
              <View className="gap-1.5 pt-3 mt-2 border-t border-border/40">
                <Text className="text-[15px] font-bold text-foreground ml-1">Stock alert</Text>
                <Text className="text-[13px] font-medium text-muted ml-1 mb-1">
                  You are alerted when on-hand quantity is at or below this level.
                </Text>
                <TextField className="gap-0">
                  <Input
                    value={stockAlertStr}
                    onChangeText={setStockAlertStr}
                    placeholder="0"
                    keyboardType="number-pad"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
              </View>
            ) : null}
          </FormSectionCard>
        </View>
        </ScrollView>

        <View
          className="border-t border-border/40 bg-background px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {isEdit ? (
            <Button
              variant="secondary"
              className="mb-3 border-danger/20 bg-danger/10"
              onPress={onDelete}
              isDisabled={saving}
            >
              <Button.Label style={{ color: danger }} className="font-bold text-[16px]">
                Delete product
              </Button.Label>
            </Button>
          ) : null}
          <Button className="w-full h-[56px] rounded-full" onPress={onSave} isDisabled={saving}>
            <Button.Label className="font-black text-[17px] tracking-tight text-accent-foreground">
              {saving ? "Saving…" : "Save Product"}
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

    </KeyboardAvoidingScaffold>
  );
}
