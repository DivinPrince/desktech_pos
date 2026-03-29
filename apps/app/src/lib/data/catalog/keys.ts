/** Stable TanStack Query / collection key factories (mirrors `business-catalog.ts`). */
export const catalogDataKeys = {
  all: ["businesses"] as const,
  list: () => [...catalogDataKeys.all, "list"] as const,
  categoriesRoot: (businessId: string) => ["catalog", businessId, "categories"] as const,
  productsRoot: (
    businessId: string,
    params: { activeOnly: boolean; search: string },
  ) => ["catalog", businessId, "products", params] as const,
  product: (businessId: string, productId: string) =>
    ["catalog", businessId, "product", productId] as const,
};
