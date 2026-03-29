import type { CartLine } from "@/lib/counter-cart/counter-cart";

export type PaymentMethodKey =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "store_credit";

export type CheckoutCustomer = {
  /** ITU-style dial prefix shown in the narrow field (e.g. +232). */
  dialCode: string;
  name: string;
  /** National number (without dial code). */
  phone: string;
  email: string;
  address: string;
};

export type CompletedSaleReceipt = {
  saleId: string;
  totalCents: number;
  currency: string;
  businessName?: string;
  completedAtIso: string;
  lines: CartLine[];
  paymentMethodKey: PaymentMethodKey;
  paymentMethodLabel: string;
  customer: CheckoutCustomer;
  paymentNote: string;
};
