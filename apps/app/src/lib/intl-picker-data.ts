import { data as currencyRecords } from "currency-codes";
import { timeZonesNames } from "@vvo/tzdb";

const currencyByCode = new Map(
  currencyRecords.map((c) => [c.code, c.currency] as const),
);

export function getSortedTimeZoneIds(): string[] {
  return [...timeZonesNames].sort((a, b) => a.localeCompare(b));
}

export function getSortedCurrencyCodes(): string[] {
  return currencyRecords
    .map((c) => c.code)
    .sort((a, b) => a.localeCompare(b));
}

export function formatCurrencyChoice(code: string): string {
  const upper = code.trim().toUpperCase();
  const name = currencyByCode.get(upper);
  return name ? `${upper} — ${name}` : upper;
}

export function formatTimeZoneOffsetLabel(timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const part = formatter
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

export function getDefaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}
