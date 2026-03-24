import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { Switch } from "heroui-native/switch";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import { APIError } from "@repo/sdk";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  SelectInputTrigger,
  type SearchablePickerOption,
} from "@/components/desktech-ui";
import { authClient } from "@/lib/auth-client";
import type { SessionPayload } from "@/lib/auth-session";
import {
  minorUnitsToMajorDecimalString,
  parseMajorUnitsToMinorUnits,
} from "@/lib/format-money";
import {
  type ProductCreateBody,
  useBusinessesQuery,
  useCategoriesQuery,
  useCreateProductMutation,
  useDeleteProductMutation,
  useProductQuery,
  useUpdateProductMutation,
} from "@/lib/queries/business-catalog";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-transparent rounded-xl py-2.5 px-3 text-[15px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

type ProductEditorProps = {
  productId?: string;
};

export function ProductEditor({ productId }: ProductEditorProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const fg = useThemeColor("foreground");
  const danger = useThemeColor("danger");

  const isEdit = Boolean(productId);

  const { data: session } = authClient.useSession();
  const user = (session as SessionPayload | null | undefined)?.user;
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const businessId = businessesQuery.data?.[0]?.id;
  const currency = businessesQuery.data?.[0]?.currency ?? "USD";

  const categoriesQuery = useCategoriesQuery(businessId, Boolean(businessId));
  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );

  const productQuery = useProductQuery(businessId, productId, isEdit);
  const product = productQuery.data;

  const createMutation = useCreateProductMutation(businessId);
  const updateMutation = useUpdateProductMutation(businessId, productId);
  const deleteMutation = useDeleteProductMutation(businessId);

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
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

  const [nameError, setNameError] = useState("");
  const [priceError, setPriceError] = useState("");
  const [costError, setCostError] = useState("");

  const hydratedIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    hydratedIdRef.current = null;
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
    if (hydratedIdRef.current === product.id) return;
    hydratedIdRef.current = product.id;
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

  const categoryLabel =
    categoryId == null
      ? "Uncategorized"
      : (categories.find((c) => c.id === categoryId)?.name ?? "Unknown category");

  const saving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

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

  if (!signedIn || businessesQuery.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={accent} />
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

  if (isEdit && (productQuery.isPending || productQuery.isFetching) && !product) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={accent} />
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
    <KeyboardAvoidingView
      style={styles.fill}
      className="bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        className="flex-row items-center border-b border-border px-2 py-2"
        style={{ paddingTop: Math.max(insets.top, 8) }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-accent/10"
        >
          <Ionicons name="chevron-back" size={26} color={fg} />
        </Pressable>
        <Text className="min-w-0 flex-1 text-center text-[17px] font-semibold text-foreground">
          {isEdit ? "Edit product" : "New product"}
        </Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        style={styles.fill}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 20) + 88,
        }}
      >
        <View className="gap-4">
          <FormSectionCard title="Basics">
            <SelectInputTrigger
              label="Category"
              displayValue={categoryLabel}
              placeholder="Select category"
              onPress={() => setCategoryPickerOpen(true)}
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

            <View>
              <Text className="mb-1.5 text-[14px] text-foreground">Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional notes"
                placeholderTextColor={muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="min-h-[100px] rounded-xl border border-border/80 bg-surface-secondary/50 px-3 py-2.5 text-[15px] text-foreground"
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
              <View className="rounded-xl bg-surface-secondary/50 px-3 py-3">
                <Text className="text-[12px] font-medium uppercase text-muted">
                  Quantity on hand
                </Text>
                <Text className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">
                  {product.quantityOnHand}
                </Text>
                <Text className="mt-1 text-[12px] text-muted">
                  Stock adjustments use the inventory API when available.
                </Text>
              </View>
            ) : null}

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
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-4 pt-3"
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

      <SearchablePickerSheet
        visible={categoryPickerOpen}
        title="Category"
        searchPlaceholder="Search categories or type a new name…"
        leadingOptions={categoryLeadingOptions}
        options={categoryPickerOptions}
        selectedValue={categoryId ?? ""}
        onSelect={(v) => setCategoryId(v === "" ? null : v)}
        onClose={() => setCategoryPickerOpen(false)}
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
    </KeyboardAvoidingView>
  );
}
