import { Ionicons } from "@expo/vector-icons";
import React, { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useThemeColor } from "heroui-native/hooks";

type ProductPreviewCardProps = {
  name: string;
  priceLabel: string;
  image?: ReactNode;
  /** Pin/unpin on the quick-keys grid (register home). */
  onPinPress?: () => void;
  pinned?: boolean;
  onDetailPress?: () => void;
};

/**
 * Sell-screen tile: photo/placeholder, price, optional quick-key pin, open details.
 */
export function ProductPreviewCard({
  name,
  priceLabel,
  image,
  onPinPress,
  pinned,
  onDetailPress,
}: ProductPreviewCardProps) {
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const warning = useThemeColor("warning");

  return (
    <View className="rounded-3xl border border-border bg-surface shadow-surface">
      <View className="relative aspect-[4/3] w-full items-center justify-center rounded-t-3xl bg-surface-secondary">
        {image ?? (
          <Ionicons name="image-outline" size={48} color={accent} />
        )}
        <View className="absolute left-3 top-3 rounded-xl bg-surface/95 px-2.5 py-1">
          <Text className="text-[13px] font-bold text-foreground">
            {priceLabel}
          </Text>
        </View>
        {onPinPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              pinned ? "Remove from quick keys" : "Add to quick keys"
            }
            hitSlop={8}
            onPress={onPinPress}
            className="absolute right-2 top-2 h-9 w-9 items-center justify-center rounded-full bg-surface/90 active:opacity-80"
          >
            <Ionicons
              name={pinned ? "pin" : "pin-outline"}
              size={20}
              color={pinned ? warning : accent}
            />
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between gap-2 p-3">
        <Text
          className="min-w-0 flex-1 text-[16px] font-semibold text-foreground"
          numberOfLines={2}
        >
          {name}
        </Text>
        {onDetailPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Item details"
            onPress={onDetailPress}
            className="h-10 w-10 items-center justify-center rounded-full bg-accent active:opacity-90"
          >
            <Ionicons name="arrow-forward" size={20} color={accentFg} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
