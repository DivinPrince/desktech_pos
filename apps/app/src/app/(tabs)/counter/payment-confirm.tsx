import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native/hooks";
import { useToast } from "heroui-native/toast";
import { APIError } from "@repo/sdk";
import React, { useCallback, useEffect, useMemo } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CheckoutSubscreenShell } from "@/components/counter/checkout-subscreen-shell";
import {
  PAYMENT_OPTIONS,
  paymentConfirmButtonLabel,
  useCounterCheckout,
} from "@/lib/counter-checkout/counter-checkout-context";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { useCounterCart } from "@/lib/counter-cart/counter-cart";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import {
  persistCounterCheckoutReceiptExtras,
  useCompleteCounterSaleMutation,
} from "@/lib/queries/business-sales";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";

const NOTE_INPUT_CLASS =
  "min-h-[120px] border-0 border-transparent bg-transparent rounded-xl py-3 px-4 text-[16px] leading-[24px] text-field-foreground shadow-none ios:shadow-none android:shadow-none font-medium";

function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export default function PaymentConfirmScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const fieldPlaceholder = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const {
    customer,
    paymentMethod,
    paymentNote,
    setPaymentNote,
    setLastCompleted,
  } = useCounterCheckout();
  const { lines, totalCents, clear } = useCounterCart();

  const { session, user } = useAuthSessionState();
  const signedIn = Boolean(user);
  const businessesQuery = useBusinessesQuery(signedIn);
  const business = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const businessId = business?.id;
  const currency = business?.currency ?? "USD";
  const { mutateAsync: submitCounterSale, isPending: completingSale } =
    useCompleteCounterSaleMutation(businessId);

  useEffect(() => {
    if (!paymentMethod) {
      router.replace("/counter/checkout-details");
    }
  }, [paymentMethod, router]);

  const onConfirm = useCallback(async () => {
    if (!paymentMethod || !businessId) return;
    if (lines.length === 0 || totalCents <= 0) {
      toast.show({
        variant: "danger",
        label: "Counter is empty",
        description: "Add items before completing payment.",
      });
      router.replace("/counter");
      return;
    }

    const option = PAYMENT_OPTIONS.find((o) => o.key === paymentMethod);
    if (!option) return;

    const linesSnapshot = lines.map((l) => ({ ...l }));

    try {
      const completed = await submitCounterSale({
        lines: linesSnapshot,
        paymentMethod: option.apiValue,
      });

      const receipt = {
        saleId: completed.saleId,
        totalCents: completed.totalCents,
        currency,
        businessName: business?.name,
        completedAtIso: completed.completedAtIso,
        lines: linesSnapshot,
        paymentMethodKey: paymentMethod,
        paymentMethodLabel: option.label,
        customer: { ...customer },
        paymentNote,
      };

      try {
        await persistCounterCheckoutReceiptExtras({ saleId: receipt.saleId, receipt });
      } catch {
        /* receipt extras best-effort */
      }
      setLastCompleted(receipt);

      clear();
      router.replace("/counter/payment-success");
    } catch (e) {
      toast.show({
        variant: "danger",
        label: "Couldn't complete sale",
        description: errorMessage(e),
      });
    }
  }, [
    paymentMethod,
    businessId,
    lines,
    totalCents,
    toast,
    router,
    customer,
    paymentNote,
    currency,
    business?.name,
    setLastCompleted,
    clear,
    submitCounterSale,
  ]);

  if (!paymentMethod) {
    return null;
  }

  const selectedOption = PAYMENT_OPTIONS.find((o) => o.key === paymentMethod);

  return (
    <CheckoutSubscreenShell
      title="Confirm payment"
      onBack={() => router.back()}
    >
      <View className="mb-8 items-center justify-center py-6">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-accent/15">
          <Ionicons name={selectedOption?.icon ?? "card"} size={40} color={accent} />
        </View>
        <Text className="text-[15px] font-bold uppercase tracking-widest text-muted mb-2">
          Total Amount
        </Text>
        <Text className="text-[48px] font-black tabular-nums tracking-tighter text-foreground leading-none">
          {formatMinorUnitsToCurrency(totalCents, currency)}
        </Text>
      </View>

      <View className="mb-8">
        <Text className="mb-3 ml-1 text-[13px] font-bold uppercase tracking-widest text-muted">
          Payment Note
        </Text>
        <View className="rounded-[24px] border border-border/40 bg-surface px-1 py-1 shadow-sm">
          <TextInput
            value={paymentNote}
            onChangeText={setPaymentNote}
            placeholder="Add an optional note about this payment..."
            placeholderTextColor={fieldPlaceholder}
            multiline
            textAlignVertical="top"
            className={NOTE_INPUT_CLASS}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={completingSale}
        onPress={() => void onConfirm()}
        className={`flex-row items-center justify-center rounded-[24px] py-4 mt-4 ${
          completingSale ? "bg-surface border border-border/40 opacity-70" : ""
        }`}
        style={!completingSale ? { backgroundColor: accent } : undefined}
      >
        {completingSale ? (
          <Ionicons name="sync" size={20} color={fieldPlaceholder} className="mr-2 animate-spin" />
        ) : null}
        <Text 
          className={`text-[18px] font-black tracking-tight ${
            completingSale ? "text-muted" : ""
          }`}
          style={!completingSale ? { color: accentFg } : undefined}
        >
          {completingSale
            ? "Processing…"
            : paymentConfirmButtonLabel(paymentMethod)}
        </Text>
        {!completingSale && (
          <Ionicons name="checkmark-circle" size={20} color={accentFg} style={{ marginLeft: 8 }} />
        )}
      </Pressable>
    </CheckoutSubscreenShell>
  );
}
