import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { flushOutboxOnce } from "./flush-outbox";

const FLUSH_INTERVAL_MS = 25_000;

/**
 * Flush pending outbox rows when the app is active and periodically while foregrounded.
 */
export function useOutboxFlush(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const run = () => {
      void flushOutboxOnce();
    };

    run();

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") {
        run();
      }
    };

    const sub = AppState.addEventListener("change", onAppState);

    const unsubNet = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true &&
        (state.isInternetReachable === true || state.isInternetReachable === null);
      if (online) {
        run();
      }
    });

    intervalRef.current = setInterval(run, FLUSH_INTERVAL_MS);

    return () => {
      sub.remove();
      unsubNet();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
