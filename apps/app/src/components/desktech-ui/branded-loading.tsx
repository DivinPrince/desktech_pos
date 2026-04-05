import Constants from "expo-constants";
import { useThemeColor } from "heroui-native/hooks";
import React from "react";
import {
  ActivityIndicator,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const APP_NAME = Constants.expoConfig?.name ?? "Desktech";

export type BrandedLoadingProps = {
  /** Optional caption below the spinner (fullscreen / embedded), or beside it (inline). */
  message?: string;
  /**
   * - `fullscreen`: centered, flex-1, for gates and full-screen boots (wordmark + spinner, optional message).
   * - `embedded`: compact block for scroll regions or modals.
   * - `inline`: spinner + message for lists (no wordmark).
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
    if (!message) return null;
    return (
      <View
        className={`flex-row flex-wrap items-center justify-center gap-x-2 gap-y-1 ${className}`}
        style={style}
      >
        <ActivityIndicator color={accent} />
        <Text className="text-center text-[15px] leading-5 text-muted">{message}</Text>
      </View>
    );
  }

  const rootClass =
    variant === "fullscreen"
      ? "flex-1 items-center justify-center bg-background px-6"
      : "items-center justify-center py-8 px-4";

  return (
    <View className={`${rootClass} ${className}`} style={style}>
      {variant === "fullscreen" ? (
        <Text className="mb-5 text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-muted">
          {APP_NAME}
        </Text>
      ) : null}
      <ActivityIndicator
        color={accent}
        size={variant === "fullscreen" ? "large" : "small"}
        style={{ marginBottom: message ? 14 : 0 }}
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
