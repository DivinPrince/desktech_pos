import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import React, { useMemo } from "react";
import { View } from "react-native";

import {
  exportReceiptPdfFile,
  shareReceiptPdf,
} from "@/lib/counter-checkout/receipt-actions";
import type { ReceiptPdfThemeColors } from "@/lib/counter-checkout/receipt-pdf-html";
import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";

export function ReceiptActionButtons({
  receipt,
}: {
  receipt: CompletedSaleReceipt;
}) {
  const paper = useThemeColor("surface");
  const muted = useThemeColor("muted");
  const ink = useThemeColor("foreground");
  const pageBg = useThemeColor("background");

  const pdfTheme = useMemo<ReceiptPdfThemeColors>(
    () => ({
      paper,
      muted,
      ink,
      pageBg,
    }),
    [paper, muted, ink, pageBg],
  );

  return (
    <View className="flex-row gap-3">
      <Button
        className="min-h-[48px] flex-1 rounded-2xl"
        onPress={() => void shareReceiptPdf(receipt, pdfTheme)}
      >
        <Button.Label className="font-semibold">Share</Button.Label>
      </Button>
      <Button
        variant="secondary"
        className="min-h-[48px] flex-1 rounded-2xl"
        onPress={() => void exportReceiptPdfFile(receipt, pdfTheme)}
      >
        <Button.Label className="font-semibold">Save</Button.Label>
      </Button>
    </View>
  );
}
