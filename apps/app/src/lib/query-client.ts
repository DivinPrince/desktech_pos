import { QueryClient, onlineManager } from "@tanstack/react-query";

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 1_000 * 60 * 60 * 24,
        retry: 1,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

export { onlineManager };
