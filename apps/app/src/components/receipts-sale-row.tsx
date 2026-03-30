import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import { paymentDisplayForKey } from "@/lib/counter-checkout/payment-options";
import type { LocalCounterSaleRow } from "@/lib/data/local-counter-sales/types";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { formatSaleCompletedAt } from "@/lib/format-sale-completed-at";

import { LOCAL_COUNTER_SALE_CARD_CLASS } from "@/components/local-counter-sale-card";

export type ReceiptsSaleRowProps = {
  item: LocalCounterSaleRow;
  businessCurrency: string;
  muted: string;
};

/** Receipts tab: one tap opens the full receipt screen (no expand/collapse). */
export function ReceiptsSaleRow({ item, businessCurrency, muted }: ReceiptsSaleRowProps) {
  const router = useRouter();
  const r = item.receipt;

  const openReceipt = useCallback(() => {
    router.push({ pathname: "/receipt/sale", params: { saleId: item.id } });
  }, [router, item.id]);

  const timeLabel = formatSaleCompletedAt(r.completedAtIso);
  const paymentUi = paymentDisplayForKey(r.paymentMethodKey);

  return (
    <View className={LOCAL_COUNTER_SALE_CARD_CLASS}>
      <Pressable
        onPress={openReceipt}
        accessibilityRole="button"
        accessibilityLabel={`Open receipt, ${r.paymentMethodLabel}, ${formatMinorUnitsToCurrency(r.totalCents, r.currency || businessCurrency)}`}
        className="flex-row items-center gap-3.5 px-3.5 py-4 active:opacity-90"
      >
        <View className="h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/70">
          <Ionicons name={paymentUi.icon} size={22} color={paymentUi.iconHex} />
        </View>
        <View className="min-w-0 flex-1 pr-1">
          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {r.paymentMethodLabel}
          </Text>
          <Text className="mt-1 text-[12px] tabular-nums text-muted" numberOfLines={1}>
            {timeLabel}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[16px] font-semibold tabular-nums text-foreground">
            {formatMinorUnitsToCurrency(r.totalCents, r.currency || businessCurrency)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={muted} />
        </View>
      </Pressable>
    </View>
  );
}
