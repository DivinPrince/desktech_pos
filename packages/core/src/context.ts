import { AsyncLocalStorage } from "async_hooks";

export function createContext<T>() {
  const storage = new AsyncLocalStorage<T>();

  return {
    get() {
      const result = storage.getStore();
      if (!result) {
        throw new Error("Context not found");
      }
      return result;
    },
    with<R>(value: T, fn: () => R): R {
      return storage.run(value, fn);
    },
    provide<R>(value: T, fn: () => R): R {
      return storage.run(value, fn);
    },
  };
}
