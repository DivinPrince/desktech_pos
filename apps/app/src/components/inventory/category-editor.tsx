import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import { APIError } from "@repo/sdk";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  useBusinessesQuery,
  useCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
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

type CategoryEditorProps = {
  categoryId?: string;
  /** Prefill name on the “new category” screen (e.g. from picker “create” action). */
  suggestedName?: string;
};

export function CategoryEditor({ categoryId, suggestedName }: CategoryEditorProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const accent = useThemeColor("accent");
  const fg = useThemeColor("foreground");
  const danger = useThemeColor("danger");

  const isEdit = Boolean(categoryId);

  const { data: session } = authClient.useSession();
  const user = (session as SessionPayload | null | undefined)?.user;
  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const businessId = businessesQuery.data?.[0]?.id;

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

  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sortStr, setSortStr] = useState("0");
  const [nameError, setNameError] = useState("");
  const [sortError, setSortError] = useState("");

  const hydratedIdRef = useRef<string | null>(null);

  useEffect(() => {
    hydratedIdRef.current = null;
  }, [categoryId]);

  useEffect(() => {
    if (!isEdit) {
      setParentId(null);
      setName(suggestedName?.trim() ?? "");
      setSortStr("0");
    }
  }, [isEdit, suggestedName]);

  useEffect(() => {
    if (!isEdit) return;
    if (!editingCategory) return;
    if (hydratedIdRef.current === editingCategory.id) return;
    hydratedIdRef.current = editingCategory.id;
    setName(editingCategory.name);
    setSortStr(String(editingCategory.sortOrder));
    setParentId(editingCategory.parentId);
  }, [isEdit, editingCategory]);

  const parentLeadingOptions = useMemo((): SearchablePickerOption[] => {
    return [
      {
        value: "",
        label: "None (top level)",
        searchText: "none top level root",
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

  const parentLabel =
    parentId == null
      ? "Top level"
      : (categories.find((c) => c.id === parentId)?.name ?? "Unknown parent");

  const saving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const onSave = useCallback(() => {
    setNameError("");
    setSortError("");
    const n = name.trim();
    if (!n) {
      setNameError("Name is required");
      return;
    }
    const sortParsed = Number.parseInt(sortStr, 10);
    if (!Number.isFinite(sortParsed)) {
      setSortError("Enter a valid sort order");
      return;
    }

    if (!businessId) return;

    if (isEdit && categoryId) {
      updateMutation.mutate(
        {
          name: n,
          parentId,
          sortOrder: sortParsed,
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
        sortOrder: sortParsed,
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
    sortStr,
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

  if (isEdit && categoriesQuery.isPending && !editingCategory) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={accent} />
      </View>
    );
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
          {isEdit ? "Edit category" : "New category"}
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
        <FormSectionCard title="Details">
          <SelectInputTrigger
            label="Parent category"
            displayValue={parentLabel}
            placeholder="Select parent (optional)"
            onPress={() => setParentPickerOpen(true)}
          />

          <View className="gap-1">
            <Text className="text-[14px] font-medium text-foreground">Name *</Text>
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
              <Text className="text-[13px] text-danger">{nameError}</Text>
            ) : null}
          </View>

          <View className="gap-1">
            <Text className="text-[14px] font-medium text-foreground">Sort order</Text>
            <TextField className="gap-0">
              <Input
                value={sortStr}
                onChangeText={setSortStr}
                placeholder="0"
                keyboardType="number-pad"
                variant="secondary"
                className={INPUT_ROW_CLASS}
              />
            </TextField>
            <Text className="text-[12px] text-muted">
              Lower numbers appear first in lists.
            </Text>
            {sortError ? (
              <Text className="text-[13px] text-danger">{sortError}</Text>
            ) : null}
          </View>
        </FormSectionCard>
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
              Delete category
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
        visible={parentPickerOpen}
        title="Parent category"
        searchPlaceholder="Search or type a new parent name…"
        leadingOptions={parentLeadingOptions}
        options={parentPickerOptions}
        selectedValue={parentId ?? ""}
        onSelect={(v) => setParentId(v === "" ? null : v)}
        onClose={() => setParentPickerOpen(false)}
        onCreateFromQuery={(suggested) => {
          router.push({
            pathname: "/items/category/new",
            params: { suggestName: suggested },
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
