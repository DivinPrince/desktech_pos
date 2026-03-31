import type { Ionicons } from "@expo/vector-icons";

import type { PaymentMethodKey } from "@/lib/counter-checkout/types";

type IonName = keyof typeof Ionicons.glyphMap;

export const PAYMENT_OPTIONS: {
  key: PaymentMethodKey;
  label: string;
  apiValue: string;
  icon: IonName;
  iconHex: string;
  chipClass: string;
}[] = [
  {
    key: "cash",
    label: "Cash",
    apiValue: "cash",
    icon: "wallet-outline",
    iconHex: "#059669",
    chipClass: "bg-emerald-500/18",
  },
  {
    key: "debit_card",
    label: "Debit card",
    apiValue: "debit_card",
    icon: "card-outline",
    iconHex: "#b45309",
    chipClass: "bg-amber-600/18",
  },
  {
    key: "credit_card",
    label: "Credit card",
    apiValue: "credit_card",
    icon: "card",
    iconHex: "#7c3aed",
    chipClass: "bg-violet-500/18",
  },
  {
    key: "store_credit",
    label: "Credit",
    apiValue: "store_credit",
    icon: "receipt-outline",
    iconHex: "#c2410c",
    chipClass: "bg-orange-500/18",
  },
];

export function paymentConfirmButtonLabel(key: PaymentMethodKey): string {
  const label = PAYMENT_OPTIONS.find((o) => o.key === key)?.label ?? key;
  return `Received by ${label}`;
}

/** Icon + colors aligned with checkout payment picker (`checkout-details.tsx`). */
export function paymentDisplayForKey(key: PaymentMethodKey): {
  icon: IonName;
  iconHex: string;
  label: string;
} {
  const o = PAYMENT_OPTIONS.find((x) => x.key === key);
  if (o) {
    return { icon: o.icon, iconHex: o.iconHex, label: o.label };
  }
  return {
    icon: "card-outline",
    iconHex: "#64748b",
    label: String(key),
  };
}
