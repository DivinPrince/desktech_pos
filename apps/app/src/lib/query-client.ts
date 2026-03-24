import { QueryClient, onlineManager } from "@tanstack/react-query";

export const REACT_QUERY_PERSIST_KEY = "desktech_react_query_v1";

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        staleTime: 60_000,
        gcTime: 1_000 * 60 * 60 * 24,
        retry: 1,
      },
      mutations: {
        networkMode: "offlineFirst",
        retry: 1,
      },
    },
  });
}

export { onlineManager };
