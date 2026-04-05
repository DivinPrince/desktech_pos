import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { TextField } from "heroui-native/text-field";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { CheckoutSubscreenShell } from "@/components/counter/checkout-subscreen-shell";
import {
  PAYMENT_OPTIONS,
  useCounterCheckout,
} from "@/lib/counter-checkout/counter-checkout-context";

/** Inputs sit inside a calm field well (HeroUI secondary is borderless). */
const FIELD_WELL = "rounded-[20px] bg-surface-secondary px-1";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-transparent rounded-xl py-3.5 px-3.5 text-[16px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground font-medium";

const DIAL_INPUT_CLASS =
  "border-0 border-transparent bg-transparent rounded-xl py-3.5 px-2 text-[16px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground text-center font-bold tabular-nums";

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 ml-1 text-[13px] font-bold uppercase tracking-widest text-muted">{children}</Text>
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
      <View className="mb-8 overflow-hidden rounded-[32px] bg-surface px-5 pt-6 pb-5">
        <View className="flex-row items-center mb-4">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15 mr-3">
            <Ionicons name="person" size={18} color={accent} />
          </View>
          <View>
            <Text className="text-[18px] font-black tracking-tight text-foreground">
              Customer Details
            </Text>
            <Text className="text-[13px] font-medium text-muted mt-0.5">
              Optional receipt info
            </Text>
          </View>
        </View>

        <View className="mb-5">
          <FieldLabel>Phone Number</FieldLabel>
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

        <View className="mb-2">
          <FieldLabel>Full Name</FieldLabel>
          <View className={`${FIELD_WELL}`}>
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
          className="mt-3 flex-row items-center justify-center gap-1.5 py-3 active:opacity-75"
          hitSlop={8}
        >
          <Text className="text-[14px] font-bold" style={{ color: accent }}>
            {moreCustomerOpen ? "Hide extra fields" : "Add email & address"}
          </Text>
          <Ionicons
            name={moreCustomerOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color={accent}
          />
        </Pressable>

        {moreCustomerOpen ? (
          <View className="mt-2 gap-5 pt-4 border-t border-border/30">
            <View>
              <FieldLabel>Email Address</FieldLabel>
              <View className={`${FIELD_WELL}`}>
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
              <FieldLabel>Physical Address</FieldLabel>
              <View className={`${FIELD_WELL}`}>
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
      <View className="mb-8">
        <View className="flex-row items-center mb-4 ml-1">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15 mr-3">
            <Ionicons name="card" size={18} color={accent} />
          </View>
          <View>
            <Text className="text-[18px] font-black tracking-tight text-foreground">
              Payment Method
            </Text>
            <Text className="text-[13px] font-medium text-muted mt-0.5">
              How is the customer paying?
            </Text>
          </View>
        </View>

        <View className="overflow-hidden rounded-[32px] bg-surface">
          {PAYMENT_OPTIONS.map((opt, index) => {
            const selected = paymentMethod === opt.key;
            const isLast = index === PAYMENT_OPTIONS.length - 1;
            return (
              <Pressable
                key={opt.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setPaymentMethod(opt.key)}
                className={`flex-row items-center gap-4 px-5 py-4 active:bg-accent/5 ${
                  !isLast ? "border-b border-border/40" : ""
                } ${selected ? "bg-accent/[0.04]" : ""}`}
              >
                <View
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    selected ? "bg-accent/15" : "bg-surface-secondary/80"
                  }`}
                >
                  <Ionicons
                    name={opt.icon}
                    size={24}
                    color={selected ? accent : opt.iconHex}
                  />
                </View>
                <Text
                  className={`min-w-0 flex-1 text-[17px] tracking-tight ${
                    selected ? "font-black text-foreground" : "font-bold text-muted"
                  }`}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full border-2 ${
                    selected ? "border-accent bg-accent" : "border-border/40 bg-transparent"
                  }`}
                >
                  {selected ? (
                    <Ionicons name="checkmark" size={16} color={accentFg} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!paymentMethod}
        onPress={onContinue}
        className={`flex-row items-center justify-center rounded-[24px] py-4 mt-2 ${
          !paymentMethod ? "bg-surface border border-border/40" : ""
        }`}
        style={paymentMethod ? { backgroundColor: accent } : undefined}
      >
        <Text 
          className={`text-[18px] font-black tracking-tight ${
            !paymentMethod ? "text-muted" : ""
          }`}
          style={paymentMethod ? { color: accentFg } : undefined}
        >
          Continue
        </Text>
        {paymentMethod && (
          <Ionicons name="arrow-forward" size={20} color={accentFg} style={{ marginLeft: 8 }} />
        )}
      </Pressable>
    </CheckoutSubscreenShell>
  );
}
