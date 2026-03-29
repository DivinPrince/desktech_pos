import type { OfflineExecutor } from "@tanstack/offline-transactions/react-native";

/**
 * Apply optimistic collection changes via `mutate`, persist to the outbox, and return immediately
 * (no `await` on the network). `persistTransaction` waits for init internally when `commit()` runs.
 * When online, optionally triggers a catalog invalidate after replay so server IDs win (creates).
 */
export function runCatalogOutboxMutation<T>(args: {
  executor: OfflineExecutor;
  mutationFnName: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  mutate: () => void;
  optimisticResult: T;
  invalidate: () => void;
  /** When false, skip refetch after successful online replay (updates already mirrored locally). Default true. */
  invalidateAfterSuccess?: boolean;
}): T {
  const {
    executor,
    mutationFnName,
    idempotencyKey,
    metadata,
    mutate,
    optimisticResult,
    invalidate,
    invalidateAfterSuccess = true,
  } = args;

  const offlineTx = executor.createOfflineTransaction({
    mutationFnName,
    idempotencyKey,
    metadata,
    autoCommit: false,
  });

  offlineTx.mutate(mutate);

  void offlineTx.commit().catch((err) => {
    if (__DEV__) {
      console.warn(`[desktech] Offline outbox commit failed (${mutationFnName})`, err);
    }
    invalidate();
  });

  if (executor.isOnline()) {
    void executor
      .waitForTransactionCompletion(offlineTx.id)
      .then(() => {
        if (invalidateAfterSuccess) invalidate();
      })
      .catch((err) => {
        if (__DEV__) {
          console.warn(
            `[desktech] Offline transaction did not complete (${mutationFnName})`,
            err,
          );
        }
        invalidate();
      });
  }

  return optimisticResult;
}
