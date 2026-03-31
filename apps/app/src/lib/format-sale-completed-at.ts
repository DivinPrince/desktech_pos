import { formatRelative } from "date-fns/formatRelative";

export function formatSaleCompletedAt(completedAtIso: string, now = new Date()): string {
  const completedAt = new Date(completedAtIso);

  if (Number.isNaN(completedAt.getTime())) {
    return completedAtIso;
  }

  return formatRelative(completedAt, now);
}
