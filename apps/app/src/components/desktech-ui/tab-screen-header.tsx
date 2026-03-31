import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColor } from "heroui-native/hooks";

import { NavigationMenuTrigger } from "@/components/navigation/navigation-shell";

type TabScreenHeaderProps = {
  title: string;
  subtitle?: string | null;
  tertiaryText?: string | null;
  subtitleNumberOfLines?: number;
  tertiaryNumberOfLines?: number;
};

export function TabScreenHeader({
  title,
  subtitle,
  tertiaryText,
  subtitleNumberOfLines = 2,
  tertiaryNumberOfLines = 2,
}: TabScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");

  return (
    <View
      style={{
        backgroundColor: accent,
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: 14,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <NavigationMenuTrigger iconColor={accentFg} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: accentFg, fontSize: 22, fontWeight: "700" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 14,
                marginTop: 4,
              }}
              numberOfLines={subtitleNumberOfLines}
            >
              {subtitle}
            </Text>
          ) : null}
          {tertiaryText ? (
            <Text
              style={{
                color: "rgba(255,255,255,0.72)",
                fontSize: 13,
                marginTop: 4,
              }}
              numberOfLines={tertiaryNumberOfLines}
            >
              {tertiaryText}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
