import { Image } from "expo-image";
import React from "react";
import {
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/** Same artwork as `expo-splash-screen` in app.json for a consistent cold start → in-app handoff. */
const BRAND_MARK = require("../../../assets/images/splash-icon-light.png");

export type BrandedLoadingProps = {
  /** Optional caption below the logo (fullscreen / embedded), or standalone text (inline). */
  message?: string;
  /**
   * - `fullscreen`: centered, flex-1, for gates and full-screen boots (logo only, optional message).
   * - `embedded`: compact block for scroll regions or modals.
   * - `inline`: message-only line for lists (no duplicate logo).
   */
  variant?: "fullscreen" | "embedded" | "inline";
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function BrandedLoading({
  message,
  variant = "fullscreen",
  className = "",
  style,
}: BrandedLoadingProps) {
  if (variant === "inline") {
    if (!message) return null;
    return (
      <View className={`items-center justify-center ${className}`} style={style}>
        <Text className="text-center text-[15px] leading-5 text-muted">
          {message}
        </Text>
      </View>
    );
  }

  const logoSize = variant === "fullscreen" ? 96 : 56;
  const rootClass =
    variant === "fullscreen"
      ? "flex-1 items-center justify-center bg-background px-6"
      : "items-center justify-center py-8 px-4";

  return (
    <View className={`${rootClass} ${className}`} style={style}>
      <Image
        source={BRAND_MARK}
        style={{
          width: logoSize,
          height: logoSize,
          marginBottom: message ? 12 : 0,
        }}
        contentFit="contain"
      />
      {message ? (
        <Text
          className={`text-center text-[15px] leading-5 text-muted ${
            variant === "embedded" ? "max-w-[280px]" : "max-w-[320px]"
          }`}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
