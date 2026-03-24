import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiSdk } from "../api-sdk";

export const businessKeys = {
  all: ["businesses"] as const,
  list: () => [...businessKeys.all, "list"] as const,
};

export const catalogKeys = {
  all: (businessId: string) => ["catalog", businessId] as const,
  categories: (businessId: string) => [...catalogKeys.all(businessId), "categories"] as const,
  products: (
    businessId: string,
    params: { activeOnly: boolean; search: string },
  ) => [...catalogKeys.all(businessId), "products", params] as const,
  product: (businessId: string, productId: string) =>
    [...catalogKeys.all(businessId), "product", productId] as const,
};

export type ProductsQueryFilters = {
  /** When true, only active products. When false, include inactive. Default true. */
  activeOnly?: boolean;
  /** Server-side name/SKU search (trimmed). */
  search?: string;
};

/** Payload shapes aligned with `@repo/core` ProductService (businessId set by route). */
export type ProductCreateBody = {
  categoryId?: string;
  name: string;
  sku?: string;
  unit?: string;
  description?: string;
  priceCents: number;
  costCents?: number;
  reorderLevel?: number;
  trackStock?: boolean;
  active?: boolean;
};

export type ProductUpdateBody = {
  categoryId?: string | null;
  name?: string;
  sku?: string | null;
  unit?: string;
  description?: string | null;
  priceCents?: number;
  costCents?: number | null;
  reorderLevel?: number;
  trackStock?: boolean;
  active?: boolean;
};

export type CategoryCreateBody = {
  name: string;
  parentId?: string;
  sortOrder?: number;
};

export type CategoryUpdateBody = {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
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

export function useProductsQuery(
  businessId: string | undefined,
  enabled: boolean,
  filters?: ProductsQueryFilters,
) {
  const sdk = useApiSdk();
  const activeOnly = filters?.activeOnly ?? true;
  const search = (filters?.search ?? "").trim();
  return useQuery({
    queryKey: catalogKeys.products(businessId ?? "", {
      activeOnly,
      search,
    }),
    enabled: Boolean(businessId) && enabled,
    meta: { persist: true },
    queryFn: async () => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .listProducts({
          activeOnly,
          search: search.length > 0 ? search : undefined,
        })
        .withResponse();
      return data.data;
    },
  });
}

export function useProductQuery(
  businessId: string | undefined,
  productId: string | undefined,
  enabled: boolean,
) {
  const sdk = useApiSdk();
  return useQuery({
    queryKey: catalogKeys.product(businessId ?? "", productId ?? ""),
    enabled: Boolean(businessId && productId && enabled),
    queryFn: async () => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .getProduct(productId!)
        .withResponse();
      return data.data;
    },
  });
}

function useInvalidateCatalog(businessId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (businessId) {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all(businessId) });
    }
  };
}

export function useCreateProductMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (body: ProductCreateBody) => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .createProduct(body)
        .withResponse();
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateProductMutation(
  businessId: string | undefined,
  productId: string | undefined,
) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (body: ProductUpdateBody) => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .updateProduct(productId!, body)
        .withResponse();
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteProductMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (productId: string) => {
      await sdk.businesses.business(businessId!).deleteProduct(productId).withResponse();
    },
    onSuccess: invalidate,
  });
}

export function useCreateCategoryMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (body: CategoryCreateBody) => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .createCategory(body)
        .withResponse();
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCategoryMutation(
  businessId: string | undefined,
  categoryId: string | undefined,
) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (body: CategoryUpdateBody) => {
      const { data } = await sdk
        .businesses
        .business(businessId!)
        .updateCategory(categoryId!, body)
        .withResponse();
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCategoryMutation(businessId: string | undefined) {
  const sdk = useApiSdk();
  const invalidate = useInvalidateCatalog(businessId);
  return useMutation({
    mutationFn: async (categoryId: string) => {
      await sdk.businesses.business(businessId!).deleteCategory(categoryId).withResponse();
    },
    onSuccess: invalidate,
  });
}
