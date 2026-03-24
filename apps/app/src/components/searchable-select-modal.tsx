import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export type SearchableSelectItem = {
  value: string;
  title: string;
  subtitle?: string;
  searchText: string;
};

type SearchableSelectModalProps = {
  visible: boolean;
  title: string;
  searchPlaceholder: string;
  items: SearchableSelectItem[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

const SEARCH_INPUT_CLASS =
  "border-0 border-transparent bg-transparent rounded-xl py-3 px-4 text-[15px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

export function SearchableSelectModal({
  visible,
  title,
  searchPlaceholder,
  items,
  selectedValue,
  onSelect,
  onClose,
}: SearchableSelectModalProps) {
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.searchText.includes(q));
  }, [items, query]);

  const onPick = useCallback(
    (value: string) => {
      onSelect(value);
      onClose();
    },
    [onSelect, onClose],
  );

  const renderItem = useCallback(
    ({ item }: { item: SearchableSelectItem }) => {
      const selected = item.value === selectedValue;
      return (
        <Pressable
          onPress={() => onPick(item.value)}
          className="border-b border-border px-4 py-3.5 active:bg-accent/10"
        >
          <Text
            className={`text-[15px] leading-5 ${selected ? "font-semibold text-accent" : "text-foreground"}`}
          >
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text className="mt-0.5 text-[13px] text-muted">
              {item.subtitle}
            </Text>
          ) : null}
        </Pressable>
      );
    },
    [onPick, selectedValue],
  );

  const keyExtractor = useCallback((item: SearchableSelectItem) => item.value, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background" style={styles.fill}>
        <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
          <View className="flex-row items-center border-b border-border px-2 py-2">
            <View className="min-w-[88px] shrink-0 items-start justify-center">
              <Pressable
                onPress={onClose}
                hitSlop={12}
                className="flex-row items-center gap-0.5 px-2 py-2"
              >
                <Ionicons name="chevron-back" size={22} color={accentColor} />
                <Text className="text-[17px] text-accent">Back</Text>
              </Pressable>
            </View>
            <View className="min-w-0 flex-1 items-center justify-center px-1">
              <Text
                className="text-center text-[17px] font-semibold text-foreground"
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
            <View className="min-w-[88px] shrink-0" />
          </View>

          <View className="px-4 pt-3 pb-2">
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              variant="secondary"
              className={SEARCH_INPUT_CLASS}
            />
          </View>

          <FlatList
            style={styles.fill}
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={16}
            windowSize={10}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: Math.max(insets.bottom, 16),
            }}
            ListEmptyComponent={
              <Text className="px-4 pt-6 text-center text-[15px] text-muted">
                No matches
              </Text>
            }
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
