import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { paymentDisplayForKey } from "@/lib/counter-checkout/payment-options";
import { cartLineKey } from "@/lib/counter-cart/counter-cart";
import type { CounterSaleRow } from "@/lib/data/sales/types";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { formatSaleCompletedAt } from "@/lib/format-sale-completed-at";

export const COUNTER_SALE_CARD_CLASS =
  "mb-3 overflow-hidden rounded-[24px] border border-border/40 bg-surface";

function customerHasDetails(r: CounterSaleRow["receipt"]): boolean {
  const c = r.customer;
  return (
    c.name.trim().length > 0 ||
    c.phone.trim().length > 0 ||
    c.email.trim().length > 0 ||
    c.address.trim().length > 0
  );
}

export type CounterSaleCardProps = {
  item: CounterSaleRow;
  expanded: boolean;
  onToggle: () => void;
  businessCurrency: string;
  muted: string;
};

export function CounterSaleCard({
  item,
  expanded,
  onToggle,
  businessCurrency,
  muted,
}: CounterSaleCardProps) {
  const r = item.receipt;
  const timeLabel = formatSaleCompletedAt(r.completedAtIso);
  const paymentUi = paymentDisplayForKey(r.paymentMethodKey);

  return (
    <View className={COUNTER_SALE_CARD_CLASS}>
      <Pressable
        onPress={onToggle}
        className="flex-row items-center py-4 px-4 active:bg-foreground/5"
      >
        <View
          className="h-11 w-11 rounded-full items-center justify-center"
          style={{ backgroundColor: `${paymentUi.iconHex}20` }}
        >
          <Ionicons name={paymentUi.icon} size={20} color={paymentUi.iconHex} />
        </View>
        <View className="flex-1 ml-3 pr-2">
          <Text className="text-[15px] font-bold text-foreground" numberOfLines={1}>
            {r.paymentMethodLabel}
          </Text>
          <Text className="text-[13px] font-medium text-muted mt-0.5" numberOfLines={1}>
            {timeLabel}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-[16px] font-black text-foreground tabular-nums tracking-tight">
            {formatMinorUnitsToCurrency(r.totalCents, r.currency || businessCurrency)}
          </Text>
          <View className="h-6 w-6 items-center justify-center rounded-full bg-muted/10">
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={muted} />
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <View className="border-t border-border/40 px-4 pb-4 pt-4 bg-background/30">
          {r.lines.length === 0 ? (
            <Text className="text-[14px] font-medium text-muted">No items</Text>
          ) : (
            <View className="gap-3">
              {r.lines.map((line, lineIdx) => (
                <View
                  key={`${cartLineKey(line)}-${lineIdx}`}
                  className="flex-row items-start justify-between gap-3"
                >
                  <Text
                    className="min-w-0 flex-1 text-[14px] font-medium leading-5 text-foreground"
                    numberOfLines={3}
                  >
                    {line.name}
                    <Text className="text-muted font-normal">
                      {" "}
                      ×{line.quantity}
                    </Text>
                  </Text>
                  <Text className="pt-0.5 text-[14px] font-bold tabular-nums text-foreground">
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
            <Text className="mt-4 text-[14px] font-medium text-muted" numberOfLines={4}>
              {r.paymentNote}
            </Text>
          ) : null}
          {customerHasDetails(r) ? (
            <View className="mt-4 gap-1.5 border-t border-border/40 pt-4">
              <View className="flex-row items-center gap-2 mb-1">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-muted/10">
                  <Ionicons name="person" size={12} color={muted} />
                </View>
                <Text className="text-[12px] font-bold uppercase tracking-widest text-muted">
                  Customer
                </Text>
              </View>
              {r.customer.name.trim().length > 0 ? (
                <Text className="text-[15px] font-bold text-foreground">{r.customer.name}</Text>
              ) : null}
              {r.customer.phone.trim().length > 0 ? (
                <Text className="text-[14px] font-medium text-muted">
                  {r.customer.dialCode}
                  {r.customer.phone}
                </Text>
              ) : null}
              {r.customer.email.trim().length > 0 ? (
                <Text className="text-[14px] font-medium text-muted" numberOfLines={2}>
                  {r.customer.email}
                </Text>
              ) : null}
              {r.customer.address.trim().length > 0 ? (
                <Text className="text-[14px] font-medium text-muted" numberOfLines={3}>
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
