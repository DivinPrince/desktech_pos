import { Button } from "heroui-native/button";
import { SearchField } from "heroui-native/search-field";
import { Select, useSelect } from "heroui-native/select";
import { Separator } from "heroui-native/separator";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

export type SearchablePickerOption = {
  value: string;
  label: string;
  subtitle?: string;
  /** Extra text used for search matching; defaults to label + subtitle */
  searchText?: string;
};

type SelectValue = { value: string; label: string };

export type SearchablePickerSheetProps = {
  /** Label shown above the trigger (form variant) or inside the trigger (onboarding variant). */
  fieldLabel: string;
  placeholder: string;
  /** Heading inside the popover panel. */
  title: string;
  searchPlaceholder?: string;
  options: SearchablePickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  leadingOptions?: SearchablePickerOption[];
  onCreateFromQuery?: (trimmedQuery: string) => void;
  createFromQueryLabel?: (query: string) => string;
  onEmptyOptions?: () => void;
  emptyOptionsLabel?: string;
  /** `form`: labeled row like other editors. `onboarding`: compact labeled row for the setup surface. */
  variant?: "form" | "onboarding";
};

function optionHaystack(o: SearchablePickerOption): string {
  const base = o.searchText ?? `${o.label} ${o.subtitle ?? ""}`;
  return base.toLowerCase();
}

function matchesQuery(o: SearchablePickerOption, q: string): boolean {
  if (!q) return true;
  return optionHaystack(o).includes(q);
}

function CreateFromQuerySection({
  query,
  label,
  onCreateFromQuery,
}: {
  query: string;
  label: string;
  onCreateFromQuery: (trimmed: string) => void;
}) {
  const { onOpenChange } = useSelect();
  const trimmed = query.trim();
  return (
    <View className="border-t border-border/80 px-3 py-4">
      <Text className="text-center text-[15px] text-muted">No matches for “{trimmed}”</Text>
      <Button
        className="mt-3"
        onPress={() => {
          onOpenChange(false);
          onCreateFromQuery(trimmed);
        }}
      >
        <Button.Label className="font-semibold text-accent-foreground">{label}</Button.Label>
      </Button>
    </View>
  );
}

function EmptyOptionsSection({
  label,
  onEmptyOptions,
}: {
  label: string;
  onEmptyOptions: () => void;
}) {
  const { onOpenChange } = useSelect();
  return (
    <View className="border-t border-border/80 px-3 py-6">
      <Text className="text-center text-[15px] text-muted">Nothing to choose yet.</Text>
      <Button
        className="mt-3"
        onPress={() => {
          onOpenChange(false);
          onEmptyOptions();
        }}
      >
        <Button.Label className="font-semibold text-accent-foreground">{label}</Button.Label>
      </Button>
    </View>
  );
}

/**
 * Searchable single-select using Hero UI `Select` with **popover** presentation (not bottom sheet).
 */
export function SearchablePickerSheet({
  fieldLabel,
  placeholder,
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
  variant = "form",
}: SearchablePickerSheetProps) {
  const [query, setQuery] = useState("");
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

  const selectedOption = useMemo((): SelectValue | undefined => {
    const all = [...leadingOptions, ...options];
    const hit = all.find((o) => o.value === selectedValue);
    if (hit) return { value: hit.value, label: hit.label };
    return undefined;
  }, [leadingOptions, options, selectedValue]);

  const showCreateFromQuery =
    Boolean(onCreateFromQuery) && q.length > 0 && rows.length === 0;
  const showEmptyOptionsCta =
    Boolean(onEmptyOptions) &&
    options.length === 0 &&
    leadingOptions.length === 0 &&
    q.length === 0;

  return (
    <Select
      presentation="popover"
      value={selectedOption}
      onValueChange={(v) => {
        if (v && typeof v === "object" && "value" in v && v.value !== undefined) {
          onSelect(String(v.value));
        }
      }}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      {variant === "form" ? (
        <View className="gap-1.5">
          <Text className="text-[15px] font-bold text-foreground ml-1">{fieldLabel}</Text>
          <Select.Trigger
            variant="unstyled"
            className="flex-row items-center rounded-[16px] border-0 bg-background/50 px-4 py-3.5 shadow-none active:opacity-80"
          >
            <Select.Value
              placeholder={placeholder}
              className="min-w-0 flex-1 text-[16px] font-medium leading-5 text-field-foreground"
            />
            <Select.TriggerIndicator />
          </Select.Trigger>
        </View>
      ) : (
        <Select.Trigger
          variant="unstyled"
          className="flex-row items-center justify-between py-3.5 pl-4 pr-3 active:bg-accent/10"
        >
          <View className="min-w-0 flex-1 pr-2">
            <Text className="text-[13px] text-muted">{fieldLabel}</Text>
            <Select.Value
              placeholder={placeholder}
              className="mt-0.5 text-[15px] leading-5 text-foreground"
            />
          </View>
          <Select.TriggerIndicator />
        </Select.Trigger>
      )}

      <Select.Portal>
        <Select.Overlay />
        <Select.Content
          presentation="popover"
          placement="bottom"
          align="center"
          width="trigger"
        >
          <Select.ListLabel className="mb-2">{title}</Select.ListLabel>
          <View className="px-1 pb-2">
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
            <CreateFromQuerySection
              query={query}
              label={createFromQueryLabel(query.trim())}
              onCreateFromQuery={onCreateFromQuery}
            />
          ) : showEmptyOptionsCta && onEmptyOptions ? (
            <EmptyOptionsSection label={emptyOptionsLabel} onEmptyOptions={onEmptyOptions} />
          ) : (
            <ScrollView
              style={{ maxHeight: 320 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {rows.length === 0 ? (
                <Text className="px-2 py-6 text-center text-[15px] text-muted">
                  {q.length === 0 ? "No options" : "No matches"}
                </Text>
              ) : (
                rows.map((item, index) => (
                  <React.Fragment key={item.value === "" ? "__none__" : item.value}>
                    {index > 0 ? <Separator className="bg-border/80" /> : null}
                    {item.subtitle ? (
                      <Select.Item value={item.value} label={item.label}>
                        <View className="flex-1">
                          <Select.ItemLabel />
                          <Select.ItemDescription>{item.subtitle}</Select.ItemDescription>
                        </View>
                        <Select.ItemIndicator />
                      </Select.Item>
                    ) : (
                      <Select.Item value={item.value} label={item.label} />
                    )}
                  </React.Fragment>
                ))
              )}
            </ScrollView>
          )}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
