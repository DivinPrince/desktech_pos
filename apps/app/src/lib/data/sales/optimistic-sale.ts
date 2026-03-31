import type { CartLine } from "@/lib/counter-cart/counter-cart";

import type { SaleRow } from "./types";

/**
 * Build a `SaleRow`-shaped optimistic completed sale for counter checkout (pending id until server replay).
 */
export function buildOptimisticCounterSaleRow(args: {
  businessId: string;
  pendingSaleId: string;
  lines: CartLine[];
  paymentMethod: string;
  totalCents: number;
  completedAt: Date;
}): SaleRow {
  const { businessId, pendingSaleId, lines, paymentMethod, totalCents, completedAt } = args;
  const lineRows = lines.map((l, i) => ({
    id: `local_line_${pendingSaleId.slice(0, 8)}_${i}`,
    saleId: pendingSaleId,
    productId: l.productId,
    productVariantId: l.productVariantId ?? null,
    quantity: l.quantity,
    unitPriceCents: l.priceCents,
    lineDiscountCents: 0,
    productNameSnapshot: l.name,
    createdAt: completedAt,
    updatedAt: completedAt,
  }));

  return {
    id: pendingSaleId,
    businessId,
    status: "completed",
    tableId: null,
    subtotalCents: totalCents,
    taxCents: 0,
    totalCents,
    paymentMethod,
    completedAt,
    voidReason: null,
    createdByUserId: null,
    lines: lineRows,
    createdAt: completedAt,
    updatedAt: completedAt,
  };
}
