import type { OfflineExecutor } from "@tanstack/offline-transactions/react-native";

import { fetchDeviceAppearsOnline } from "@/lib/network/fetch-device-online";

export type ManualOutboxNudgeResult = {
  ok: boolean;
  title: string;
  message: string;
};

function formatLastErrors(
  txs: Array<{ lastError?: { message: string; name?: string } }>,
): string {
  const parts = txs
    .map((t) => t.lastError?.message?.trim())
    .filter((m): m is string => Boolean(m && m.length > 0));
  if (parts.length === 0) return "";
  const unique = [...new Set(parts)];
  return `\n\nLast API error(s):\n${unique.map((p) => `• ${p}`).join("\n")}`;
}

/**
 * User-triggered: fresh NetInfo, notify the online detector, poll outbox shrink.
 * Helps debug “Sync pending” when automatic replay did not run.
 */
export async function nudgeOfflineOutboxReplay(
  executor: OfflineExecutor | null,
): Promise<ManualOutboxNudgeResult> {
  if (!executor) {
    return {
      ok: false,
      title: "Sync not available",
      message:
        "The offline layer is still starting. Close and reopen the app, then try again.",
    };
  }

  await executor.waitForInit();

  const netOnline = await fetchDeviceAppearsOnline();
  const executorReportsOnline = executor.isOnline();
  const offlineActive = executor.isOfflineEnabled;
  const mode = executor.mode;

  if (mode === "online-only") {
    return {
      ok: false,
      title: "No offline queue",
      message:
        "This device is in online-only mode (offline storage unavailable). Pending labels should not apply—pull to refresh Today or complete checkout again.",
    };
  }

  if (!offlineActive) {
    return {
      ok: false,
      title: "Not the sync leader",
      message:
        "Another tab or instance holds offline sync (common on web). Use one window, or focus this app so it becomes leader. NetInfo online: " +
        `${netOnline}. Executor “online” flag: ${executorReportsOnline}.`,
    };
  }

  if (!netOnline) {
    return {
      ok: false,
      title: "Device looks offline",
      message:
        "NetInfo reports no connection or no internet reachability. Connect to the network, then tap Retry again.\n\n" +
        `(Executor “online” flag: ${executorReportsOnline} — it can be wrong until NetInfo updates.)`,
    };
  }

  const peekBefore = await executor.peekOutbox();
  const pendingBefore = executor.getPendingCount();

  if (peekBefore.length === 0 && pendingBefore === 0) {
    return {
      ok: false,
      title: "Nothing in the upload queue",
      message:
        "The outbox is empty, so there is nothing to retry. If Today still shows “Sync pending”, those entries may be orphaned (no matching queued request). New checkouts should upload when you are online.\n\n" +
        `Executor pending count: ${pendingBefore}.`,
    };
  }

  try {
    executor.getOnlineDetector().notifyOnline();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      title: "Could not wake sync",
      message: msg,
    };
  }

  const deadline = Date.now() + 14_000;
  let lastPeek = peekBefore;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 450));
    lastPeek = await executor.peekOutbox();
    const p = executor.getPendingCount();
    if (lastPeek.length === 0 && p === 0) break;
    if (lastPeek.length < peekBefore.length) break;
  }

  const peekAfter = lastPeek;
  const shrunk = peekAfter.length < peekBefore.length;
  const cleared = peekAfter.length === 0 && executor.getPendingCount() === 0;

  if (cleared || shrunk) {
    return {
      ok: true,
      title: cleared ? "Queue cleared" : "Replay progressed",
      message:
        `Before: ${peekBefore.length} queued · After: ${peekAfter.length} queued. ` +
        `Pending scheduler count: ${pendingBefore} → ${executor.getPendingCount()}.\n\n` +
        "Return to Today—IDs should update from pending:… if the server accepted the sale.",
    };
  }

  const errHint = formatLastErrors(peekAfter);
  const names = [...new Set(peekAfter.map((t) => t.mutationFnName))].join(", ") || "unknown";

  return {
    ok: false,
    title: "Still waiting on server",
    message:
      `Queue still has ${peekAfter.length} item(s): ${names}. ` +
      `NetInfo: online · Executor flag: ${executorReportsOnline} · Leader/offline mode: active.\n\n` +
      "If this persists, open Metro and search for [desktech] or “failed permanently”." +
      errHint,
  };
}
