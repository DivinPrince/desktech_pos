import { useCallback, useEffect, useState } from "react";

import type { LocalCounterSaleRow, LocalSalesRangeBounds } from "./types";
import { listLocalSalesForLocalCalendarDay, listLocalSalesInTimeRange } from "./store";

export function useLocalSalesRange(
  businessId: string | undefined,
  bounds: LocalSalesRangeBounds | null,
) {
  const [rows, setRows] = useState<LocalCounterSaleRow[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!businessId || !bounds) {
      setRows([]);
      return;
    }
    void (async () => {
      const list = await listLocalSalesInTimeRange(
        businessId,
        bounds.startMs,
        bounds.endMs,
      );
      if (!cancelled) setRows(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, bounds, tick]);

  return { rows, refresh };
}

export function useLocalSalesToday(businessId: string | undefined) {
  const [rows, setRows] = useState<LocalCounterSaleRow[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!businessId) {
      setRows([]);
      return;
    }
    void (async () => {
      const list = await listLocalSalesForLocalCalendarDay(businessId, new Date());
      if (!cancelled) setRows(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, tick]);

  return { rows, refresh };
}
