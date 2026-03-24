import React, { type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

export type CategoryRailItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

type CategoryRailProps = {
  items: CategoryRailItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
};

/**
 * Horizontal category picker: circular icon area + label (e.g. Meals · Drinks · Other).
 */
export function CategoryRail({
  items,
  selectedId,
  onSelect,
}: CategoryRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: "row",
        gap: 16,
        paddingRight: 8,
      }}
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => onSelect?.(item.id)}
            className="items-center active:opacity-80"
          >
            <View
              className={
                selected
                  ? "h-[56px] w-[56px] items-center justify-center rounded-full border-2 border-accent bg-surface"
                  : "h-[56px] w-[56px] items-center justify-center rounded-full border border-border bg-surface"
              }
            >
              {item.icon ?? (
                <View className="h-8 w-8 rounded-full bg-surface-tertiary" />
              )}
            </View>
            <Text
              className={`mt-1.5 max-w-[72px] text-center text-[12px] ${selected ? "font-semibold text-foreground" : "text-muted"}`}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
