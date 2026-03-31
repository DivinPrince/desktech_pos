import { StackActions, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useEffect } from "react";
import { ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import Reanimated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedSuccessCheck } from "@/components/counter/animated-success-check";
import { RichReceipt } from "@/components/receipt/rich-receipt";
import { ReceiptActionButtons } from "@/components/receipt/receipt-action-buttons";
import { useCounterCheckout } from "@/app/(tabs)/counter/_counter-checkout-context";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const accent = useThemeColor("accent");
  const statusBarStyle = colorScheme === "dark" ? "light" : "dark";
  const { lastCompleted, clearLastCompleted } = useCounterCheckout();

  useEffect(() => {
    if (!lastCompleted) {
      router.replace("/counter");
    }
  }, [lastCompleted, router]);

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
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={{
            flexGrow: 1,
            flexDirection: "column",
            paddingHorizontal: 20,
            paddingTop: 48,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-6">
            <Reanimated.View
              entering={ZoomIn.springify().damping(16).stiffness(220)}
              className="mb-6 h-[112px] w-[112px] items-center justify-center rounded-full bg-accent/20"
            >
              <AnimatedSuccessCheck color={accent} size={80} />
            </Reanimated.View>
            <Reanimated.View entering={FadeInDown.duration(320).delay(280)}>
              <Text className="text-center text-[24px] font-black tracking-tight text-foreground">
                Payment Received
              </Text>
            </Reanimated.View>
            <Reanimated.View entering={FadeIn.duration(280).delay(360)}>
              <Text className="mt-1 text-center text-[40px] font-black tabular-nums tracking-tighter text-foreground">
                {formatMinorUnitsToCurrency(totalCents, currency)}
              </Text>
            </Reanimated.View>
          </View>

          <View style={{ flex: 1, minHeight: 1, marginTop: 16 }}>
            <RichReceipt receipt={lastCompleted} expandVertically />
          </View>

          <View className="mt-10 gap-4">
            <ReceiptActionButtons receipt={lastCompleted} />
            <Button variant="secondary" className="min-h-[56px] rounded-[24px]" onPress={onBackToItems}>
              <Button.Label className="font-bold text-[16px]">Back to items</Button.Label>
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
