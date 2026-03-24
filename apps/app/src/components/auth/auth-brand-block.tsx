import React from "react";
import { Platform, Text, View } from "react-native";

type AuthBrandBlockProps = {
  tagline: string;
};

export function AuthBrandBlock({ tagline }: AuthBrandBlockProps) {
  return (
    <View className="items-center px-1">
      <Text
        className="text-[1.875rem] font-bold text-foreground"
        style={{
          fontFamily: Platform.select({
            ios: "Georgia",
            android: "serif",
            default: "serif",
          }),
        }}
      >
        Desktech
      </Text>
      <Text className="mt-2 max-w-[272px] text-center text-[15px] leading-snug text-muted">
        {tagline}
      </Text>
    </View>
  );
}
