import type { SalesRangeBounds } from "./types";

export type ReportPeriodPreset = "today" | "last7" | "month" | "all";

function localStartOfDay(day: Date): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfNextLocalDay(day: Date): number {
  const d = localStartOfDay(day);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * Half-open `[startMs, endMs)` covering “through end of today” (exclusive upper = start of tomorrow).
 */
export function reportPeriodBounds(
  preset: ReportPeriodPreset,
  now: Date = new Date(),
): SalesRangeBounds {
  const endMs = startOfNextLocalDay(now);

  switch (preset) {
    case "today":
      return { startMs: localStartOfDay(now).getTime(), endMs };
    case "last7": {
      const start = localStartOfDay(now);
      start.setDate(start.getDate() - 6);
      return { startMs: start.getTime(), endMs };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { startMs: start.getTime(), endMs };
    }
    case "all":
      return { startMs: 0, endMs };
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

export function reportPeriodLabel(preset: ReportPeriodPreset): string {
  switch (preset) {
    case "today":
      return "Today";
    case "last7":
      return "Last 7 days";
    case "month":
      return "This month";
    case "all":
      return "All time";
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

export function previousReportPeriodBounds(
  preset: ReportPeriodPreset,
  now: Date = new Date(),
): SalesRangeBounds | null {
  switch (preset) {
    case "today": {
      const start = localStartOfDay(now);
      start.setDate(start.getDate() - 1);
      const end = localStartOfDay(now);
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
    case "last7": {
      const start = localStartOfDay(now);
      start.setDate(start.getDate() - 13);
      const end = localStartOfDay(now);
      end.setDate(end.getDate() - 6);
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
    case "all":
      return null;
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}
