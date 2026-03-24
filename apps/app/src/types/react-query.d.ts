import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /** When false, query is excluded from AsyncStorage persistence */
      persist?: boolean;
    };
  }
}
