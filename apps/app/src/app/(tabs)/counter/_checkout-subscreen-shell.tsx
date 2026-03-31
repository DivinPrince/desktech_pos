import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native/hooks";
import { StatusBar } from "expo-status-bar";
import React, { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.fill} className="bg-background">
      <StatusBar style="light" />
      <View
        style={{
          backgroundColor: accent,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 24,
          paddingHorizontal: 16,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <View className="flex-row items-center justify-between gap-2 py-1 mb-2 mt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={onBack}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/20 active:bg-white/30"
          >
            <Ionicons name="chevron-back" size={24} color={accentFg} />
          </Pressable>
          <Text
            className="min-w-0 flex-1 text-center text-[24px] font-black tracking-tighter"
            style={{ color: accentFg }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View className="h-11 w-11" />
        </View>
      </View>

      <SafeAreaView style={styles.fill} edges={["left", "right", "bottom"]}>
        <KeyboardAvoidingScaffold>
          <ScrollView
            style={styles.fill}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 24,
              paddingBottom: 40,
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
