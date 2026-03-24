import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert } from "heroui-native/alert";
import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";
import { Checkbox } from "heroui-native/checkbox";
import { Chip } from "heroui-native/chip";
import { useThemeColor } from "heroui-native/hooks";
import type { ThemeColor } from "heroui-native/hooks";
import { Skeleton } from "heroui-native/skeleton";
import { Spinner } from "heroui-native/spinner";
import { Switch } from "heroui-native/switch";
import { useToast } from "heroui-native/toast";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  AppHeader,
  BentoTile,
  CategoryRail,
  ColorSwatch,
  HeaderAvatar,
  IconCircleButton,
  PillSearchField,
  ProductListGrid,
  ProductPreviewCard,
  QuantityStepper,
  SectionHeader,
  StatMetricCard,
  SubpageHeader,
  SummaryRow,
} from "@/components/desktech-ui";
import { authClient } from "@/lib/auth-client";
import {
  sessionNeedsOnboarding,
  type SessionPayload,
} from "@/lib/auth-session";

/** Core semantic tokens from HeroUI Native default `theme.css` (light / dark). */
const CORE_THEME_SWATCHES: ThemeColor[] = [
  "background",
  "foreground",
  "surface",
  "surface-secondary",
  "muted",
  "accent",
  "accent-foreground",
  "danger",
  "success",
  "warning",
  "border",
];

const SOFT_THEME_SWATCHES: ThemeColor[] = [
  "accent-soft",
  "success-soft",
  "warning-soft",
  "danger-soft",
];

function HeroCoreColorSwatches() {
  const values = useThemeColor(CORE_THEME_SWATCHES);
  return (
    <View className="flex-row flex-wrap gap-3">
      {CORE_THEME_SWATCHES.map((name, i) => (
        <ColorSwatch
          key={name}
          color={values[i] ?? "transparent"}
          name={name}
        />
      ))}
    </View>
  );
}

function HeroSoftColorSwatches() {
  const values = useThemeColor(SOFT_THEME_SWATCHES);
  return (
    <View className="flex-row flex-wrap gap-3">
      {SOFT_THEME_SWATCHES.map((name, i) => (
        <ColorSwatch
          key={name}
          color={values[i] ?? "transparent"}
          name={name}
        />
      ))}
    </View>
  );
}

export default function UiPlaygroundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accent = useThemeColor("accent");
  const { toast } = useToast();
  const { data: session, isPending } = authClient.useSession();

  const [qty, setQty] = useState(1);
  const [cat, setCat] = useState("meals");
  const [pinned, setPinned] = useState(false);
  const [notify, setNotify] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const categories = useMemo(
    () => [
      {
        id: "meals",
        label: "Meals",
        icon: <Ionicons name="restaurant-outline" size={22} color={accent} />,
      },
      {
        id: "drinks",
        label: "Drinks",
        icon: <Ionicons name="cafe-outline" size={22} color={accent} />,
      },
      {
        id: "retail",
        label: "Retail",
        icon: <Ionicons name="pricetag-outline" size={22} color={accent} />,
      },
    ],
    [accent],
  );

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  const user = (session as SessionPayload | null | undefined)?.user;
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (sessionNeedsOnboarding(session)) {
    return <Redirect href="/onboarding" />;
  }

  const displayName =
    (typeof user.name === "string" && user.name.trim()) ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <View className="px-5 pb-2">
          <SubpageHeader
            title="UI kit"
            onBack={() => router.back()}
            trailing={
              <IconCircleButton
                accessibilityLabel="Show sample toast"
                onPress={() =>
                  toast.show({
                    label: "Desktech",
                    description: "Toast from the UI playground.",
                    variant: "default",
                  })
                }
              >
                <Ionicons name="notifications-outline" size={20} color={accent} />
              </IconCircleButton>
            }
          />
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <SectionHeader
            title="POS headers"
            description="Today, Counter, and Items screens can share this pattern — avatar, shift context, shortcuts."
          />
          <AppHeader
            greeting="On shift,"
            name={displayName}
            avatar={<HeaderAvatar initials={displayName} />}
            trailing={
              <>
                <IconCircleButton accessibilityLabel="Open tickets">
                  <Ionicons
                    name="file-tray-stacked-outline"
                    size={20}
                    color={accent}
                  />
                </IconCircleButton>
                <IconCircleButton accessibilityLabel="Alerts">
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={accent}
                  />
                </IconCircleButton>
              </>
            }
          />

          <View className="mt-8">
            <SectionHeader
              title="HeroUI semantic colors"
              description="Default tokens from heroui-native/styles (switch light/dark in the OS to compare)."
            />
            <HeroCoreColorSwatches />
          </View>

          <View className="mt-8">
            <SectionHeader
              title="Soft surfaces"
              description="accent-soft, success-soft, warning-soft, danger-soft — used for tinted panels."
            />
            <HeroSoftColorSwatches />
          </View>

          <View className="mt-8">
            <SectionHeader
              title="Search & categories"
              description="Counter sell grid: find SKUs fast or jump categories."
            />
            <PillSearchField placeholder="Search items or scan barcode…" />
            <View className="mt-4">
              <CategoryRail
                items={categories}
                selectedId={cat}
                onSelect={setCat}
              />
            </View>
          </View>

          <View className="mt-8">
            <SectionHeader
              title="Item tile"
              description="Sell grid: price, pin to quick keys, open modifiers or details."
            />
            <ProductPreviewCard
              name="Breakfast combo"
              priceLabel="$12.00"
              pinned={pinned}
              onPinPress={() => setPinned((v) => !v)}
              onDetailPress={() => {}}
            />
          </View>

          <View className="mt-8">
            <SectionHeader
              title="List grid"
              description="Two columns: product cards, then Other, then Add item."
            />
            <ProductListGrid>
              <ProductListGrid.ProductCard
                title="Drip coffee"
                price="$3.50"
                onPress={() => {}}
              />
              <ProductListGrid.ProductCard
                title="Breakfast combo"
                price="$12.00"
                onPress={() => {}}
              />
              <ProductListGrid.ProductCard
                title="Retail SKU"
                price="$24.99"
                onPress={() => {}}
              />
              <ProductListGrid.OtherCard onPress={() => {}} />
              <ProductListGrid.AddItemCard onPress={() => {}} />
            </ProductListGrid>
          </View>

          <View className="mt-8">
            <SectionHeader
              title="Line & tender"
              description="Qty on the open ticket, primary pay action, and amount due breakdown."
            />
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] text-muted">This line</Text>
              <QuantityStepper value={qty} onChange={setQty} min={0} max={20} />
            </View>
            <View className="mt-4">
              <Button variant="primary" size="md" className="w-full">
                <Button.Label className="font-semibold text-accent-foreground">
                  Charge card
                </Button.Label>
              </Button>
            </View>
            <Card className="mt-4 overflow-hidden rounded-3xl border border-border shadow-surface">
              <Card.Body className="gap-0 p-4">
                <SummaryRow label="Subtotal" value="$48.00" />
                <SummaryRow
                  label="Store discount"
                  value="- $4.00"
                  variant="danger"
                />
                <View className="my-2 h-px bg-border" />
                <SummaryRow label="Amount due" value="$44.00" variant="emphasis" />
              </Card.Body>
            </Card>
          </View>

          <View className="mt-8">
            <SectionHeader
              title="Bento grid"
              description="Tinted surfaces use HeroUI soft tokens (no custom hex)."
            />
            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="min-h-[120px] flex-1">
                  <BentoTile
                    title="Today"
                    subtitle="Sales vs yesterday"
                    className="bg-success-soft"
                  >
                    <Text className="mt-3 text-2xl font-bold text-foreground">
                      +12%
                    </Text>
                  </BentoTile>
                </View>
                <View className="min-h-[120px] flex-1">
                  <BentoTile
                    title="Peak hour"
                    subtitle="Busiest window"
                    className="bg-warning-soft"
                  >
                    <Text className="mt-3 text-2xl font-bold text-foreground">
                      2–4pm
                    </Text>
                  </BentoTile>
                </View>
              </View>
              <BentoTile
                title="Shift tip"
                subtitle="Lunch rush on track — two registers open, queue under five."
                className="bg-accent-soft"
              />
            </View>
            <View className="mt-3 flex-row gap-2">
              <StatMetricCard
                label="Tickets"
                value="128"
                sublabel="Today"
              />
              <StatMetricCard
                label="Avg. ticket"
                value="$18.40"
                sublabel="After tax"
              />
            </View>
          </View>

          <View className="mt-8">
            <SectionHeader
              title="HeroUI primitives"
              description="Buttons, chips, alerts, and form controls used on login & onboarding."
            />
            <View className="gap-2">
              <Button variant="primary" size="md" className="w-full">
                <Button.Label className="font-semibold text-accent-foreground">
                  Primary
                </Button.Label>
              </Button>
              <Button variant="secondary" size="md" className="w-full">
                <Button.Label className="font-semibold">Secondary</Button.Label>
              </Button>
              <Button variant="tertiary" size="md" className="w-full">
                <Button.Label>Tertiary</Button.Label>
              </Button>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: "row",
                gap: 8,
                marginTop: 16,
                paddingRight: 8,
              }}
            >
              <Chip size="sm" variant="primary" color="accent">
                On sale
              </Chip>
              <Chip size="sm" variant="secondary">
                New
              </Chip>
              <Chip size="sm" variant="primary" color="danger">
                Low stock
              </Chip>
            </ScrollView>
            <Alert status="success" className="mt-4 rounded-2xl">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Synced</Alert.Title>
                <Alert.Description>
                  Items and prices match the server.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <Alert status="warning" className="mt-3 rounded-2xl">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Offline queue</Alert.Title>
                <Alert.Description>
                  Three sales will upload when you are back online.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <View className="mt-4 flex-row flex-wrap items-center gap-4">
              <View className="flex-row items-center gap-2">
                <Switch
                  isSelected={notify}
                  onSelectedChange={setNotify}
                  accessibilityLabel="End-of-shift report email"
                />
                <Text className="text-[15px] text-foreground">
                  End-of-shift report
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Checkbox
                  isSelected={darkMode}
                  onSelectedChange={setDarkMode}
                />
                <Text className="text-[15px] text-foreground">Dark preview</Text>
              </View>
            </View>
            <View className="mt-4 flex-row items-center gap-4">
              <Spinner size="md" color={accent} />
              <Skeleton className="h-10 flex-1 rounded-xl" />
            </View>
          </View>

          <Text className="mt-10 text-center text-[12px] text-muted">
            Custom OKLCH tokens in global.css override HeroUI defaults after
            @import heroui-native/styles. Login & onboarding use the same Surface,
            TextField, Input, Separator, and Button tokens.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
