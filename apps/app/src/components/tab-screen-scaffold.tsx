import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native/hooks";
import React, { type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
});

type TabScreenScaffoldProps = {
  title: string;
  /** Rendered under the title (e.g. greeting). */
  belowTitle?: ReactNode;
  subtitle?: string;
  paragraphs: string[];
  /** Extra blocks after body copy (e.g. dev links). */
  children?: ReactNode;
};

/**
 * Tab scenes sit inside React Navigation’s bottom tabs. On Android, relying only
 * on uniwind `className` for ScrollView / flex can collapse the scroll area or
 * skip text color resolution—this scaffold uses explicit flex + theme colors.
 */
export function TabScreenScaffold({
  title,
  belowTitle,
  subtitle,
  paragraphs,
  children,
}: TabScreenScaffoldProps) {
  const foreground = useThemeColor("foreground");
  const muted = useThemeColor("muted");
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12) + 72;

  return (
    <View style={styles.root} className="bg-background">
      <StatusBar style="inverted" />
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: bottomPad,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              color: foreground,
              fontSize: 24,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          {belowTitle}
          {subtitle ? (
            <Text
              style={{
                color: muted,
                fontSize: 15,
                lineHeight: 22,
                marginTop: belowTitle ? 10 : 4,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
          {paragraphs.map((body, i) => (
            <Text
              key={i}
              style={{
                color: foreground,
                fontSize: 15,
                lineHeight: 24,
                marginTop: i === 0 ? 20 : 12,
              }}
            >
              {body}
            </Text>
          ))}
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
