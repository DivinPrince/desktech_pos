import { Platform } from "react-native";

import { randomUuidV4 } from "../lib/random-uuid";

/**
 * Hermes / React Native omit `globalThis.crypto`, but `@tanstack/db-sqlite-persistence-core`
 * uses `crypto.randomUUID()` (see SingleProcessCoordinator). Install a minimal Web Crypto
 * surface before any persistence code runs.
 */
function ensureNativeCrypto(): void {
  if (Platform.OS === "web") {
    return;
  }

  const current = globalThis.crypto as Crypto | undefined;
  if (
    current &&
    typeof current.getRandomValues === "function" &&
    typeof current.randomUUID === "function"
  ) {
    return;
  }

  const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    try {
      if (current && typeof current.getRandomValues === "function") {
        return current.getRandomValues(array);
      }
    } catch {
      /* ignore */
    }
    const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < view.length; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };

  const randomUUID =
    current && typeof current.randomUUID === "function"
      ? () => current.randomUUID.call(current)
      : () => randomUuidV4();

  const value = { getRandomValues, randomUUID };

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

ensureNativeCrypto();
