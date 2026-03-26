import { Button } from "heroui-native/button";
import { Input } from "heroui-native/input";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import { APIError } from "@repo/sdk";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type KeyboardAvoidingViewProps,
} from "react-native";

import { useAdjustStockMutation, type StockAdjustBody } from "@/lib/queries/business-catalog";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-transparent rounded-xl py-2.5 px-3 text-[15px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export type StockManagementSheetProps = {
  visible: boolean;
  onClose: () => void;
  businessId: string | undefined;
  productId: string;
  /** When set, adjusts variant stock; otherwise product-level stock. */
  productVariantId?: string | null;
  title: string;
  subtitle?: string;
  currentQuantity: number;
  trackStock: boolean;
};

const MOVE_TYPES: { id: StockAdjustBody["type"]; label: string }[] = [
  { id: "adjustment", label: "Adjustment" },
  { id: "purchase", label: "Purchase / receive" },
  { id: "waste", label: "Waste / damage" },
];

export function StockManagementSheet({
  visible,
  onClose,
  businessId,
  productId,
  productVariantId,
  title,
  subtitle,
  currentQuantity,
  trackStock,
}: StockManagementSheetProps) {
  const { toast } = useToast();
  const adjustMutation = useAdjustStockMutation(businessId);

  const [amountStr, setAmountStr] = useState("1");
  const [moveType, setMoveType] = useState<StockAdjustBody["type"]>("adjustment");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    setAmountStr("1");
    setMoveType("adjustment");
    setNote("");
  }, [visible, productId, productVariantId]);

  const applyDelta = useCallback(
    (sign: 1 | -1) => {
      if (!businessId || !trackStock) return;
      const n = Number.parseInt(amountStr, 10);
      if (!Number.isFinite(n) || n <= 0) {
        toast.show({ variant: "danger", label: "Enter a positive whole number" });
        return;
      }
      const quantityDelta = sign * n;
      const body: StockAdjustBody = {
        productId,
        quantityDelta,
        type: moveType,
        note: note.trim() || undefined,
      };
      if (productVariantId) body.productVariantId = productVariantId;

      adjustMutation.mutate(body, {
        onSuccess: () => {
          toast.show({ variant: "success", label: "Stock updated" });
          onClose();
        },
        onError: (e) => {
          toast.show({ variant: "danger", label: errorMessage(e) });
        },
      });
    },
    [
      amountStr,
      businessId,
      moveType,
      note,
      onClose,
      productId,
      productVariantId,
      adjustMutation,
      toast,
      trackStock,
    ],
  );

  const kbBehavior: KeyboardAvoidingViewProps["behavior"] =
    Platform.OS === "ios" ? "padding" : undefined;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={kbBehavior} className="flex-1 justify-end bg-black/45">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />
        <View className="max-h-[85%] rounded-t-3xl bg-background px-4 pb-6 pt-4">
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-muted" />
          <Text className="text-[18px] font-semibold text-foreground">{title}</Text>
          {subtitle ? (
            <Text className="mt-1 text-[14px] text-muted">{subtitle}</Text>
          ) : null}

          {!trackStock ? (
            <Text className="mt-4 text-[15px] text-muted">
              Stock tracking is off for this product. Turn on “Track stock” to manage quantities.
            </Text>
          ) : (
            <>
              <View className="mt-4 rounded-xl bg-surface-secondary/60 px-3 py-3">
                <Text className="text-[12px] font-medium uppercase text-muted">On hand</Text>
                <Text className="mt-1 text-[24px] font-semibold tabular-nums text-foreground">
                  {currentQuantity}
                </Text>
              </View>

              <Text className="mt-4 text-[14px] font-medium text-foreground">Movement type</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {MOVE_TYPES.map((m) => {
                  const selected = moveType === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setMoveType(m.id)}
                      className={`rounded-full px-3 py-2 ${selected ? "bg-accent" : "bg-surface-secondary"}`}
                    >
                      <Text
                        className={`text-[13px] font-medium ${selected ? "text-accent-foreground" : "text-foreground"}`}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="mt-4 gap-1">
                <Text className="text-[14px] font-medium text-foreground">Units</Text>
                <TextField className="gap-0">
                  <Input
                    value={amountStr}
                    onChangeText={setAmountStr}
                    placeholder="1"
                    keyboardType="number-pad"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
              </View>

              <View className="mt-4 gap-1">
                <Text className="text-[14px] font-medium text-foreground">Note (optional)</Text>
                <TextField className="gap-0">
                  <Input
                    value={note}
                    onChangeText={setNote}
                    placeholder="Reason or reference"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
              </View>

              <View className="mt-5 flex-row gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onPress={() => applyDelta(-1)}
                  isDisabled={adjustMutation.isPending}
                >
                  <Button.Label className="font-semibold">Remove</Button.Label>
                </Button>
                <Button
                  className="flex-1"
                  onPress={() => applyDelta(1)}
                  isDisabled={adjustMutation.isPending}
                >
                  <Button.Label className="font-semibold text-accent-foreground">Add</Button.Label>
                </Button>
              </View>
            </>
          )}

          <Button variant="secondary" className="mt-4" onPress={onClose}>
            <Button.Label className="font-semibold">Close</Button.Label>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
