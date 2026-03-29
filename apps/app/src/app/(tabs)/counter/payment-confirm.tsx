import { useRouter } from "expo-router";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { useToast } from "heroui-native/toast";
import { APIError } from "@repo/sdk";
import React, { useCallback, useEffect, useMemo } from "react";
import { Text, TextInput, View } from "react-native";

import {
  PAYMENT_OPTIONS,
  paymentConfirmButtonLabel,
  useCounterCheckout,
} from "@/app/(tabs)/counter/counter-checkout-context";
import { CheckoutSubscreenShell } from "@/app/(tabs)/counter/checkout-subscreen-shell";
import { authClient } from "@/lib/auth-client";
import type { SessionPayload } from "@/lib/auth-session";
import { useCounterCart } from "@/lib/counter-cart/counter-cart";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";
import { appendLocalCounterSale } from "@/lib/data/local-counter-sales/store";
import {
  useBusinessesQuery,
  useCompleteCounterSaleMutation,
} from "@/lib/queries/business-catalog";

const NOTE_INPUT_CLASS =
  "min-h-[100px] border-0 border-transparent bg-transparent rounded-xl py-2.5 px-3 text-[15px] leading-[22px] text-field-foreground shadow-none ios:shadow-none android:shadow-none";

function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export default function PaymentConfirmScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const fieldPlaceholder = useThemeColor("muted");
  const {
    customer,
    paymentMethod,
    paymentNote,
    setPaymentNote,
    setLastCompleted,
  } = useCounterCheckout();
  const { lines, totalCents, clear } = useCounterCart();

  const { data: session } = authClient.useSession();
  const user = (session as SessionPayload | null | undefined)?.user;
  const signedIn = Boolean(user);
  const businessesQuery = useBusinessesQuery(signedIn);
  const business = useMemo(
    () => businessesQuery.data?.[0],
    [businessesQuery.data],
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
        label: "Cart is empty",
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
        await appendLocalCounterSale({ businessId, receipt });
      } catch {
        /* Today list is best-effort; checkout already succeeded */
      }
      setLastCompleted(receipt);

      clear();
      router.replace("/counter/payment-success");
    } catch (e) {
      toast.show({
        variant: "danger",
        label: "Payment failed",
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

  return (
    <CheckoutSubscreenShell
      title="Confirm payment"
      onBack={() => router.back()}
    >
      <Text className="mb-1 text-[15px] text-foreground">
        Total{" "}
        <Text className="font-bold tabular-nums">
          {formatMinorUnitsToCurrency(totalCents, currency)}
        </Text>
      </Text>
      <Text className="mb-4 text-[14px] text-muted">
        Add an optional note, then confirm how you received payment.
      </Text>

      <View className="gap-1">
        <Text className="text-[14px] font-medium text-foreground">
          Payment note
        </Text>
        <TextInput
          value={paymentNote}
          onChangeText={setPaymentNote}
          placeholder="Note about this payment (optional)"
          placeholderTextColor={fieldPlaceholder}
          multiline
          textAlignVertical="top"
          className={NOTE_INPUT_CLASS}
        />
      </View>

      <Button
        className="mt-8 rounded-2xl"
        isDisabled={completingSale}
        onPress={() => void onConfirm()}
      >
        <Button.Label className="font-semibold">
          {completingSale
            ? "Processing…"
            : paymentConfirmButtonLabel(paymentMethod)}
        </Button.Label>
      </Button>
    </CheckoutSubscreenShell>
  );
}
