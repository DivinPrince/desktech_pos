import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { TextField } from "heroui-native/text-field";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  PAYMENT_OPTIONS,
  useCounterCheckout,
} from "@/app/(tabs)/counter/counter-checkout-context";
import { CheckoutSubscreenShell } from "@/app/(tabs)/counter/checkout-subscreen-shell";

/** Inputs sit inside a calm field well (HeroUI secondary is borderless). */
const FIELD_WELL = "rounded-2xl border border-border/50 bg-background px-1";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-transparent rounded-xl py-3 px-3.5 text-[16px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

const DIAL_INPUT_CLASS =
  "border-0 border-transparent bg-transparent rounded-xl py-3 px-2 text-[16px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground text-center font-semibold tabular-nums";

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="mb-1.5 text-[13px] font-medium text-muted">{children}</Text>
  );
}

export default function CheckoutDetailsScreen() {
  const router = useRouter();
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const { customer, setCustomer, paymentMethod, setPaymentMethod } =
    useCounterCheckout();
  const [moreCustomerOpen, setMoreCustomerOpen] = useState(false);

  const onContinue = useCallback(() => {
    if (!paymentMethod) return;
    router.push("/counter/payment-confirm");
  }, [paymentMethod, router]);

  return (
    <CheckoutSubscreenShell
      title="Checkout"
      onBack={() => router.back()}
    >
      {/* Customer — soft panel, no heavy chrome */}
      <View className="mb-5 overflow-hidden rounded-2xl bg-surface-secondary/60 px-4 pt-4 pb-3">
        <Text className="mb-3 text-[15px] font-semibold text-foreground">
          Customer
        </Text>
        <Text className="mb-4 text-[13px] leading-[18px] text-muted">
          All fields are optional. Add a phone or name if you want them on the
          receipt.
        </Text>

        <View className="mb-4">
          <FieldLabel>Phone</FieldLabel>
          <View className={`${FIELD_WELL} flex-row items-stretch gap-0`}>
            <View className="w-[88px] border-r border-border/40">
              <TextField className="gap-0">
                <Input
                  value={customer.dialCode}
                  onChangeText={(dialCode) =>
                    setCustomer({ ...customer, dialCode })}
                  placeholder="+1"
                  keyboardType="phone-pad"
                  variant="secondary"
                  className={DIAL_INPUT_CLASS}
                />
              </TextField>
            </View>
            <View className="min-w-0 flex-1">
              <TextField className="gap-0">
                <Input
                  value={customer.phone}
                  onChangeText={(phone) => setCustomer({ ...customer, phone })}
                  placeholder="Mobile number"
                  keyboardType="phone-pad"
                  variant="secondary"
                  className={INPUT_ROW_CLASS}
                />
              </TextField>
            </View>
          </View>
        </View>

        <View className="mb-1">
          <FieldLabel>Name</FieldLabel>
          <View className={FIELD_WELL}>
            <TextField className="gap-0">
              <Input
                value={customer.name}
                onChangeText={(name) => setCustomer({ ...customer, name })}
                placeholder="Customer name"
                variant="secondary"
                className={INPUT_ROW_CLASS}
              />
            </TextField>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            moreCustomerOpen
              ? "Hide email and address"
              : "Show email and address"
          }
          onPress={() => setMoreCustomerOpen((v) => !v)}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3 active:opacity-75"
          hitSlop={6}
        >
          <Text className="text-[14px] font-medium" style={{ color: accent }}>
            {moreCustomerOpen ? "Hide" : "Email & address"}
          </Text>
          <Ionicons
            name={moreCustomerOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={accent}
          />
        </Pressable>

        {moreCustomerOpen ? (
          <View className="mt-2 gap-4 pt-2">
            <View>
              <FieldLabel>Email</FieldLabel>
              <View className={FIELD_WELL}>
                <TextField className="gap-0">
                  <Input
                    value={customer.email}
                    onChangeText={(email) =>
                      setCustomer({ ...customer, email })}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
              </View>
            </View>
            <View>
              <FieldLabel>Address</FieldLabel>
              <View className={FIELD_WELL}>
                <TextField className="gap-0">
                  <Input
                    value={customer.address}
                    onChangeText={(address) =>
                      setCustomer({ ...customer, address })}
                    placeholder="Street, city"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Payment — list rows: clearer than a tight grid */}
      <View className="mb-2">
        <Text className="mb-2 text-[15px] font-semibold text-foreground">
          Payment
        </Text>
        <Text className="mb-3 text-[13px] leading-[18px] text-muted">
          Choose how this sale was paid.
        </Text>

        <View className="gap-2.5">
          {PAYMENT_OPTIONS.map((opt) => {
            const selected = paymentMethod === opt.key;
            return (
              <Pressable
                key={opt.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setPaymentMethod(opt.key)}
                className={`flex-row items-center gap-3.5 rounded-2xl border px-3.5 py-3.5 active:opacity-92 ${
                  selected
                    ? "border-accent bg-accent/[0.09]"
                    : "border-border/45 bg-surface-secondary/50"
                }`}
              >
                <View
                  className={`h-11 w-11 items-center justify-center rounded-xl ${
                    selected ? "bg-background/90" : "bg-background/70"
                  }`}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={selected ? accent : opt.iconHex}
                  />
                </View>
                <Text
                  className="min-w-0 flex-1 text-[16px] font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
                <View
                  className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                    selected ? "border-accent bg-accent" : "border-border/60"
                  }`}
                >
                  {selected ? (
                    <Ionicons name="checkmark" size={14} color={accentFg} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button
        className="mt-6 rounded-2xl"
        isDisabled={!paymentMethod}
        onPress={onContinue}
      >
        <Button.Label className="font-semibold">Continue</Button.Label>
      </Button>
    </CheckoutSubscreenShell>
  );
}
