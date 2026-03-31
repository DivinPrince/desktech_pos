import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type KeyboardAvoidingViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export type KeyboardAvoidingScaffoldProps = Omit<
  KeyboardAvoidingViewProps,
  "behavior" | "style"
> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

/**
 * KeyboardAvoidingView with `style={{ flex: 1 }}` — Uniwind `className="flex-1"` is unreliable here (see AGENTS.md).
 */
export function KeyboardAvoidingScaffold({
  children,
  style,
  className,
  keyboardVerticalOffset = 0,
  ...rest
}: KeyboardAvoidingScaffoldProps) {
  return (
    <KeyboardAvoidingView
      {...rest}
      className={className}
      style={[styles.fill, style]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
