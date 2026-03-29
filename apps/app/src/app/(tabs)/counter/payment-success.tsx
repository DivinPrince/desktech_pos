import { StackActions, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useEffect } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Reanimated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedSuccessCheck } from "@/components/counter/animated-success-check";
import { useCounterCheckout } from "@/app/(tabs)/counter/counter-checkout-context";
import { buildReceiptText } from "@/lib/counter-checkout/receipt-text";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const accent = useThemeColor("accent");
  const { lastCompleted, clearLastCompleted } = useCounterCheckout();

  useEffect(() => {
    if (!lastCompleted) {
      router.replace("/counter");
    }
  }, [lastCompleted, router]);

  const onShareReceipt = useCallback(async () => {
    if (!lastCompleted) return;
    try {
      await Share.share({
        message: buildReceiptText(lastCompleted),
        title: "Receipt",
      });
    } catch {
      /* user dismissed share sheet */
    }
  }, [lastCompleted]);

  const onBackToItems = useCallback(() => {
    clearLastCompleted();
    navigation.dispatch(StackActions.popToTop());
    router.replace("/items");
  }, [clearLastCompleted, navigation, router]);

  if (!lastCompleted) {
    return null;
  }

  const { totalCents, currency } = lastCompleted;

  return (
    <View style={styles.fill} className="bg-background">
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <Reanimated.View
              entering={ZoomIn.springify().damping(16).stiffness(220)}
              className="mb-5 h-[100px] w-[100px] items-center justify-center rounded-full bg-accent/18"
            >
              <AnimatedSuccessCheck color={accent} size={72} />
            </Reanimated.View>
            <Reanimated.View entering={FadeInDown.duration(320).delay(280)}>
              <Text className="text-center text-[22px] font-bold text-foreground">
                Payment received
              </Text>
            </Reanimated.View>
            <Reanimated.View entering={FadeIn.duration(280).delay(360)}>
              <Text className="mt-2 text-center text-[28px] font-bold tabular-nums text-foreground">
                {formatMinorUnitsToCurrency(totalCents, currency)}
              </Text>
            </Reanimated.View>
          </View>

          <View className="mt-6 rounded-2xl border border-border/70 bg-surface-secondary px-3 py-3">
            <Text className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
              Receipt preview
            </Text>
            <Text
              className="text-[13px] leading-5 text-foreground"
              selectable
            >
              {buildReceiptText(lastCompleted)}
            </Text>
          </View>

          <View className="mt-8 gap-3">
            <Button className="rounded-2xl" onPress={() => void onShareReceipt()}>
              <Button.Label className="font-semibold">
                View / share receipt
              </Button.Label>
            </Button>
            <Button
              variant="secondary"
              className="rounded-2xl"
              onPress={onBackToItems}
            >
              <Button.Label className="font-semibold">Back to items</Button.Label>
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
