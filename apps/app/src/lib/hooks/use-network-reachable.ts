import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/**
 * Matches offline-executor semantics: connected and `isInternetReachable !== false`.
 */
export function useNetworkReachable(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const apply = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    };

    const unsub = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply);
    return unsub;
  }, []);

  return online;
}
