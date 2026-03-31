import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { Separator } from "heroui-native/separator";
import { Surface } from "heroui-native/surface";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  BrandedLoading,
  KeyboardAvoidingScaffold,
  SearchablePickerSheet,
} from "@/components/desktech-ui";
import { authClient } from "@/lib/auth-client";
import {
  beginAuthTransition,
  getPendingAuthRoute,
  useAuthSessionState,
} from "@/lib/auth-session";
import {
  formatCurrencyChoice,
  formatTimeZoneOffsetLabel,
  getDefaultTimeZone,
  getSortedCurrencyCodes,
  getSortedTimeZoneIds,
} from "@/lib/intl-picker-data";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-transparent rounded-none py-2.5 px-4 text-[15px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");
  const { toast } = useToast();
  const { user, activeBusiness, needsOnboarding, isPending, refetch: refetchSession } =
    useAuthSessionState();
  const [submitPhase, setSubmitPhase] = useState<"idle" | "saving" | "finishing">(
    "idle",
  );
  const [businessName, setBusinessName] = useState("");
  const [timezone, setTimezone] = useState(getDefaultTimeZone);
  const [currency, setCurrency] = useState("USD");
  const allTimeZonePickerItems = useMemo(
    () =>
      getSortedTimeZoneIds().map((id) => {
        const off = formatTimeZoneOffsetLabel(id);
        return {
          value: id,
          label: off ? `${id} (${off})` : id,
          searchText: `${id} ${off}`.toLowerCase(),
        };
      }),
    [],
  );

  const timeZonePickerItems = useMemo(() => {
    if (
      !timezone ||
      allTimeZonePickerItems.some((i) => i.value === timezone)
    ) {
      return allTimeZonePickerItems;
    }
    const off = formatTimeZoneOffsetLabel(timezone);
    return [
      {
        value: timezone,
        label: off ? `${timezone} (${off})` : timezone,
        searchText: `${timezone} ${off}`.toLowerCase(),
      },
      ...allTimeZonePickerItems,
    ];
  }, [timezone, allTimeZonePickerItems]);

  const allCurrencyPickerItems = useMemo(
    () =>
      getSortedCurrencyCodes().map((code) => {
        const label = formatCurrencyChoice(code);
        return {
          value: code,
          label,
          searchText: `${code} ${label}`.toLowerCase(),
        };
      }),
    [],
  );

  const currencyPickerItems = useMemo(() => {
    if (
      !currency ||
      allCurrencyPickerItems.some((i) => i.value === currency)
    ) {
      return allCurrencyPickerItems;
    }
    const label = formatCurrencyChoice(currency);
    return [
      {
        value: currency,
        label,
        searchText: `${currency} ${label}`.toLowerCase(),
      },
      ...allCurrencyPickerItems,
    ];
  }, [currency, allCurrencyPickerItems]);

  const versionLabel = `v${Constants.expoConfig?.version ?? "1.0.0"}`;
  const buildLabel =
    Constants.nativeBuildVersion != null
      ? ` (${Constants.nativeBuildVersion})`
      : "";

  const onContinue = useCallback(async () => {
    const trimmedName = businessName.trim();
    if (!trimmedName) {
      toast.show({
        label: "Business name required",
        description: "Enter a name for your store or business.",
        variant: "warning",
      });
      return;
    }

    const tzTrimmed = timezone.trim();
    const curTrimmed = currency.trim().toUpperCase();

    setSubmitPhase("saving");
    try {
      const { error } = await authClient.onboarding.step.firstBusiness({
        name: trimmedName,
        ...(tzTrimmed ? { timezone: tzTrimmed } : {}),
        ...(curTrimmed ? { currency: curTrimmed } : {}),
      });
      if (error) {
        toast.show({
          label: "Could not finish setup",
          description: error.message ?? "Please try again.",
          variant: "danger",
        });
        return;
      }

      setSubmitPhase("finishing");
      await refetchSession();
      beginAuthTransition("/(tabs)/dashboard");
      router.replace("/(tabs)/dashboard");
    } finally {
      setSubmitPhase("idle");
    }
  }, [
    businessName,
    currency,
    timezone,
    toast,
    router,
    refetchSession,
  ]);

  const canContinueOnboarding = needsOnboarding || Boolean(user && !activeBusiness);
  const isPendingOnboardingHandoff =
    !user && getPendingAuthRoute() === "/onboarding";

  useEffect(() => {
    if (isPendingOnboardingHandoff) {
      void refetchSession();
    }
  }, [isPendingOnboardingHandoff, refetchSession]);

  if (isPending || isPendingOnboardingHandoff) {
    return (
      <View className="flex-1 bg-background">
        <StatusBar style="inverted" />
        <BrandedLoading message="Loading setup…" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!canContinueOnboarding) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="inverted" />

      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <View
          pointerEvents="box-none"
          style={[
            styles.versionBadge,
            { top: insets.top + 4, right: insets.right + 20 },
          ]}
        >
          <Text className="text-[11px] text-muted">
            {versionLabel}
            {buildLabel}
          </Text>
          <Ionicons name="storefront" size={14} color={accentColor} />
        </View>

        <KeyboardAvoidingScaffold>
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[
              styles.scrollInner,
              { paddingBottom: Math.max(insets.bottom, 20) + 8 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.centerColumn}>
              <View className="items-center px-1">
                <Text className="text-[1.875rem] font-bold text-foreground">
                  Set up your business
                </Text>
                <Text className="mt-2 max-w-[300px] text-center text-[15px] leading-snug text-muted">
                  Create your first workspace. You can change these details
                  later.
                </Text>
              </View>

              <Surface
                variant="default"
                className="mt-6 w-full overflow-hidden rounded-xl bg-surface shadow-surface"
              >
                <TextField className="gap-0">
                  <Input
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="Business name"
                    autoCapitalize="words"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
                <Separator
                  orientation="horizontal"
                  className="bg-border"
                  thickness={StyleSheet.hairlineWidth}
                />
                <SearchablePickerSheet
                  variant="onboarding"
                  fieldLabel="Time zone"
                  placeholder="Choose time zone"
                  title="Time zone"
                  searchPlaceholder="Search time zones"
                  options={timeZonePickerItems}
                  selectedValue={timezone}
                  onSelect={setTimezone}
                />
                <Separator
                  orientation="horizontal"
                  className="bg-border"
                  thickness={StyleSheet.hairlineWidth}
                />
                <SearchablePickerSheet
                  variant="onboarding"
                  fieldLabel="Currency"
                  placeholder="Choose currency"
                  title="Currency"
                  searchPlaceholder="Search currencies"
                  options={currencyPickerItems}
                  selectedValue={currency}
                  onSelect={setCurrency}
                />
              </Surface>

              <View className="mt-5 w-full">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  isDisabled={submitPhase !== "idle"}
                  onPress={onContinue}
                >
                  <Button.Label className="font-semibold text-accent-foreground">
                    {submitPhase === "saving"
                      ? "Saving…"
                      : submitPhase === "finishing"
                        ? "Finishing setup…"
                        : "Continue"}
                  </Button.Label>
                </Button>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingScaffold>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  versionBadge: {
    position: "absolute",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scrollInner: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  centerColumn: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
});
