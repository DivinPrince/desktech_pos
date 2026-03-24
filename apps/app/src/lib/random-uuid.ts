/**
 * RFC 4122 UUID v4 without relying on `globalThis.crypto` (missing on some Hermes/Android builds)
 * or extra native modules that Metro may fail to resolve under Bun hoisting.
 */
function fillRandomBytes(bytes: Uint8Array): void {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === "function") {
      c.getRandomValues(bytes);
      return;
    }
  } catch {
    // Hermes may throw when `crypto` is absent; fall back below.
  }
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
}

export function randomUuidV4(): string {
  const bytes = new Uint8Array(16);
  fillRandomBytes(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
