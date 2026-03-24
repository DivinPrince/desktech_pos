import NetInfo from "@react-native-community/netinfo";

import { onlineManager } from "./query-client";

/**
 * Keep TanStack Query's onlineManager aligned with the device (used for paused queries/mutations).
 */
export function subscribeQueryOnlineManager(): () => void {
  const unsub = NetInfo.addEventListener((state) => {
    const online =
      state.isConnected === true &&
      (state.isInternetReachable === true || state.isInternetReachable === null);
    onlineManager.setOnline(online);
  });

  NetInfo.fetch().then((state) => {
    const online =
      state.isConnected === true &&
      (state.isInternetReachable === true || state.isInternetReachable === null);
    onlineManager.setOnline(online);
  });

  return () => {
    unsub();
  };
}
