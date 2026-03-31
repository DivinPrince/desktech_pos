/** Stable TanStack Query / sales collection key factories. */
export const salesDataKeys = {
  root: (businessId: string) => ["sales", businessId] as const,
  list: (businessId: string, fromIso: string, toIso: string, limit: number) =>
    [...salesDataKeys.root(businessId), "list", fromIso, toIso, limit] as const,
  sale: (businessId: string, saleId: string) =>
    [...salesDataKeys.root(businessId), "sale", saleId] as const,
};
