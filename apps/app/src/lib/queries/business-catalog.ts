import { useQuery } from "@tanstack/react-query";

import { useApiSdk } from "../api-sdk";

export const businessKeys = {
  all: ["businesses"] as const,
  list: () => [...businessKeys.all, "list"] as const,
};

export const catalogKeys = {
  all: (businessId: string) => ["catalog", businessId] as const,
  categories: (businessId: string) => [...catalogKeys.all(businessId), "categories"] as const,
  products: (businessId: string) => [...catalogKeys.all(businessId), "products"] as const,
};

export function useBusinessesQuery(enabled: boolean) {
  const sdk = useApiSdk();
  return useQuery({
    queryKey: businessKeys.list(),
    enabled,
    meta: { persist: true },
    queryFn: async () => {
      const { data } = await sdk.businesses.list().withResponse();
      return data.data;
    },
  });
}

export function useCategoriesQuery(businessId: string | undefined, enabled: boolean) {
  const sdk = useApiSdk();
  return useQuery({
    queryKey: catalogKeys.categories(businessId ?? ""),
    enabled: Boolean(businessId) && enabled,
    meta: { persist: true },
    queryFn: async () => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .listCategories()
        .withResponse();
      return data.data;
    },
  });
}

export function useProductsQuery(businessId: string | undefined, enabled: boolean) {
  const sdk = useApiSdk();
  return useQuery({
    queryKey: catalogKeys.products(businessId ?? ""),
    enabled: Boolean(businessId) && enabled,
    meta: { persist: true },
    queryFn: async () => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .listProducts({ activeOnly: true })
        .withResponse();
      return data.data;
    },
  });
}
