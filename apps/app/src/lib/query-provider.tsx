import { QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

import { createAppQueryClient } from "./query-client";
import { subscribeQueryOnlineManager } from "./query-online";

type Props = { children: React.ReactNode };

export function AppQueryProvider({ children }: Props) {
  const [queryClient] = useState(() => createAppQueryClient());

  useEffect(() => subscribeQueryOnlineManager(), []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
