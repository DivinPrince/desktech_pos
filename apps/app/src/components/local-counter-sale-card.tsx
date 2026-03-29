import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { paymentDisplayForKey } from "@/lib/counter-checkout/payment-options";
import type { LocalCounterSaleRow } from "@/lib/data/local-counter-sales/types";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";

export const LOCAL_COUNTER_SALE_CARD_CLASS =
  "mb-2 overflow-hidden rounded-2xl border border-border/75 bg-surface";

function customerHasDetails(r: LocalCounterSaleRow["receipt"]): boolean {
  const c = r.customer;
  return (
    c.name.trim().length > 0 ||
    c.phone.trim().length > 0 ||
    c.email.trim().length > 0 ||
    c.address.trim().length > 0
  );
}

/** Local row id from offline checkout before outbox replay (`pending:<idempotencyKey>`). */
export function isPendingSyncSaleId(saleId: string): boolean {
  return saleId.startsWith("pending:");
}

export type LocalCounterSaleCardProps = {
  item: LocalCounterSaleRow;
  expanded: boolean;
  onToggle: () => void;
  businessCurrency: string;
  muted: string;
};

export function LocalCounterSaleCard({
  item,
  expanded,
  onToggle,
  businessCurrency,
  muted,
}: LocalCounterSaleCardProps) {
  const r = item.receipt;
  const timeLabel = new Date(r.completedAtIso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const paymentUi = paymentDisplayForKey(r.paymentMethodKey);

  return (
    <View className={LOCAL_COUNTER_SALE_CARD_CLASS}>
      <Pressable
        onPress={onToggle}
        className="flex-row items-center gap-3.5 px-3 py-3.5 active:opacity-90"
      >
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/70">
          <Ionicons name={paymentUi.icon} size={22} color={paymentUi.iconHex} />
        </View>
        <View className="min-w-0 flex-1 pr-1">
          <Text className="text-[15px] font-semibold tabular-nums text-foreground">{timeLabel}</Text>
          <Text className="mt-0.5 text-[13px] text-muted" numberOfLines={1}>
            {r.paymentMethodLabel}
          </Text>
          {isPendingSyncSaleId(item.id) ? (
            <Text className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Sync pending — use “Retry server sync” above for details
            </Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[16px] font-semibold tabular-nums text-foreground">
            {formatMinorUnitsToCurrency(r.totalCents, r.currency || businessCurrency)}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={muted} />
        </View>
      </Pressable>
      {expanded ? (
        <View className="border-t border-border/75 px-3 pb-3.5 pt-3">
          {r.lines.length === 0 ? (
            <Text className="text-[13px] text-muted">No items</Text>
          ) : (
            <View className="gap-2.5">
              {r.lines.map((line) => (
                <View key={line.productId} className="flex-row items-start justify-between gap-3">
                  <Text
                    className="min-w-0 flex-1 text-[14px] leading-5 text-foreground"
                    numberOfLines={3}
                  >
                    {line.name}
                    <Text className="text-muted">
                      {" "}
                      ×{line.quantity}
                    </Text>
                  </Text>
                  <Text className="pt-0.5 text-[14px] font-semibold tabular-nums text-foreground">
                    {formatMinorUnitsToCurrency(
                      line.priceCents * line.quantity,
                      r.currency || businessCurrency,
                    )}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {r.paymentNote.trim().length > 0 ? (
            <Text className="mt-3 text-[13px] text-muted" numberOfLines={4}>
              {r.paymentNote}
            </Text>
          ) : null}
          {customerHasDetails(r) ? (
            <View className="mt-3 gap-1 border-t border-border/50 pt-3">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="person-outline" size={15} color={muted} />
                <Text className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Customer
                </Text>
              </View>
              {r.customer.name.trim().length > 0 ? (
                <Text className="text-[14px] font-medium text-foreground">{r.customer.name}</Text>
              ) : null}
              {r.customer.phone.trim().length > 0 ? (
                <Text className="text-[13px] text-muted">
                  {r.customer.dialCode}
                  {r.customer.phone}
                </Text>
              ) : null}
              {r.customer.email.trim().length > 0 ? (
                <Text className="text-[13px] text-muted" numberOfLines={2}>
                  {r.customer.email}
                </Text>
              ) : null}
              {r.customer.address.trim().length > 0 ? (
                <Text className="text-[13px] text-muted" numberOfLines={3}>
                  {r.customer.address}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
