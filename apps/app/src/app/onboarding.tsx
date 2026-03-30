import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { Separator } from "heroui-native/separator";
import { Surface } from "heroui-native/surface";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { SearchableSelectModal } from "@/components/searchable-select-modal";
import { authClient } from "@/lib/auth-client";
import {
  sessionNeedsOnboarding,
  type SessionPayload,
  waitForOnboardingSessionClear,
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
  const {
    data: session,
    isPending: sessionPending,
    refetch: refetchSession,
  } = authClient.useSession();
  const [checking, setChecking] = useState(true);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "saving" | "finishing">(
    "idle",
  );
  const [businessName, setBusinessName] = useState("");
  const [timezone, setTimezone] = useState(getDefaultTimeZone);
  const [currency, setCurrency] = useState("USD");
  const [picker, setPicker] = useState<null | "timezone" | "currency">(null);

  const allTimeZonePickerItems = useMemo(
    () =>
      getSortedTimeZoneIds().map((id) => {
        const off = formatTimeZoneOffsetLabel(id);
        return {
          value: id,
          title: id,
          subtitle: off || undefined,
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
        title: timezone,
        subtitle: off || undefined,
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
          title: label,
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
        title: label,
        searchText: `${currency} ${label}`.toLowerCase(),
      },
      ...allCurrencyPickerItems,
    ];
  }, [currency, allCurrencyPickerItems]);

  const timezoneSummary = useMemo(() => {
    const off = formatTimeZoneOffsetLabel(timezone);
    return off ? `${timezone} (${off})` : timezone;
  }, [timezone]);

  const versionLabel = `v${Constants.expoConfig?.version ?? "1.0.0"}`;
  const buildLabel =
    Constants.nativeBuildVersion != null
      ? ` (${Constants.nativeBuildVersion})`
      : "";

  useEffect(() => {
    if (sessionPending) {
      return;
    }

    const user = (session as SessionPayload | null | undefined)?.user;
    if (sessionNeedsOnboarding(session)) {
      setChecking(false);
      return;
    }

    if (user) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    setChecking(true);

    void (async () => {
      const [sessionRes, shouldOnboardRes] = await Promise.all([
        authClient.getSession(),
        authClient.onboarding.shouldOnboard(),
      ]);
      if (cancelled) {
        return;
      }

      if (shouldOnboardRes.data === true) {
        setChecking(false);
        return;
      }

      const liveUser = (sessionRes.data as SessionPayload | null | undefined)?.user;
      if (liveUser) {
        router.replace("/");
        return;
      }

      router.replace("/login");
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionPending, session, router]);

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
      const sessionReady = await waitForOnboardingSessionClear(() =>
        authClient.getSession(),
      );
      await refetchSession();

      if (!sessionReady) {
        toast.show({
          label: "Could not confirm setup",
          description:
            "Your workspace may still have been created. Try opening the app again.",
          variant: "warning",
        });
        return;
      }

      router.replace("/");
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

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <StatusBar style="dark" />
        <Text className="text-center text-[15px] text-muted">Loading setup…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />

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

        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
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
                <Pressable
                  onPress={() => setPicker("timezone")}
                  className="flex-row items-center justify-between py-3.5 pl-4 pr-3 active:bg-accent/10"
                >
                  <View className="min-w-0 flex-1 pr-2">
                    <Text className="text-[13px] text-muted">Time zone</Text>
                    <Text
                      className="mt-0.5 text-[15px] leading-5 text-foreground"
                      numberOfLines={2}
                    >
                      {timezoneSummary}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={accentColor}
                  />
                </Pressable>
                <Separator
                  orientation="horizontal"
                  className="bg-border"
                  thickness={StyleSheet.hairlineWidth}
                />
                <Pressable
                  onPress={() => setPicker("currency")}
                  className="flex-row items-center justify-between py-3.5 pl-4 pr-3 active:bg-accent/10"
                >
                  <View className="min-w-0 flex-1 pr-2">
                    <Text className="text-[13px] text-muted">Currency</Text>
                    <Text
                      className="mt-0.5 text-[15px] leading-5 text-foreground"
                      numberOfLines={2}
                    >
                      {formatCurrencyChoice(currency)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={accentColor}
                  />
                </Pressable>
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
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SearchableSelectModal
        visible={picker === "timezone"}
        title="Time zone"
        searchPlaceholder="Search time zones"
        items={timeZonePickerItems}
        selectedValue={timezone}
        onSelect={setTimezone}
        onClose={() => setPicker(null)}
      />
      <SearchableSelectModal
        visible={picker === "currency"}
        title="Currency"
        searchPlaceholder="Search currencies"
        items={currencyPickerItems}
        selectedValue={currency}
        onSelect={setCurrency}
        onClose={() => setPicker(null)}
      />
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
