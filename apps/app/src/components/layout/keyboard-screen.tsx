import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from "react-native-safe-area-context";

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

type KeyboardScreenProps = {
  children: ReactNode;
  edges?: readonly Edge[];
  extraBottomPadding?: number;
  scrollContentStyle?: ViewStyle | ViewStyle[];
  keyboardVerticalOffset?: number;
  scrollProps?: Omit<ScrollViewProps, "style" | "contentContainerStyle">;
};

/**
 * Shared screen scaffold for form-heavy mobile flows.
 * Keeps SafeAreaView / KeyboardAvoidingView / ScrollView on explicit flex styles,
 * which is required in this app because Uniwind className flex can collapse there.
 */
export function KeyboardScreen({
  children,
  edges = ["top", "left", "right"],
  extraBottomPadding = 8,
  scrollContentStyle,
  keyboardVerticalOffset = 0,
  scrollProps,
}: KeyboardScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.fill} edges={edges}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[
            {
              flexGrow: 1,
              paddingBottom: Math.max(insets.bottom, 20) + extraBottomPadding,
            },
            scrollContentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
