import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native/hooks";
import React from "react";
import { Pressable, Text, View } from "react-native";

export type SelectInputTriggerProps = {
  label: string;
  /** Shown inside the field; use empty string to show `placeholder`. */
  displayValue: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  errorMessage?: string;
};

/** Padding / typography aligned with HeroUI `Input` + `INPUT_ROW_CLASS` (borderless rows). */
const ROW_CLASS =
  "flex-row items-center rounded-xl border-0 bg-transparent px-3 py-2.5 shadow-none active:opacity-80";

/**
 * Select trigger that matches borderless `Input` rows on product/category editors.
 */
export function SelectInputTrigger({
  label,
  displayValue,
  placeholder,
  onPress,
  disabled = false,
  errorMessage,
}: SelectInputTriggerProps) {
  const fieldPlaceholder = useThemeColor("field-placeholder");
  const fg = useThemeColor("foreground");
  const muted = useThemeColor("muted");

  const trimmed = displayValue.trim();
  const showPlaceholder = trimmed.length === 0;

  return (
    <View className="gap-1">
      <Text className="text-[14px] font-medium text-foreground">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens list to choose an option"
        disabled={disabled}
        onPress={onPress}
        className={ROW_CLASS}
        style={{ opacity: disabled ? 0.55 : 1 }}
      >
        <Text
          className="min-w-0 flex-1 text-[15px] leading-5 text-field-foreground"
          style={{ color: showPlaceholder ? fieldPlaceholder : fg }}
          numberOfLines={1}
        >
          {showPlaceholder ? placeholder : displayValue}
        </Text>
        <Ionicons name="chevron-down" size={20} color={muted} />
      </Pressable>
      {errorMessage ? (
        <Text className="text-[13px] text-danger">{errorMessage}</Text>
      ) : null}
    </View>
  );
}
