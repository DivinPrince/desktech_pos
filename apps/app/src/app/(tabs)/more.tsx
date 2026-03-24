import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Card } from "heroui-native/card";
import { useThemeColor } from "heroui-native/hooks";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { TabScreenScaffold } from "@/components/tab-screen-scaffold";

export default function MoreTab() {
  const router = useRouter();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");

  return (
    <TabScreenScaffold
      title="More"
      subtitle="Settings and tools you do not need every minute."
      paragraphs={[
        "Open business profile, tax and receipt defaults, staff and permissions, printers and hardware, and integrations from one overflow area so the main tabs stay uncluttered.",
        "Help, legal, sign out, and app version will sit here as well—easy to find when you need them, out of the way when you do not.",
      ]}
    >
      <View className="mt-6 w-full max-w-[400] self-center">
        <Card className="overflow-hidden rounded-2xl border border-border shadow-surface">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open UI kit"
            onPress={() => router.push("/ui")}
            className="flex-row items-center justify-between p-4 active:bg-accent/10"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/15">
                <Ionicons
                  name="color-palette-outline"
                  size={22}
                  color={accent}
                />
              </View>
              <View>
                <Text className="text-base font-semibold text-foreground">
                  UI kit
                </Text>
                <Text className="text-[13px] text-muted">
                  POS components, colors, register patterns
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={muted} />
          </Pressable>
        </Card>
      </View>
    </TabScreenScaffold>
  );
}
