import React, { type ReactNode } from "react";
import { Text, View } from "react-native";

type SectionHeaderProps = {
  title: string;
  description?: string;
  right?: ReactNode;
};

export function SectionHeader({
  title,
  description,
  right,
}: SectionHeaderProps) {
  return (
    <View className="mb-3 flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-lg font-bold text-foreground">{title}</Text>
        {description ? (
          <Text className="mt-1 text-[13px] leading-[18px] text-muted">
            {description}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
