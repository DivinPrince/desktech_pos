import { useThemeColor } from "heroui-native/hooks";
import { SearchField } from "heroui-native/search-field";
import { Select } from "heroui-native/select";
import { Separator } from "heroui-native/separator";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  countryDialByIso,
  getCountryDialList,
  type CountryDialEntry,
} from "@/lib/phone/country-dial-list";

export type CountryDialCodePickerProps = {
  selectedIso: string | undefined;
  dialCode: string;
  onSelect: (entry: CountryDialEntry) => void;
};

type CountryDialOption = {
  value: string;
  label: string;
  subtitle: string;
  searchText: string;
  flag: string;
};

function matchesQuery(o: CountryDialOption, q: string): boolean {
  if (!q) return true;
  return o.searchText.includes(q);
}

/**
 * Country calling code picker — same interaction model as onboarding
 * (`SearchablePickerSheet`): HeroUI Select **popover** + search + bounded ScrollView.
 */
export function CountryDialCodePicker({
  selectedIso,
  dialCode,
  onSelect,
}: CountryDialCodePickerProps) {
  const accent = useThemeColor("accent");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const allOptions = useMemo((): CountryDialOption[] => {
    return getCountryDialList().map((e) => ({
      value: e.iso,
      label: e.name,
      subtitle: `${e.iso} · ${e.dialDisplay}`,
      searchText: `${e.name} ${e.iso} ${e.dial} +${e.dial} ${e.dialDisplay}`.toLowerCase(),
      flag: e.flag,
    }));
  }, []);

  const rows = useMemo(
    () => allOptions.filter((o) => matchesQuery(o, q)),
    [allOptions, q],
  );

  const selectedDial = countryDialByIso(selectedIso);

  const selectValue = useMemo(
    () =>
      selectedIso
        ? {
            value: selectedIso,
            label: countryDialByIso(selectedIso)?.name ?? selectedIso,
          }
        : undefined,
    [selectedIso],
  );

  return (
    <Select
      presentation="popover"
      value={selectValue}
      onValueChange={(v: unknown) => {
        if (v === undefined || v === null || Array.isArray(v)) return;
        if (typeof v !== "object" || !("value" in v)) return;
        const value = (v as { value: string }).value;
        const entry = countryDialByIso(value);
        if (entry) onSelect(entry);
      }}
      onOpenChange={(open: boolean) => {
        if (!open) setQuery("");
      }}
    >
      <Select.Trigger
        variant="unstyled"
        accessibilityLabel="Choose country calling code"
        className="min-w-[100px] max-w-[40%] shrink-0 flex-row items-center justify-center gap-1 border-r border-border/40 px-2 py-2 active:opacity-80"
      >
        <Text className="text-[22px] leading-7" importantForAccessibility="no">
          {selectedDial?.flag ?? "\u{1f310}"}
        </Text>
        <Text className="text-[15px] font-black tabular-nums text-field-foreground">
          {dialCode.trim() || "+"}
        </Text>
        <Select.TriggerIndicator iconProps={{ size: 16, color: accent }} />
      </Select.Trigger>

      <Select.Portal>
        <Select.Overlay />
        <Select.Content
          presentation="popover"
          placement="bottom"
          align="start"
          className="min-w-[300px] max-w-[92vw]"
        >
          <Select.ListLabel className="mb-2">Country / region</Select.ListLabel>

          <View className="px-1 pb-2">
            <SearchField
              value={query}
              onChange={setQuery}
              className="rounded-2xl bg-surface-secondary shadow-none"
            >
              <SearchField.Group className="min-h-[48px] rounded-2xl px-1">
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder="Search country or code"
                  className="rounded-2xl border-0 bg-transparent py-3 text-[15px] text-field-foreground shadow-none"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </View>

          <ScrollView
            style={{ maxHeight: 320 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {rows.length === 0 ? (
              <Text className="px-2 py-6 text-center text-[15px] text-muted">
                {q.length === 0 ? "No countries" : "No matches"}
              </Text>
            ) : (
              rows.map((item, index) => (
                <React.Fragment key={item.value}>
                  {index > 0 ? <Separator className="bg-border/80" /> : null}
                  <Select.Item value={item.value} label={item.label}>
                    <View className="flex-row items-center gap-3 flex-1">
                      <Text
                        className="text-[22px] leading-7"
                        importantForAccessibility="no"
                      >
                        {item.flag}
                      </Text>
                      <View className="min-w-0 flex-1">
                        <Select.ItemLabel className="text-[15px] font-semibold" />
                        <Select.ItemDescription>{item.subtitle}</Select.ItemDescription>
                      </View>
                      <Select.ItemIndicator />
                    </View>
                  </Select.Item>
                </React.Fragment>
              ))
            )}
          </ScrollView>
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
