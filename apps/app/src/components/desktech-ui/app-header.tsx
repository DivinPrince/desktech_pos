import React, { type ReactNode } from "react";
import { Text, View } from "react-native";

type AppHeaderProps = {
  greeting: string;
  /** e.g. first name */
  name: string;
  avatar?: ReactNode;
  trailing?: ReactNode;
};

/**
 * Home-style header: optional avatar slot, greeting line, name, trailing actions.
 */
export function AppHeader({
  greeting,
  name,
  avatar,
  trailing,
}: AppHeaderProps) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1">
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        {avatar}
        <View className="min-w-0">
          <Text className="text-[13px] text-muted">{greeting}</Text>
          <Text
            className="text-xl font-bold text-foreground"
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>
      </View>
      {trailing ? (
        <View className="flex-row items-center gap-2">{trailing}</View>
      ) : null}
    </View>
  );
}
