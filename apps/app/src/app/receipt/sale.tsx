import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RichReceipt } from "@/components/receipt/rich-receipt";
import { ReceiptActionButtons } from "@/components/receipt/receipt-action-buttons";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";
import {
  getSaleReceiptExtras,
  hydrateSaleReceiptExtras,
  mergeReceiptExtras,
} from "@/lib/data/sales/receipt-extras";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";
import { useSaleDetailQuery } from "@/lib/queries/business-sales";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

function normalizeSaleId(raw: string | string[] | undefined): string | undefined {
  if (raw == null) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

export default function ReceiptSaleScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams<{ saleId?: string | string[] }>();
  const saleId = normalizeSaleId(params.saleId);
  const muted = useThemeColor("muted");
  const foreground = useThemeColor("foreground");
  const statusBarStyle = colorScheme === "dark" ? "light" : "dark";

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);
  const businessesQuery = useBusinessesQuery(signedIn);
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const businessId = currentBusiness?.id;
  const businessCurrency = currentBusiness?.currency ?? "USD";
  const saleIdTrim = saleId?.trim() ?? "";
  const enabled = Boolean(signedIn && businessId && saleIdTrim);

  const detail = useSaleDetailQuery(businessId, saleIdTrim || undefined, enabled, {
    currency: businessCurrency,
    businessName: currentBusiness?.name,
  });

  const [receipt, setReceipt] = useState<CompletedSaleReceipt | null>(null);

  useFocusEffect(
    useCallback(() => {
      void hydrateSaleReceiptExtras();
      void detail.refetch();
    }, [detail.refetch]),
  );

  useEffect(() => {
    void (async () => {
      await hydrateSaleReceiptExtras();
      const base = detail.counterRow?.receipt;
      if (!base) {
        setReceipt(null);
        return;
      }
      const extras = await getSaleReceiptExtras(base.saleId);
      setReceipt(mergeReceiptExtras(base, extras));
    })();
  }, [detail.counterRow, detail.sale]);

  const loading = detail.isLoading && !detail.counterRow;
  const loadError =
    !loading && enabled && !detail.counterRow
      ? "Receipt not found"
      : !saleIdTrim
        ? "Missing sale"
        : !businessId
          ? "No workspace"
          : null;

  const onBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/dashboard");
  }, [router]);

  return (
    <View style={styles.fill} className="bg-background">
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <View className="flex-row items-center gap-2 border-b border-border/60 px-2 pb-3 pt-1">
          <Pressable
            onPress={onBack}
            hitSlop={12}
            className="h-11 w-11 items-center justify-center rounded-xl active:opacity-75"
          >
            <Ionicons name="chevron-back" size={26} color={foreground} />
          </Pressable>
          <Text className="flex-1 text-[17px] font-semibold text-foreground" numberOfLines={1}>
            Receipt
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center py-16">
            <ActivityIndicator />
          </View>
        ) : loadError || !receipt ? (
          <View className="flex-1 items-center justify-center px-6 py-16">
            <Ionicons name="document-text-outline" size={40} color={muted} />
            <Text className="mt-4 text-center text-[16px] font-semibold text-foreground">
              {loadError ?? "Receipt unavailable"}
            </Text>
            <Text className="mt-2 text-center text-[14px] text-muted">
              Open a sale from Today or Receipts, or pull to refresh after syncing.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.fill}
              contentContainerStyle={{
                flexGrow: 1,
                flexDirection: "column",
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 28,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <RichReceipt
                receipt={receipt}
                businessCurrency={businessCurrency}
                expandVertically
              />
            </ScrollView>
            <View className="border-t border-border/60 px-4 pb-6 pt-4">
              <ReceiptActionButtons receipt={receipt} />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
