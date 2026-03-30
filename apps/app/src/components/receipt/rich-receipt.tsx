import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native/hooks";
import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, Platform, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { paymentDisplayForKey } from "@/lib/counter-checkout/payment-options";
import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";
import { formatMinorUnitsToCurrency } from "@/lib/format-money";

const THERMAL_TOOTH_DEPTH = 7;
/** ~one thermal tooth every ~11dp */
const TOOTH_MIN_WIDTH = 11;

const monoFont =
  Platform.OS === "ios"
    ? "Menlo"
    : Platform.select({ android: "monospace", default: "monospace" });

function customerHasDetails(r: CompletedSaleReceipt["customer"]): boolean {
  const c = r;
  return (
    c.name.trim().length > 0 ||
    c.phone.trim().length > 0 ||
    c.email.trim().length > 0 ||
    c.address.trim().length > 0
  );
}

function ThermalRipTop({
  width,
  paperColor,
}: {
  width: number;
  paperColor: string;
}) {
  if (width <= 0) return null;
  const h = THERMAL_TOOTH_DEPTH;
  const n = Math.max(16, Math.round(width / TOOTH_MIN_WIDTH));
  const step = width / n;
  let d = `M 0 ${h}`;
  for (let i = 0; i < n; i++) {
    const peakX = (i + 0.5) * step;
    const valleyX = (i + 1) * step;
    d += ` L ${peakX} 0 L ${valleyX} ${h}`;
  }
  d += ` L 0 ${h} Z`;

  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <Path d={d} fill={paperColor} />
    </Svg>
  );
}

/** Horizontal padding on paper body (matches `px-4`). Rules negate full-bleed. */
const PAPER_H_PADDING = 16;

function ReceiptRule({ borderColor }: { borderColor: string }) {
  return (
    <View
      style={{
        alignSelf: "stretch",
        marginVertical: 8,
        marginHorizontal: -PAPER_H_PADDING,
        borderTopWidth: 1,
        borderTopColor: borderColor,
        opacity: 0.65,
        borderStyle: "dashed",
      }}
    />
  );
}

export type RichReceiptProps = {
  receipt: CompletedSaleReceipt;
  /** Used when `receipt.currency` is missing */
  businessCurrency?: string;
  /**
   * Fill vertical space below the transaction summary so short receipts still look like full-length
   * thermal paper (parent should use flex/flexGrow in a ScrollView or flex column).
   */
  expandVertically?: boolean;
};

export function RichReceipt({
  receipt,
  businessCurrency = "USD",
  expandVertically = false,
}: RichReceiptProps) {
  const muted = useThemeColor("muted");
  const fg = useThemeColor("foreground");
  const paper = useThemeColor("surface");
  const currency = receipt.currency.trim().length > 0 ? receipt.currency : businessCurrency;
  const paymentUi = paymentDisplayForKey(receipt.paymentMethodKey);

  const [stripWidth, setStripWidth] = useState(0);

  const onStripLayout = (e: LayoutChangeEvent) => {
    setStripWidth(Math.round(e.nativeEvent.layout.width));
  };

  const completedLabel = useMemo(() => {
    const d = new Date(receipt.completedAtIso);
    if (Number.isNaN(d.getTime())) return receipt.completedAtIso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [receipt.completedAtIso]);

  const title = receipt.businessName?.trim().length ? receipt.businessName : "Receipt";

  const monoStyle = { fontFamily: monoFont } as const;

  const stretchOuter = expandVertically ? { flex: 1, alignSelf: "stretch" as const } : undefined;
  const stretchInner = expandVertically ? { flex: 1 } : undefined;

  return (
    <View className="w-full self-stretch" style={stretchOuter}>
      <View className="overflow-hidden" style={stretchInner}>
        <View onLayout={onStripLayout} className="bg-transparent" style={stretchInner}>
          <ThermalRipTop width={stripWidth} paperColor={paper} />
          <View
            style={[{ backgroundColor: paper }, stretchInner]}
            className="px-4 pb-5 pt-1"
          >
            <Text
              className="text-center text-[11px] uppercase tracking-[0.2em] text-muted"
              style={monoStyle}
            >
              Thank you for your purchase
            </Text>

            <ReceiptRule borderColor={muted} />

            <Text
              className="text-center text-[17px] font-bold uppercase leading-tight text-foreground"
              style={[monoStyle, { color: fg }]}
              numberOfLines={3}
            >
              {title}
            </Text>

            <Text
              className="mt-2.5 text-center text-[12px] text-muted"
              style={monoStyle}
              numberOfLines={2}
            >
              {completedLabel}
            </Text>

            <View className="mt-3 flex-row items-center justify-center gap-2">
              <Ionicons name={paymentUi.icon} size={14} color={paymentUi.iconHex} />
              <Text className="text-[12px] text-foreground" style={[monoStyle, { color: fg }]}>
                {receipt.paymentMethodLabel}
              </Text>
            </View>

            <ReceiptRule borderColor={muted} />

            <Text className="text-[10px] uppercase tracking-widest text-muted" style={monoStyle}>
              Items
            </Text>

            {receipt.lines.length === 0 ? (
              <Text className="mt-1 text-[12px] text-muted" style={monoStyle}>
                (No line items)
              </Text>
            ) : (
              <View className="mt-2 w-full gap-2.5 self-stretch">
                {receipt.lines.map((line, idx) => {
                  const lineTotal = line.priceCents * line.quantity;
                  return (
                    <View key={`${line.productId}-${idx}`} className="w-full gap-0.5 self-stretch">
                      <Text
                        className="text-[13px] font-semibold leading-snug text-foreground"
                        style={[monoStyle, { color: fg }]}
                        numberOfLines={4}
                      >
                        {line.name}
                      </Text>
                      <View className="w-full flex-row items-start justify-between gap-3 self-stretch">
                        <Text
                          className="min-w-0 flex-1 shrink text-[11px] text-muted"
                          style={monoStyle}
                          numberOfLines={3}
                        >
                          {line.quantity} @ {formatMinorUnitsToCurrency(line.priceCents, currency)}
                        </Text>
                        <Text
                          className="shrink-0 text-[13px] tabular-nums font-semibold text-foreground"
                          style={[monoStyle, { color: fg }]}
                        >
                          {formatMinorUnitsToCurrency(lineTotal, currency)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <ReceiptRule borderColor={muted} />

            <View className="w-full flex-row items-end justify-between gap-3 self-stretch">
              <Text
                className="text-[12px] font-bold uppercase text-foreground"
                style={[monoStyle, { color: fg }]}
              >
                Total
              </Text>
              <Text
                className="text-[20px] font-bold tabular-nums text-foreground"
                style={[monoStyle, { color: fg }]}
              >
                {formatMinorUnitsToCurrency(receipt.totalCents, currency)}
              </Text>
            </View>

            <ReceiptRule borderColor={muted} />

            {customerHasDetails(receipt.customer) ? (
              <View className="gap-1">
                <Text className="text-[10px] uppercase tracking-widest text-muted" style={monoStyle}>
                  Customer
                </Text>
                {receipt.customer.name.trim().length > 0 ? (
                  <Text className="text-[12px] text-foreground" style={[monoStyle, { color: fg }]}>
                    {receipt.customer.name.trim()}
                  </Text>
                ) : null}
                {receipt.customer.phone.trim().length > 0 ? (
                  <Text className="text-[12px] text-muted" style={monoStyle}>
                    {receipt.customer.dialCode.trim()}
                    {receipt.customer.phone.trim()}
                  </Text>
                ) : null}
                {receipt.customer.email.trim().length > 0 ? (
                  <Text className="text-[12px] text-muted" style={monoStyle} numberOfLines={3}>
                    {receipt.customer.email.trim()}
                  </Text>
                ) : null}
                {receipt.customer.address.trim().length > 0 ? (
                  <Text className="text-[12px] leading-4 text-muted" style={monoStyle}>
                    {receipt.customer.address.trim()}
                  </Text>
                ) : null}
                <ReceiptRule borderColor={muted} />
              </View>
            ) : null}

            {receipt.paymentNote.trim().length > 0 ? (
              <View className="gap-1">
                <Text className="text-[10px] uppercase tracking-widest text-muted" style={monoStyle}>
                  Note
                </Text>
                <Text className="text-[12px] leading-5 text-foreground" style={[monoStyle, { color: fg }]}>
                  {receipt.paymentNote.trim()}
                </Text>
                <ReceiptRule borderColor={muted} />
              </View>
            ) : null}

            {expandVertically ? <View style={{ flex: 1, minHeight: 32 }} /> : null}

            <Text
              className="pt-1 text-center text-[12px] font-semibold uppercase tracking-[0.35em] text-muted"
              style={monoStyle}
            >
              Thank you ★
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
