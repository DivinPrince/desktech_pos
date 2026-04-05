import type {
  CheckoutCustomer,
  CompletedSaleReceipt,
  PaymentMethodKey,
} from "@/lib/counter-checkout/types";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type {
  CheckoutCustomer,
  CompletedSaleReceipt,
  PaymentMethodKey,
} from "@/lib/counter-checkout/types";

export {
  PAYMENT_OPTIONS,
  paymentConfirmButtonLabel,
} from "@/lib/counter-checkout/payment-options";

const emptyCustomer = (): CheckoutCustomer => ({
  dialCode: "+1",
  phoneCountryIso: "US",
  name: "",
  phone: "",
  email: "",
  address: "",
});

type CounterCheckoutContextValue = {
  customer: CheckoutCustomer;
  setCustomer: (next: CheckoutCustomer) => void;
  paymentMethod: PaymentMethodKey | null;
  setPaymentMethod: (m: PaymentMethodKey | null) => void;
  paymentNote: string;
  setPaymentNote: (note: string) => void;
  lastCompleted: CompletedSaleReceipt | null;
  setLastCompleted: (r: CompletedSaleReceipt | null) => void;
  resetForNewCheckout: () => void;
  clearLastCompleted: () => void;
};

const CounterCheckoutContext =
  createContext<CounterCheckoutContextValue | null>(null);

export function CounterCheckoutProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<CheckoutCustomer>(emptyCustomer);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey | null>(
    null,
  );
  const [paymentNote, setPaymentNote] = useState("");
  const [lastCompleted, setLastCompleted] =
    useState<CompletedSaleReceipt | null>(null);

  const setCustomer = useCallback((next: CheckoutCustomer) => {
    setCustomerState(next);
  }, []);

  const resetForNewCheckout = useCallback(() => {
    setCustomerState(emptyCustomer());
    setPaymentMethod(null);
    setPaymentNote("");
  }, []);

  const clearLastCompleted = useCallback(() => {
    setLastCompleted(null);
  }, []);

  const value = useMemo(
    (): CounterCheckoutContextValue => ({
      customer,
      setCustomer,
      paymentMethod,
      setPaymentMethod,
      paymentNote,
      setPaymentNote,
      lastCompleted,
      setLastCompleted,
      resetForNewCheckout,
      clearLastCompleted,
    }),
    [
      customer,
      setCustomer,
      paymentMethod,
      paymentNote,
      lastCompleted,
      resetForNewCheckout,
      clearLastCompleted,
    ],
  );

  return (
    <CounterCheckoutContext.Provider value={value}>
      {children}
    </CounterCheckoutContext.Provider>
  );
}

export function useCounterCheckout(): CounterCheckoutContextValue {
  const ctx = useContext(CounterCheckoutContext);
  if (!ctx) {
    throw new Error(
      "useCounterCheckout must be used within CounterCheckoutProvider",
    );
  }
  return ctx;
}
