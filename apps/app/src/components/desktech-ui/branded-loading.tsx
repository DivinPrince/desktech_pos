import { Image } from "expo-image";
import { useThemeColor } from "heroui-native/hooks";
import React from "react";
import {
  ActivityIndicator,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/** Same artwork as `expo-splash-screen` in app.json for a consistent cold start → in-app handoff. */
const BRAND_MARK = require("../../../assets/images/splash-icon.png");

export type BrandedLoadingProps = {
  /** Shown below the spinner (omit for logo + spinner only). */
  message?: string;
  /**
   * - `fullscreen`: centered, flex-1, for gates and full-screen boots.
   * - `embedded`: compact block for scroll regions or modals.
   * - `inline`: single row, spinner + optional message (lists, footnotes).
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
  const accent = useThemeColor("accent");

  if (variant === "inline") {
    return (
      <View
        className={`flex-row items-center justify-center gap-2 ${className}`}
        style={style}
      >
        <ActivityIndicator color={accent} />
        {message ? (
          <Text className="text-[15px] text-muted">{message}</Text>
        ) : null}
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
          marginBottom: variant === "fullscreen" ? 16 : 10,
        }}
        contentFit="contain"
      />
      <ActivityIndicator
        color={accent}
        size={variant === "fullscreen" ? "large" : "small"}
      />
      {message ? (
        <Text
          className={`mt-4 text-center text-[15px] leading-5 text-muted ${
            variant === "embedded" ? "max-w-[280px]" : "max-w-[320px]"
          }`}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
