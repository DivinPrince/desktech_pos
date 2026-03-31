import { Platform, TurboModuleRegistry } from "react-native";

import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";

const STORAGE_KEY = "desktech:sale-receipt-extras:v1";

export type SaleReceiptExtras = Pick<
  CompletedSaleReceipt,
  "customer" | "paymentNote" | "paymentMethodKey" | "paymentMethodLabel" | "currency" | "businessName"
>;

let memory: Record<string, SaleReceiptExtras> | null = null;

let warnedReceiptExtrasFallback = false;

function canUseNativeAsyncStorage(): boolean {
  return Platform.OS !== "web" && TurboModuleRegistry.get("RNAsyncStorage") != null;
}

function parseRecord(raw: string | null): Record<string, SaleReceiptExtras> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, SaleReceiptExtras>;
    return typeof parsed === "object" && parsed != null ? parsed : {};
  } catch {
    return {};
  }
}

async function readAll(): Promise<Record<string, SaleReceiptExtras>> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") return {};
    return parseRecord(localStorage.getItem(STORAGE_KEY));
  }

  if (!canUseNativeAsyncStorage()) {
    if (__DEV__ && !warnedReceiptExtrasFallback) {
      warnedReceiptExtrasFallback = true;
      console.warn(
        "[desktech] RNAsyncStorage is not available; receipt customer/note extras stay in memory only until you rebuild the dev client with AsyncStorage linked.",
      );
    }
    return memory ?? {};
  }

  const AsyncStorage = require("@react-native-async-storage/async-storage").default as {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return parseRecord(raw);
}

async function writeAll(next: Record<string, SaleReceiptExtras>): Promise<void> {
  memory = next;

  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return;
  }

  if (!canUseNativeAsyncStorage()) {
    return;
  }

  const AsyncStorage = require("@react-native-async-storage/async-storage").default as {
    setItem: (key: string, value: string) => Promise<void>;
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Load cached extras into memory (optional; speeds up sync reads after first await). */
export async function hydrateSaleReceiptExtras(): Promise<void> {
  if (memory) return;
  memory = await readAll();
}

export async function setSaleReceiptExtras(
  saleId: string,
  extras: SaleReceiptExtras,
): Promise<void> {
  const all = memory ?? (await readAll());
  const next = { ...all, [saleId]: extras };
  await writeAll(next);
}

export async function getSaleReceiptExtras(saleId: string): Promise<SaleReceiptExtras | undefined> {
  const all = memory ?? (await readAll());
  if (!memory) memory = all;
  return all[saleId];
}

/** Best-effort synchronous read after `hydrateSaleReceiptExtras` or a prior async set. */
export function getSaleReceiptExtrasSync(saleId: string): SaleReceiptExtras | undefined {
  return memory?.[saleId];
}

export async function moveSaleReceiptExtras(fromSaleId: string, toSaleId: string): Promise<void> {
  const all = memory ?? (await readAll());
  const v = all[fromSaleId];
  if (!v) return;
  const next = { ...all, [toSaleId]: v };
  delete next[fromSaleId];
  await writeAll(next);
}

export function mergeReceiptExtras(
  receipt: CompletedSaleReceipt,
  extras?: SaleReceiptExtras,
): CompletedSaleReceipt {
  if (!extras) return receipt;
  return {
    ...receipt,
    customer: extras.customer,
    paymentNote: extras.paymentNote,
    paymentMethodKey: extras.paymentMethodKey,
    paymentMethodLabel: extras.paymentMethodLabel,
    currency: extras.currency,
    businessName: extras.businessName ?? receipt.businessName,
  };
}
