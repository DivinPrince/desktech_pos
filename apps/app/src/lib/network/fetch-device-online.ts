import NetInfo from "@react-native-community/netinfo";

/**
 * Fresh reachability for user-critical mutations. Mirrors
 * ReactNativeOnlineDetector: connected and `isInternetReachable !== false`
 * (null/unknown is treated as reachable).
 */
export async function fetchDeviceAppearsOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected) && state.isInternetReachable !== false;
  } catch {
    // Prefer attempting the API over queuing a sale that may never replay.
    return true;
  }
}
