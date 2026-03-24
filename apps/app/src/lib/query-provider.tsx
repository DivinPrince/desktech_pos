import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";

import { useOutboxFlush } from "./db/use-outbox-flush";
import { createAppQueryClient, REACT_QUERY_PERSIST_KEY } from "./query-client";
import { subscribeQueryOnlineManager } from "./query-online";

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: REACT_QUERY_PERSIST_KEY,
});

type Props = { children: React.ReactNode };

function LocalDataBootstrap() {
  useOutboxFlush();
  return null;
}

export function AppQueryProvider({ children }: Props) {
  const [queryClient] = useState(() => createAppQueryClient());

  useEffect(() => subscribeQueryOnlineManager(), []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            if (query.state.status === "pending") return false;
            return query.meta?.persist !== false;
          },
        },
      }}
    >
      <LocalDataBootstrap />
      {children}
    </PersistQueryClientProvider>
  );
}
