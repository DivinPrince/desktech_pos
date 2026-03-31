import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";
import type { SaleService } from "@repo/core/pos";
import type { z } from "zod";

/** Server sale row (aligned with `SaleService.SaleInfo`). */
export type SaleRow = z.infer<typeof SaleService.SaleInfo>;

/** Device-facing row for Today, Reports, Receipts (receipt-first UI). */
export type CounterSaleRow = {
  id: string;
  businessId: string;
  completedAtIso: string;
  completedAtMs: number;
  receipt: CompletedSaleReceipt;
};

/** Half-open interval `[startMs, endMs)` on completion time (local calendar, same as prior local store). */
export type SalesRangeBounds = { startMs: number; endMs: number };
