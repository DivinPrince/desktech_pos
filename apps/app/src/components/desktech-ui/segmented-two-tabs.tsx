import * as Haptics from "expo-haptics";
import { useThemeColor } from "heroui-native/hooks";
import React from "react";
import { Pressable, Text, View } from "react-native";

export type SegmentedTabId = string;

type TabDef = {
  id: SegmentedTabId;
  label: string;
};

type SegmentedTwoTabsProps = {
  tabs: [TabDef, TabDef];
  value: SegmentedTabId;
  onChange: (id: SegmentedTabId) => void;
  className?: string;
};

/**
 * Two-pill segmented control (e.g. Products / Categories).
 */
export function SegmentedTwoTabs({
  tabs,
  value,
  onChange,
  className = "",
}: SegmentedTwoTabsProps) {
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const muted = useThemeColor("muted");

  return (
    <View
      className={`flex-row rounded-full bg-surface-secondary p-1.5 ${className}`}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (tab.id !== value) {
                void Haptics.selectionAsync();
                onChange(tab.id);
              }
            }}
            className="min-w-0 flex-1 rounded-full py-3 active:opacity-90"
            style={
              selected
                ? { backgroundColor: accent, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
                : { backgroundColor: "transparent" }
            }
          >
            <Text
              className={`text-center text-[15px] ${selected ? "font-bold" : "font-medium"}`}
              style={{ color: selected ? accentFg : muted }}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
