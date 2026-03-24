import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { useThemeColor } from "heroui-native/hooks";

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

export function QuantityStepper({
  value,
  min = 0,
  max = 99,
  onChange,
  disabled = false,
}: QuantityStepperProps) {
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");

  const dec = () => {
    if (disabled) return;
    onChange(Math.max(min, value - 1));
  };
  const inc = () => {
    if (disabled) return;
    onChange(Math.min(max, value + 1));
  };

  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        disabled={disabled || value <= min}
        onPress={dec}
        className="h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface active:bg-accent/10 disabled:opacity-40"
      >
        <Ionicons name="remove" size={18} color={muted} />
      </Pressable>
      <Text className="min-w-[28px] text-center text-base font-semibold text-foreground">
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={disabled || value >= max}
        onPress={inc}
        className="h-9 w-9 items-center justify-center rounded-lg active:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: accent }}
      >
        <Ionicons name="add" size={18} color={accentFg} />
      </Pressable>
    </View>
  );
}
