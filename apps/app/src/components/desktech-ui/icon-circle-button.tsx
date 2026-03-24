import React, { type ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";

type IconCircleButtonProps = {
  children: ReactNode;
  onPress?: PressableProps["onPress"];
  accessibilityLabel: string;
  variant?: "outline" | "filled";
};

export function IconCircleButton({
  children,
  onPress,
  accessibilityLabel,
  variant = "outline",
}: IconCircleButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={
        variant === "filled"
          ? "h-11 w-11 items-center justify-center rounded-xl bg-foreground active:opacity-80"
          : "h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface active:bg-accent/10"
      }
    >
      <View>{children}</View>
    </Pressable>
  );
}
