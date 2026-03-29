import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";

export type LocalCounterSaleRow = {
  id: string;
  businessId: string;
  completedAtIso: string;
  completedAtMs: number;
  receipt: CompletedSaleReceipt;
};

/** Half-open interval [startMs, endMs) for local sales queries. */
export type LocalSalesRangeBounds = { startMs: number; endMs: number };
