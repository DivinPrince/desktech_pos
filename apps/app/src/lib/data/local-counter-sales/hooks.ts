import { useCallback, useEffect, useState } from "react";

import type { LocalCounterSaleRow } from "./types";
import { listLocalSalesForLocalCalendarDay } from "./store";

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
