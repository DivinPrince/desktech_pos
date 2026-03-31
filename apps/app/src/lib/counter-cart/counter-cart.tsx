import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

export type CartLine = {
  productId: string;
  /** Set when the catalog product has variants (required for checkout and stock). */
  productVariantId?: string;
  name: string;
  priceCents: number;
  quantity: number;
};

/** Stable list key when the same product can appear as multiple variant lines. */
export function cartLineKey(line: Pick<CartLine, "productId" | "productVariantId">): string {
  return `${line.productId}\u0000${line.productVariantId ?? ""}`;
}

function sameLine(
  a: Pick<CartLine, "productId" | "productVariantId">,
  b: Pick<CartLine, "productId" | "productVariantId">,
): boolean {
  return a.productId === b.productId && (a.productVariantId ?? "") === (b.productVariantId ?? "");
}

type CartState = {
  lines: CartLine[];
};

type CartAction =
  | {
      type: "ADD_PRODUCT";
      payload: { productId: string; name: string; priceCents: number; productVariantId?: string };
    }
  | { type: "DECREMENT_PRODUCT"; payload: { productId: string; productVariantId?: string } }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_PRODUCT": {
      const { productId, name, priceCents, productVariantId } = action.payload;
      const idx = state.lines.findIndex((l) => sameLine(l, { productId, productVariantId }));
      if (idx >= 0) {
        const lines = state.lines.slice();
        const line = lines[idx]!;
        lines[idx] = { ...line, quantity: line.quantity + 1 };
        return { lines };
      }
      return {
        lines: [
          ...state.lines,
          {
            productId,
            ...(productVariantId !== undefined ? { productVariantId } : {}),
            name,
            priceCents,
            quantity: 1,
          },
        ],
      };
    }
    case "DECREMENT_PRODUCT": {
      const { productId, productVariantId } = action.payload;
      const idx = state.lines.findIndex((l) => sameLine(l, { productId, productVariantId }));
      if (idx < 0) return state;
      const lines = state.lines.slice();
      const line = lines[idx]!;
      if (line.quantity <= 1) {
        lines.splice(idx, 1);
      } else {
        lines[idx] = { ...line, quantity: line.quantity - 1 };
      }
      return { lines };
    }
    case "CLEAR":
      return { lines: [] };
    default:
      return state;
  }
}

const initialState: CartState = { lines: [] };

type CounterCartContextValue = {
  lines: CartLine[];
  addProduct: (payload: {
    productId: string;
    name: string;
    priceCents: number;
    productVariantId?: string;
  }) => void;
  /** Removes one unit for this line identity, or drops the line at zero. */
  decrementProduct: (payload: { productId: string; productVariantId?: string }) => void;
  clear: () => void;
  totalCents: number;
  totalUnits: number;
  getQuantity: (productId: string) => number;
};

const CounterCartContext = createContext<CounterCartContextValue | null>(null);

export function CounterCartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addProduct = useCallback(
    (payload: {
      productId: string;
      name: string;
      priceCents: number;
      productVariantId?: string;
    }) => {
      dispatch({ type: "ADD_PRODUCT", payload });
    },
    [],
  );

  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const decrementProduct = useCallback((payload: { productId: string; productVariantId?: string }) => {
    dispatch({ type: "DECREMENT_PRODUCT", payload });
  }, []);

  const totalCents = useMemo(
    () =>
      state.lines.reduce(
        (sum, line) => sum + line.priceCents * line.quantity,
        0,
      ),
    [state.lines],
  );

  const totalUnits = useMemo(
    () => state.lines.reduce((sum, line) => sum + line.quantity, 0),
    [state.lines],
  );

  const getQuantity = useCallback(
    (productId: string) =>
      state.lines.reduce((sum, l) => (l.productId === productId ? sum + l.quantity : sum), 0),
    [state.lines],
  );

  const value = useMemo(
    (): CounterCartContextValue => ({
      lines: state.lines,
      addProduct,
      decrementProduct,
      clear,
      totalCents,
      totalUnits,
      getQuantity,
    }),
    [
      state.lines,
      addProduct,
      decrementProduct,
      clear,
      totalCents,
      totalUnits,
      getQuantity,
    ],
  );

  return (
    <CounterCartContext.Provider value={value}>
      {children}
    </CounterCartContext.Provider>
  );
}

export function useCounterCart(): CounterCartContextValue {
  const ctx = useContext(CounterCartContext);
  if (!ctx) {
    throw new Error("useCounterCart must be used within CounterCartProvider");
  }
  return ctx;
}
