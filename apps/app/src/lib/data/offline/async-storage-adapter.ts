import { LocalStorageAdapter } from "@tanstack/offline-transactions";
import type { StorageAdapter } from "@tanstack/offline-transactions";
import { Platform, TurboModuleRegistry } from "react-native";

const PREFIX = "desktech:offline:";

function createMemoryStorageAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
    keys: async () => [...store.keys()],
    clear: async () => {
      store.clear();
    },
  };
}

function createAsyncStorageBackedAdapter(): StorageAdapter {
  const AsyncStorage = require("@react-native-async-storage/async-storage").default as {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    getAllKeys: () => Promise<string[]>;
  };

  return {
    get: (key) => AsyncStorage.getItem(PREFIX + key),
    set: (key, value) => AsyncStorage.setItem(PREFIX + key, value),
    delete: (key) => AsyncStorage.removeItem(PREFIX + key),
    keys: async () => {
      const all = await AsyncStorage.getAllKeys();
      return all.filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
    },
    clear: async () => {
      const ks = await AsyncStorage.getAllKeys();
      await Promise.all(
        ks.filter((k) => k.startsWith(PREFIX)).map((k) => AsyncStorage.removeItem(k)),
      );
    },
  };
}

let warnedNativeFallback = false;

/**
 * Offline outbox storage. Web uses `localStorage` (AsyncStorage v3 relies on `RNAsyncStorage`,
 * which is not available in the browser). Native uses AsyncStorage when the TurboModule is
 * linked; otherwise falls back to in-memory storage (rebuild the dev client if you need persistence).
 */
export function createDesktechOfflineStorageAdapter(): StorageAdapter {
  if (Platform.OS === "web") {
    return new LocalStorageAdapter(PREFIX);
  }

  if (TurboModuleRegistry.get("RNAsyncStorage") == null) {
    if (__DEV__ && !warnedNativeFallback) {
      warnedNativeFallback = true;
      console.warn(
        "[desktech] RNAsyncStorage is not available; offline outbox uses in-memory storage until you rebuild the dev client with @react-native-async-storage/async-storage linked.",
      );
    }
    return createMemoryStorageAdapter();
  }

  return createAsyncStorageBackedAdapter();
}
