import { formatDistanceToNowStrict } from "date-fns/formatDistanceToNowStrict";
import { formatRelative } from "date-fns/formatRelative";
import { isToday } from "date-fns/isToday";

export function formatSaleCompletedAt(completedAtIso: string, now = new Date()): string {
  const completedAt = new Date(completedAtIso);

  if (Number.isNaN(completedAt.getTime())) {
    return completedAtIso;
  }

  if (isToday(completedAt)) {
    return formatDistanceToNowStrict(completedAt, {
      addSuffix: true,
      unit: "minute",
    });
  }

  return formatRelative(completedAt, now);
}
