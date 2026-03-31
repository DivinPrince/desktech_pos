import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";
import {
  PAYMENT_OPTIONS,
  paymentDisplayForKey,
} from "@/lib/counter-checkout/payment-options";
import type { PaymentMethodKey } from "@/lib/counter-checkout/types";

import type { SaleReceiptExtras } from "./receipt-extras";
import { mergeReceiptExtras } from "./receipt-extras";
import type { CounterSaleRow, SaleRow } from "./types";

export function paymentMethodKeyFromApiValue(
  api: string | null | undefined,
): PaymentMethodKey {
  if (!api) return "cash";
  const hit = PAYMENT_OPTIONS.find((o) => o.apiValue === api);
  return hit?.key ?? "cash";
}

export function saleRowToCounterSaleRow(args: {
  sale: SaleRow;
  businessId: string;
  currency: string;
  businessName?: string;
  extras?: SaleReceiptExtras;
}): CounterSaleRow {
  const { sale, businessId, currency, businessName, extras } = args;
  const completed = sale.completedAt ?? sale.updatedAt;
  const completedAtIso =
    completed instanceof Date ? completed.toISOString() : new Date(completed as string).toISOString();
  const completedAtMs = new Date(completedAtIso).getTime();
  const paymentMethodKey = paymentMethodKeyFromApiValue(sale.paymentMethod);
  const paymentUi = paymentDisplayForKey(paymentMethodKey);

  let receipt: CompletedSaleReceipt = {
    saleId: sale.id,
    totalCents: sale.totalCents,
    currency,
    businessName,
    completedAtIso,
    lines: sale.lines.map((l) => ({
      productId: l.productId,
      name: l.productNameSnapshot,
      priceCents: l.unitPriceCents,
      quantity: l.quantity,
    })),
    paymentMethodKey,
    paymentMethodLabel: paymentUi.label,
    customer: {
      dialCode: "",
      name: "",
      phone: "",
      email: "",
      address: "",
    },
    paymentNote: "",
  };
  receipt = mergeReceiptExtras(receipt, extras);

  return {
    id: sale.id,
    businessId,
    completedAtIso,
    completedAtMs: Number.isFinite(completedAtMs) ? completedAtMs : Date.now(),
    receipt,
  };
}
