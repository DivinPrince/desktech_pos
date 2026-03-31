import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import { APIError } from "@repo/sdk";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BrandedLoading,
  FormSectionCard,
  KeyboardAvoidingScaffold,
  SearchablePickerSheet,
  type SearchablePickerOption,
} from "@/components/desktech-ui";
import { subscribeCategoryLocalIdRemap } from "@/lib/data/catalog/category-reconcile";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { useNetworkReachable } from "@/lib/hooks/use-network-reachable";
import {
  useBusinessesQuery,
  useCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
} from "@/lib/queries/business-catalog";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-background/50 rounded-[16px] py-3.5 px-4 text-[16px] font-medium leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

type CategoryEditorProps = {
  categoryId?: string;
  /** Prefill name on the “new category” screen (e.g. from picker “create” action). */
  suggestedName?: string;
};

export function CategoryEditor({ categoryId, suggestedName }: CategoryEditorProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const networkOnline = useNetworkReachable();
  const { toast } = useToast();
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const danger = useThemeColor("danger");

  const isEdit = Boolean(categoryId);

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const businessId = resolveActiveBusiness(session, businessesQuery.data)?.id;

  const categoriesQuery = useCategoriesQuery(businessId, Boolean(businessId));
  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );

  const editingCategory = useMemo(
    () => (categoryId ? categories.find((c) => c.id === categoryId) : undefined),
    [categories, categoryId],
  );

  const createMutation = useCreateCategoryMutation(businessId);
  const updateMutation = useUpdateCategoryMutation(businessId, categoryId);
  const deleteMutation = useDeleteCategoryMutation(businessId);

  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");

  const hydratedIdRef = useRef<string | null>(null);
  const parentRemapDisposersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    return () => {
      for (const d of parentRemapDisposersRef.current) d();
      parentRemapDisposersRef.current = [];
    };
  }, []);

  useEffect(() => {
    hydratedIdRef.current = null;
  }, [categoryId]);

  useEffect(() => {
    if (!isEdit) {
      setParentId(null);
      setName(suggestedName?.trim() ?? "");
    }
  }, [isEdit, suggestedName]);

  useEffect(() => {
    if (!isEdit) return;
    if (!editingCategory) return;
    if (hydratedIdRef.current === editingCategory.id) return;
    hydratedIdRef.current = editingCategory.id;
    setName(editingCategory.name);
    setParentId(editingCategory.parentId);
  }, [isEdit, editingCategory]);

  const parentLeadingOptions = useMemo((): SearchablePickerOption[] => {
    return [
      {
        value: "",
        label: "None",
        searchText: "none no parent root",
      },
    ];
  }, []);

  const parentPickerOptions = useMemo((): SearchablePickerOption[] => {
    return categories
      .filter((c) => c.id !== categoryId)
      .map((c) => ({
        value: c.id,
        label: c.name,
        searchText: c.name.toLowerCase(),
      }));
  }, [categories, categoryId]);

  const createParentFromPicker = useCallback(
    (suggestedName: string) => {
      const n = suggestedName.trim();
      if (!n) {
        toast.show({ variant: "danger", label: "Enter a parent category name" });
        return;
      }
      if (!businessId) return;
      createMutation.mutate(
        { name: n, sortOrder: 0 },
        {
          onSuccess: (row) => {
            setParentId(row.id);
            parentRemapDisposersRef.current.push(
              subscribeCategoryLocalIdRemap(row.id, (serverId) => {
                setParentId((c) => (c === row.id ? serverId : c));
              }),
            );
          },
          onError: (e) => {
            toast.show({ variant: "danger", label: errorMessage(e) });
          },
        },
      );
    },
    [businessId, createMutation, toast],
  );

  const saving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const onSave = useCallback(() => {
    setNameError("");
    const n = name.trim();
    if (!n) {
      setNameError("Name is required");
      return;
    }

    if (!businessId) return;

    if (isEdit && categoryId) {
      updateMutation.mutate(
        {
          name: n,
          parentId,
        },
        {
          onSuccess: () => {
            toast.show({ variant: "success", label: "Category updated" });
            router.back();
          },
          onError: (e) => {
            toast.show({ variant: "danger", label: errorMessage(e) });
          },
        },
      );
    } else {
      const body: {
        name: string;
        parentId?: string;
        sortOrder: number;
      } = {
        name: n,
        sortOrder: 0,
      };
      if (parentId) body.parentId = parentId;
      createMutation.mutate(body, {
        onSuccess: () => {
          toast.show({ variant: "success", label: "Category created" });
          router.back();
        },
        onError: (e) => {
          toast.show({ variant: "danger", label: errorMessage(e) });
        },
      });
    }
  }, [
    name,
    parentId,
    businessId,
    isEdit,
    categoryId,
    createMutation,
    updateMutation,
    router,
    toast,
  ]);

  const onDelete = useCallback(() => {
    if (!categoryId || !businessId) return;
    Alert.alert(
      "Delete category",
      "Cannot delete if products or child categories exist.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(categoryId, {
              onSuccess: () => {
                toast.show({ variant: "success", label: "Category deleted" });
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
  }, [categoryId, businessId, deleteMutation, router, toast]);

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

  if (isEdit && categoriesQuery.isPending && !editingCategory) {
    return <BrandedLoading message="Loading category…" />;
  }

  if (isEdit && categoriesQuery.isSuccess && categoryId && !editingCategory) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-muted">Category not found.</Text>
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
            {isEdit ? "Edit Category" : "New Category"}
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
          paddingBottom: Math.max(insets.bottom, 20) + 88,
        }}
      >
        <FormSectionCard title="Details">
          <SearchablePickerSheet
            fieldLabel="Parent category"
            placeholder="Select parent (optional)"
            title="Parent category"
            searchPlaceholder="Search or type a new parent name…"
            leadingOptions={parentLeadingOptions}
            options={parentPickerOptions}
            selectedValue={parentId ?? ""}
            onSelect={(v) => setParentId(v === "" ? null : v)}
            onCreateFromQuery={(suggested) => {
              createParentFromPicker(suggested);
            }}
            createFromQueryLabel={(q) => `Create category “${q}”`}
            onEmptyOptions={() => {
              createParentFromPicker("New category");
            }}
            emptyOptionsLabel="Create category"
          />

          <View className="gap-1.5">
            <Text className="text-[15px] font-bold text-foreground ml-1">Name *</Text>
            <TextField className="gap-0">
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Category name"
                variant="secondary"
                className={INPUT_ROW_CLASS}
              />
            </TextField>
            {nameError ? (
              <Text className="text-[13px] font-medium text-danger ml-1">{nameError}</Text>
            ) : null}
          </View>
        </FormSectionCard>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border/40 bg-background px-4 pt-4"
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
              Delete category
            </Button.Label>
          </Button>
        ) : null}
        <Button className="w-full h-[56px] rounded-full" onPress={onSave} isDisabled={saving}>
          <Button.Label className="font-black text-[17px] tracking-tight text-accent-foreground">
            {saving ? "Saving…" : "Save Category"}
          </Button.Label>
        </Button>
      </View>

    </KeyboardAvoidingScaffold>
  );
}
