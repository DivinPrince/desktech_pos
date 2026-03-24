import React from "react";
import { Text, View } from "react-native";

type SummaryRowProps = {
  label: string;
  value: string;
  variant?: "default" | "danger" | "emphasis";
};

/** Ticket or tender summary line: label left, amount right. */
export function SummaryRow({
  label,
  value,
  variant = "default",
}: SummaryRowProps) {
  const valueClass =
    variant === "danger"
      ? "text-danger"
      : variant === "emphasis"
        ? "text-lg font-bold text-foreground"
        : "text-foreground";

  return (
    <View className="flex-row items-center justify-between gap-3 py-1.5">
      <Text className="text-[15px] text-muted">{label}</Text>
      <Text className={`text-right text-[15px] ${valueClass}`}>{value}</Text>
    </View>
  );
}
