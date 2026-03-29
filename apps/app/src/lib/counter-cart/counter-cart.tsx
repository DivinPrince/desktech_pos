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
  name: string;
  priceCents: number;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
};

type CartAction =
  | {
      type: "ADD_PRODUCT";
      payload: { productId: string; name: string; priceCents: number };
    }
  | { type: "DECREMENT_PRODUCT"; payload: { productId: string } }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_PRODUCT": {
      const { productId, name, priceCents } = action.payload;
      const idx = state.lines.findIndex((l) => l.productId === productId);
      if (idx >= 0) {
        const lines = state.lines.slice();
        const line = lines[idx]!;
        lines[idx] = { ...line, quantity: line.quantity + 1 };
        return { lines };
      }
      return {
        lines: [
          ...state.lines,
          { productId, name, priceCents, quantity: 1 },
        ],
      };
    }
    case "DECREMENT_PRODUCT": {
      const { productId } = action.payload;
      const idx = state.lines.findIndex((l) => l.productId === productId);
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
  }) => void;
  /** Removes one unit for this product, or drops the line at zero. */
  decrementProduct: (payload: { productId: string }) => void;
  clear: () => void;
  totalCents: number;
  totalUnits: number;
  getQuantity: (productId: string) => number;
};

const CounterCartContext = createContext<CounterCartContextValue | null>(null);

export function CounterCartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addProduct = useCallback(
    (payload: { productId: string; name: string; priceCents: number }) => {
      dispatch({ type: "ADD_PRODUCT", payload });
    },
    [],
  );

  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const decrementProduct = useCallback((payload: { productId: string }) => {
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
      state.lines.find((l) => l.productId === productId)?.quantity ?? 0,
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
