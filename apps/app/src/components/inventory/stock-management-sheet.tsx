import { Button } from "heroui-native/button";
import { Input } from "heroui-native/input";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import { APIError } from "@repo/sdk";
import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { KeyboardAvoidingScaffold } from "@/components/desktech-ui";

import { useAdjustStockMutation, type StockAdjustBody } from "@/lib/queries/business-catalog";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-background/50 rounded-[16px] py-3.5 px-4 text-[16px] font-medium leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

const RECORD_AS_OPTIONS: { apiType: StockAdjustBody["type"]; label: string }[] = [
  { apiType: "purchase", label: "Purchase" },
  { apiType: "waste", label: "Waste / damage" },
  { apiType: "adjustment", label: "Correction" },
];

type Direction = "add" | "remove";

function RadioOuter({ selected }: { selected: boolean }) {
  return (
    <View
      className={`h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-accent" : "border-border"}`}
    >
      {selected ? <View className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
    </View>
  );
}

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
  title: string;
  subtitle?: string;
  currentQuantity: number;
  trackStock: boolean;
};

export function StockManagementSheet({
  visible,
  onClose,
  businessId,
  productId,
  title,
  subtitle,
  currentQuantity,
  trackStock,
}: StockManagementSheetProps) {
  const { toast } = useToast();
  const adjustMutation = useAdjustStockMutation(businessId);

  const [amountStr, setAmountStr] = useState("1");
  const [recordKey, setRecordKey] = useState(0);
  const [direction, setDirection] = useState<Direction>("add");
  const [note, setNote] = useState("");

  const recordAs = RECORD_AS_OPTIONS[recordKey] ?? RECORD_AS_OPTIONS[0]!;
  const isCorrection = recordAs.apiType === "adjustment";

  const selectRecordKey = useCallback((idx: number) => {
    setRecordKey(idx);
    const t = RECORD_AS_OPTIONS[idx]?.apiType;
    if (t === "waste") setDirection("remove");
    else if (t === "purchase") setDirection("add");
    else if (t === "adjustment") setDirection("add");
  }, []);

  useEffect(() => {
    if (!visible) return;
    setAmountStr("1");
    setRecordKey(0);
    setDirection("add");
    setNote("");
  }, [visible, productId]);

  const onSave = useCallback(() => {
    if (!businessId || !trackStock) return;
    const n = Number.parseInt(amountStr, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast.show({ variant: "danger", label: "Enter a positive whole number" });
      return;
    }
    let quantityDelta: number;
    if (recordAs.apiType === "purchase") {
      quantityDelta = n;
    } else if (recordAs.apiType === "waste") {
      quantityDelta = -n;
    } else {
      const sign: 1 | -1 = direction === "add" ? 1 : -1;
      quantityDelta = sign * n;
    }
    const body: StockAdjustBody = {
      productId,
      quantityDelta,
      type: recordAs.apiType,
      note: note.trim() || undefined,
    };

    adjustMutation.mutate(body, {
      onSuccess: () => {
        toast.show({ variant: "success", label: "Stock saved" });
        onClose();
      },
      onError: (e) => {
        toast.show({ variant: "danger", label: errorMessage(e) });
      },
    });
  }, [
    amountStr,
    businessId,
    direction,
    note,
    onClose,
    productId,
    recordAs.apiType,
    adjustMutation,
    toast,
    trackStock,
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingScaffold className="bg-black/45" style={{ justifyContent: "flex-end" }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />
        <View className="max-h-[88%] rounded-t-[32px] bg-background px-5 pb-8 pt-4">
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-muted/40" />
          <Text className="text-[22px] font-black tracking-tight text-foreground">{title}</Text>
          {subtitle ? (
            <Text className="mt-1 text-[15px] font-medium text-muted">{subtitle}</Text>
          ) : null}

          {!trackStock ? (
            <Text className="mt-4 text-[15px] text-muted">
              Turn on “Track stock” and save.
            </Text>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              className="mt-4 max-h-[520px]"
            >
              <View className="mb-4 rounded-[24px] bg-surface px-5 py-4 shadow-sm">
                <Text className="text-[12px] font-bold uppercase tracking-widest text-muted">
                  Available to sell
                </Text>
                <Text className="mt-1 text-[32px] font-black tabular-nums tracking-tighter text-foreground">
                  {currentQuantity}
                </Text>
              </View>

              <Text className="mt-2 text-[15px] font-bold text-foreground ml-1">Type</Text>
              <View className="mt-2 flex-row flex-wrap gap-2" accessibilityRole="tablist">
                {RECORD_AS_OPTIONS.map((opt, idx) => {
                  const selected = recordKey === idx;
                  return (
                    <Pressable
                      key={opt.apiType}
                      onPress={() => selectRecordKey(idx)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      accessibilityLabel={opt.label}
                      className={`rounded-full px-4 py-3 ${selected ? "bg-accent" : "bg-surface"}`}
                    >
                      <Text
                        className={`text-[14px] font-bold ${selected ? "text-accent-foreground" : "text-foreground"}`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {isCorrection ? (
                <>
                  <Text className="mt-5 text-[15px] font-bold text-foreground ml-1">Direction</Text>
                  <View className="mt-2 overflow-hidden rounded-[20px] bg-surface">
                    <Pressable
                      onPress={() => setDirection("remove")}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: direction === "remove" }}
                      className={`flex-row items-center gap-3 px-4 py-4 ${direction === "remove" ? "bg-accent/10" : ""}`}
                    >
                      <RadioOuter selected={direction === "remove"} />
                      <Text className="text-[16px] font-bold text-foreground">Decrease</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDirection("add")}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: direction === "add" }}
                      className={`flex-row items-center gap-3 border-t border-border/40 px-4 py-4 ${direction === "add" ? "bg-accent/10" : ""}`}
                    >
                      <RadioOuter selected={direction === "add"} />
                      <Text className="text-[16px] font-bold text-foreground">Increase</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              <View className="mt-5 gap-1.5">
                <Text className="text-[15px] font-bold text-foreground ml-1">Quantity</Text>
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

              <View className="mt-4 gap-1.5">
                <Text className="text-[15px] font-bold text-foreground ml-1">Note</Text>
                <TextField className="gap-0">
                  <Input
                    value={note}
                    onChangeText={setNote}
                    placeholder="Optional"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
              </View>

              <Button className="mt-8 h-[56px] rounded-full" onPress={onSave} isDisabled={adjustMutation.isPending}>
                <Button.Label className="font-black text-[17px] tracking-tight text-accent-foreground">Save</Button.Label>
              </Button>
            </ScrollView>
          )}

          <Button variant="secondary" className="mt-3 h-[56px] rounded-full bg-surface" onPress={onClose}>
            <Button.Label className="font-bold text-[16px]">Close</Button.Label>
          </Button>
        </View>
      </KeyboardAvoidingScaffold>
    </Modal>
  );
}
