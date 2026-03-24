import React from "react";
import { Text, View } from "react-native";

type ColorSwatchProps = {
  color: string;
  name: string;
  hex?: string;
  description?: string;
};

export function ColorSwatch({
  color,
  name,
  hex,
  description,
}: ColorSwatchProps) {
  return (
    <View className="min-w-[100px] flex-1">
      <View
        className="mb-2 h-14 w-full rounded-xl border border-border shadow-sm"
        style={{ backgroundColor: color }}
      />
      <Text className="text-[13px] font-semibold text-foreground">{name}</Text>
      {hex ? (
        <Text className="font-mono text-[11px] text-muted">{hex}</Text>
      ) : null}
      {description ? (
        <Text className="mt-0.5 text-[11px] leading-4 text-muted">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
