import { Ionicons } from "@expo/vector-icons";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { SearchField } from "heroui-native/search-field";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: "88%",
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 120,
  },
});

export type SearchablePickerOption = {
  value: string;
  label: string;
  subtitle?: string;
  /** Extra text used for search matching; defaults to label + subtitle */
  searchText?: string;
};

export type SearchablePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  searchPlaceholder?: string;
  /** Primary list (e.g. categories, tags, staff). */
  options: SearchablePickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  /**
   * Rows shown first (e.g. “None / Uncategorized”). Filtered by search like `options`.
   */
  leadingOptions?: SearchablePickerOption[];
  /**
   * When the user typed something and nothing matches, show a primary action
   * (e.g. open a create screen with the query as the default name).
   */
  onCreateFromQuery?: (trimmedQuery: string) => void;
  /** Default: Create “{query}” */
  createFromQueryLabel?: (query: string) => string;
  /**
   * When `options` is empty, search is empty, and there are no leading matches —
   * optional CTA (e.g. “Create first category”).
   */
  onEmptyOptions?: () => void;
  emptyOptionsLabel?: string;
};

function optionHaystack(o: SearchablePickerOption): string {
  const base = o.searchText ?? `${o.label} ${o.subtitle ?? ""}`;
  return base.toLowerCase();
}

function matchesQuery(o: SearchablePickerOption, q: string): boolean {
  if (!q) return true;
  return optionHaystack(o).includes(q);
}

/**
 * Reusable bottom-sheet style picker: search field + list + optional “create from query”.
 * Not the full-screen login-style modal.
 */
export function SearchablePickerSheet({
  visible,
  onClose,
  title,
  searchPlaceholder = "Search…",
  options,
  selectedValue,
  onSelect,
  leadingOptions = [],
  onCreateFromQuery,
  createFromQueryLabel = (query) => `Create “${query}”`,
  onEmptyOptions,
  emptyOptionsLabel = "Create new",
}: SearchablePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const surface = useThemeColor("surface");

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const q = query.trim().toLowerCase();

  const filteredLeading = useMemo(
    () => leadingOptions.filter((o) => matchesQuery(o, q)),
    [leadingOptions, q],
  );

  const filteredOptions = useMemo(
    () => options.filter((o) => matchesQuery(o, q)),
    [options, q],
  );

  const rows = useMemo(
    () => [...filteredLeading, ...filteredOptions],
    [filteredLeading, filteredOptions],
  );

  const showCreateFromQuery =
    Boolean(onCreateFromQuery) && q.length > 0 && rows.length === 0;

  const showEmptyOptionsCta =
    Boolean(onEmptyOptions) &&
    options.length === 0 &&
    leadingOptions.length === 0 &&
    q.length === 0;

  const onPick = useCallback(
    (value: string) => {
      onSelect(value);
      onClose();
    },
    [onSelect, onClose],
  );

  const renderItem = useCallback(
    ({ item }: { item: SearchablePickerOption }) => {
      const selected = item.value === selectedValue;
      return (
        <Pressable
          onPress={() => onPick(item.value)}
          className="border-b border-border/80 px-4 py-3.5 active:bg-accent/10"
        >
          <View className="flex-row items-center gap-3">
            <View className="min-w-0 flex-1">
              <Text
                className={`text-[16px] leading-snug ${selected ? "font-semibold text-accent" : "text-foreground"}`}
                numberOfLines={2}
              >
                {item.label}
              </Text>
              {item.subtitle ? (
                <Text className="mt-0.5 text-[13px] text-muted" numberOfLines={2}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            {selected ? (
              <Ionicons name="checkmark-circle" size={22} color={accent} />
            ) : null}
          </View>
        </Pressable>
      );
    },
    [onPick, selectedValue, accent],
  );

  const keyExtractor = useCallback((item: SearchablePickerOption) => item.value, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Dismiss"
        />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: surface,
            },
          ]}
          className="rounded-t-[24px] border-t border-border shadow-lg"
        >
          <View className="items-center pt-2 pb-1">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
            <Text className="text-[12px] font-semibold uppercase tracking-wide text-muted">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="rounded-full p-2 active:bg-accent/10"
            >
              <Ionicons name="close" size={22} color={muted} />
            </Pressable>
          </View>

          <View className="px-3 pb-3">
            <SearchField
              value={query}
              onChange={setQuery}
              className="rounded-2xl bg-surface-secondary shadow-none"
            >
              <SearchField.Group className="min-h-[48px] rounded-2xl px-1">
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={searchPlaceholder}
                  className="rounded-2xl border-0 bg-transparent py-3 text-[15px] text-field-foreground shadow-none"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </View>

          {showCreateFromQuery && onCreateFromQuery ? (
            <View className="border-t border-border/80 px-4 py-5">
              <Text className="text-center text-[15px] text-muted">
                No matches for “{query.trim()}”
              </Text>
              <Button
                className="mt-4"
                onPress={() => {
                  const t = query.trim();
                  onClose();
                  onCreateFromQuery(t);
                }}
              >
                <Button.Label className="font-semibold text-accent-foreground">
                  {createFromQueryLabel(query.trim())}
                </Button.Label>
              </Button>
            </View>
          ) : showEmptyOptionsCta && onEmptyOptions ? (
            <View className="border-t border-border/80 px-4 py-8">
              <Text className="text-center text-[15px] text-muted">
                Nothing to choose yet.
              </Text>
              <Button className="mt-4" onPress={() => { onClose(); onEmptyOptions(); }}>
                <Button.Label className="font-semibold text-accent-foreground">
                  {emptyOptionsLabel}
                </Button.Label>
              </Button>
            </View>
          ) : (
            <FlatList
              style={styles.list}
              data={rows}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              windowSize={10}
              ListEmptyComponent={
                q.length === 0 ? (
                  <Text className="px-4 py-8 text-center text-[15px] text-muted">
                    No options
                  </Text>
                ) : (
                  <Text className="px-4 py-8 text-center text-[15px] text-muted">
                    No matches
                  </Text>
                )
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
