import { useThemeColor } from "heroui-native/hooks";
import React from "react";
import { Text, View } from "react-native";

type HeaderAvatarProps = {
  initials: string;
  /** Resolved color string; defaults to theme accent */
  backgroundColor?: string;
};

export function HeaderAvatar({ initials, backgroundColor }: HeaderAvatarProps) {
  const accent = useThemeColor("accent");
  const onAccent = useThemeColor("accent-foreground");
  const bg = backgroundColor ?? accent;

  return (
    <View
      className="h-11 w-11 items-center justify-center rounded-full"
      style={{ backgroundColor: bg }}
    >
      <Text
        className="text-[15px] font-bold"
        style={{ color: onAccent }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
