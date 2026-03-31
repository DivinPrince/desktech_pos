import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native/hooks";
import React, { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KeyboardAvoidingScaffold } from "@/components/desktech-ui";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export function CheckoutSubscreenShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const fg = useThemeColor("foreground");

  return (
    <View style={styles.fill} className="bg-background">
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <KeyboardAvoidingScaffold>
          <View className="flex-row items-center gap-2 border-b border-border/35 px-3 py-3.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={onBack}
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={26} color={fg} />
            </Pressable>
            <Text
              className="min-w-0 flex-1 text-[18px] font-semibold text-foreground"
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          <ScrollView
            style={styles.fill}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 28,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingScaffold>
      </SafeAreaView>
    </View>
  );
}
