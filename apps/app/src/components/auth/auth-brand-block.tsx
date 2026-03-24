import React from "react";
import { Platform, Text, View } from "react-native";

import { AUTH_INK, AUTH_INK_MUTED } from "./auth-theme";

type AuthBrandBlockProps = {
  tagline: string;
};

export function AuthBrandBlock({ tagline }: AuthBrandBlockProps) {
  return (
    <View className="items-center px-1">
      <Text
        className="text-[1.875rem] font-bold"
        style={{
          color: AUTH_INK,
          fontFamily: Platform.select({
            ios: "Georgia",
            android: "serif",
            default: "serif",
          }),
        }}
      >
        Desktech
      </Text>
      <Text
        className="mt-2 max-w-[272px] text-center text-[15px] leading-snug"
        style={{ color: AUTH_INK_MUTED }}
      >
        {tagline}
      </Text>
    </View>
  );
}
