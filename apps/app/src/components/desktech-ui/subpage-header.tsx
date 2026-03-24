import { Ionicons } from "@expo/vector-icons";
import React, { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useThemeColor } from "heroui-native/hooks";

type SubpageHeaderProps = {
  title: string;
  onBack?: () => void;
  trailing?: ReactNode;
};

export function SubpageHeader({ title, onBack, trailing }: SubpageHeaderProps) {
  const fg = useThemeColor("foreground");

  return (
    <View className="flex-row items-center justify-between gap-2 py-2">
      <View className="w-10 items-start">
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={onBack}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-accent/15"
          >
            <Ionicons name="chevron-back" size={26} color={fg} />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>
      <Text
        className="min-w-0 flex-1 text-center text-[17px] font-semibold text-foreground"
        numberOfLines={1}
      >
        {title}
      </Text>
      <View className="w-10 items-end">
        {trailing ?? <View className="h-10 w-10" />}
      </View>
    </View>
  );
}
