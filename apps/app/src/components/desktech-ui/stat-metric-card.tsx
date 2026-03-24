import React, { type ReactNode } from "react";
import { Text, View } from "react-native";

type StatMetricCardProps = {
  label: string;
  value: string;
  sublabel?: string;
  leading?: ReactNode;
  className?: string;
};

/** Small bento metric tile (tickets, net sales, voids, etc.). */
export function StatMetricCard({
  label,
  value,
  sublabel,
  leading,
  className = "",
}: StatMetricCardProps) {
  return (
    <View
      className={`min-w-0 flex-1 rounded-2xl border border-border bg-surface p-3 ${className}`}
    >
      {leading}
      <Text className="text-[12px] text-muted">{label}</Text>
      <Text
        className="mt-1 text-xl font-bold text-foreground"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {sublabel ? (
        <Text className="mt-0.5 text-[11px] text-muted">{sublabel}</Text>
      ) : null}
    </View>
  );
}
