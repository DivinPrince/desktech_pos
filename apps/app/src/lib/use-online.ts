import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(
        state.isConnected === true &&
          (state.isInternetReachable === true || state.isInternetReachable === null),
      );
    });
    NetInfo.fetch().then((state) => {
      setOnline(
        state.isConnected === true &&
          (state.isInternetReachable === true || state.isInternetReachable === null),
      );
    });
    return unsub;
  }, []);

  return online;
}
