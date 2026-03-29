import type { OfflineExecutor } from "@tanstack/offline-transactions/react-native";
import type { QueryClient } from "@tanstack/react-query";

import { nudgeOfflineOutboxReplay } from "@/lib/data/offline/manual-outbox-nudge";

import { recoverOrphanPendingLocalSales } from "./recover-orphan-pending";

/**
 * Full “Retry server sync” on Today: retry the outbox, then fix orphaned `pending:…` rows
 * (local-only receipt with no matching outbox entry).
 */
export async function syncPendingSalesToday(args: {
  executor: OfflineExecutor | null;
  businessId: string;
  queryClient: QueryClient;
}): Promise<{ title: string; message: string }> {
  const nudge = await nudgeOfflineOutboxReplay(args.executor);
  const recover = await recoverOrphanPendingLocalSales({
    businessId: args.businessId,
    queryClient: args.queryClient,
  });

  const message = [
    "1) Outbox retry",
    `${nudge.title}: ${nudge.message}`,
    "",
    "2) Orphaned local pending rows",
    `${recover.title}: ${recover.message}`,
  ].join("\n");

  return {
    title: "Server sync",
    message,
  };
}
