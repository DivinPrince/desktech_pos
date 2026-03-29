import type { PaymentMethodKey } from "@/lib/counter-checkout/types";

import type { LocalCounterSaleRow } from "./types";

export type LocalSalesReportByPayment = {
  paymentMethodKey: PaymentMethodKey | string;
  paymentMethodLabel: string;
  count: number;
  totalCents: number;
};

export type LocalSalesReportByDay = {
  /** Local calendar date YYYY-MM-DD */
  dayKey: string;
  totalCents: number;
  saleCount: number;
};

export type LocalSalesReportTopProduct = {
  productId: string;
  name: string;
  unitsSold: number;
  lineTotalCents: number;
};

export type LocalSalesReportSnapshot = {
  saleCount: number;
  totalRevenueCents: number;
  averageTicketCents: number;
  byPaymentMethod: LocalSalesReportByPayment[];
  byDay: LocalSalesReportByDay[];
  topProducts: LocalSalesReportTopProduct[];
};

function localDayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptySnapshot(): LocalSalesReportSnapshot {
  return {
    saleCount: 0,
    totalRevenueCents: 0,
    averageTicketCents: 0,
    byPaymentMethod: [],
    byDay: [],
    topProducts: [],
  };
}

/**
 * Aggregate device-local counter sales for the Reports dashboard (offline-safe).
 */
export function buildLocalSalesReport(rows: LocalCounterSaleRow[]): LocalSalesReportSnapshot {
  if (rows.length === 0) return emptySnapshot();

  let totalRevenueCents = 0;
  const paymentMap = new Map<
    string,
    { paymentMethodKey: PaymentMethodKey | string; paymentMethodLabel: string; count: number; totalCents: number }
  >();
  const dayMap = new Map<string, { totalCents: number; saleCount: number }>();
  const productMap = new Map<
    string,
    { name: string; unitsSold: number; lineTotalCents: number }
  >();

  function visitRow(row: LocalCounterSaleRow): void {
    const rec = row.receipt;
    totalRevenueCents += rec.totalCents;

    const pKey = rec.paymentMethodKey;
    const curP =
      paymentMap.get(pKey) ??
      {
        paymentMethodKey: pKey,
        paymentMethodLabel: rec.paymentMethodLabel,
        count: 0,
        totalCents: 0,
      };
    curP.count += 1;
    curP.totalCents += rec.totalCents;
    if (curP.paymentMethodLabel.trim().length === 0 && rec.paymentMethodLabel.trim().length > 0) {
      curP.paymentMethodLabel = rec.paymentMethodLabel;
    }
    paymentMap.set(pKey, curP);

    const dKey = localDayKeyFromMs(row.completedAtMs);
    const curD = dayMap.get(dKey) ?? { totalCents: 0, saleCount: 0 };
    curD.totalCents += rec.totalCents;
    curD.saleCount += 1;
    dayMap.set(dKey, curD);

    for (const line of rec.lines) {
      const curPr =
        productMap.get(line.productId) ??
        { name: line.name, unitsSold: 0, lineTotalCents: 0 };
      curPr.unitsSold += line.quantity;
      curPr.lineTotalCents += line.priceCents * line.quantity;
      if (line.name.trim().length > 0) curPr.name = line.name;
      productMap.set(line.productId, curPr);
    }
  }

  for (const row of rows) visitRow(row);

  const saleCount = rows.length;
  const averageTicketCents =
    saleCount > 0 ? Math.round(totalRevenueCents / saleCount) : 0;

  const byPaymentMethod = [...paymentMap.values()].sort(
    (a, b) => b.totalCents - a.totalCents,
  );

  const byDay = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, v]) => ({
      dayKey,
      totalCents: v.totalCents,
      saleCount: v.saleCount,
    }));

  const topProducts = [...productMap.entries()]
    .map(([productId, v]) => ({
      productId,
      name: v.name,
      unitsSold: v.unitsSold,
      lineTotalCents: v.lineTotalCents,
    }))
    .sort((a, b) => b.lineTotalCents - a.lineTotalCents);

  return {
    saleCount,
    totalRevenueCents,
    averageTicketCents,
    byPaymentMethod,
    byDay,
    topProducts,
  };
}
