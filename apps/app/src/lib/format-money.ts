import { data as currencyRecords } from "currency-codes";

const digitsByCode = new Map(
  currencyRecords.map((c) => [c.code, Number(c.digits)] as const),
);

/**
 * Format integer minor units (e.g. API `priceCents`) per ISO 4217 for the currency.
 * Defaults to `en-US` number shape so symbols stay short (e.g. `$1,000.00` not `US$1,000.00`).
 */
export function formatMinorUnitsToCurrency(
  amountMinorUnits: number,
  currencyCode: string,
  locale?: string,
): string {
  const code = currencyCode.trim().toUpperCase();
  const digits = digitsByCode.get(code) ?? 2;
  const divisor = 10 ** digits;
  const amount = amountMinorUnits / divisor;
  const loc = locale ?? "en-US";

  let formatted = new Intl.NumberFormat(loc, {
    style: "currency",
    currency: code,
    currencyDisplay: "symbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(amount);

  // Disambiguated USD on some platforms/locales (e.g. `US$`, `US$ `, narrow no-break space).
  if (code === "USD") {
    formatted = formatted
      .replace(/^US\$\u00a0?/, "$")
      .replace(/^US\$/, "$")
      .trim();
  }

  return formatted;
}

function minorDigitsForCurrency(currencyCode: string): number {
  const code = currencyCode.trim().toUpperCase();
  return digitsByCode.get(code) ?? 2;
}

/**
 * Parse a user-entered major-units amount (e.g. `12.99`) into integer minor units for the API.
 * Returns `null` if empty or invalid.
 */
export function parseMajorUnitsToMinorUnits(
  input: string,
  currencyCode: string,
): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = Number.parseFloat(trimmed);
  if (Number.isNaN(n) || n < 0) return null;
  const digits = minorDigitsForCurrency(currencyCode);
  return Math.round(n * 10 ** digits);
}

/**
 * Format minor units as a plain decimal string for editable fields (no currency symbol).
 */
export function minorUnitsToMajorDecimalString(
  amountMinorUnits: number,
  currencyCode: string,
): string {
  const digits = minorDigitsForCurrency(currencyCode);
  const divisor = 10 ** digits;
  const s = (amountMinorUnits / divisor).toFixed(digits);
  if (digits === 0) return s;
  // Trim trailing zeros after decimal only (keep "1.99" intact).
  return s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "") || "0";
}
