/** Vendored from libphonenumber-js `metadata.min.json` (no runtime import of that package — Metro can break its Metadata export chain). */
import metadata from "./data/libphonenumber-metadata.min.json";

/** ISO 3166-1 alpha-2 (same values libphonenumber-js uses). */
export type CountryIso = string;

export type CountryDialEntry = {
  iso: CountryIso;
  name: string;
  dial: string;
  dialDisplay: string;
  flag: string;
};

type MinMetadata = {
  countries?: Record<string, unknown[]>;
};

let cached: CountryDialEntry[] | null = null;

function flagEmoji(iso: string): string {
  const upper = iso.toUpperCase();
  if (upper.length !== 2) return "\u{1f3f3}";
  const base = 0x1f1e6;
  const a = upper.codePointAt(0);
  const b = upper.codePointAt(1);
  if (a === undefined || b === undefined) return "\u{1f3f3}";
  return String.fromCodePoint(base + (a - 65), base + (b - 65));
}

function isIsoAlpha2(iso: string): boolean {
  return /^[A-Z]{2}$/i.test(iso);
}

function regionLabel(iso: string): string {
  try {
    const Ctor = Intl.DisplayNames;
    if (typeof Ctor !== "function") return iso;
    const dn = new Ctor(["en"], { type: "region" });
    if (dn == null || typeof dn.of !== "function") return iso;
    const label = dn.of(iso);
    return typeof label === "string" && label.length > 0 ? label : iso;
  } catch {
    return iso;
  }
}

/**
 * All supported countries with ITU dial codes, sorted by localized name.
 * Cached for the lifetime of the JS context.
 */
export function getCountryDialList(): CountryDialEntry[] {
  if (cached) return cached;

  const countries = (metadata as MinMetadata).countries;
  if (!countries || typeof countries !== "object") {
    throw new Error("[desktech] libphonenumber-metadata.min.json missing .countries");
  }

  const entries: CountryDialEntry[] = [];

  for (const iso of Object.keys(countries)) {
    if (iso === "001") continue;
    if (!isIsoAlpha2(iso)) continue;

    const row = countries[iso];
    const dialRaw = row?.[0];
    const dial = typeof dialRaw === "string" ? dialRaw : String(dialRaw ?? "");
    if (!dial) continue;

    entries.push({
      iso: iso.toUpperCase(),
      name: regionLabel(iso),
      dial,
      dialDisplay: `+${dial}`,
      flag: flagEmoji(iso),
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  cached = entries;
  return entries;
}

export function countryDialByIso(iso: string | undefined): CountryDialEntry | undefined {
  if (!iso) return undefined;
  const upper = iso.toUpperCase();
  return getCountryDialList().find((e) => e.iso === upper);
}
