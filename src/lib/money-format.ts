/** Map next-intl locale codes to BCP 47 tags for `Intl` / `toLocaleString`. */
export function intlLocaleFromAppLocale(appLocale: string): string {
  const map: Record<string, string> = {
    en: "en-GB",
    pt: "pt-PT",
    es: "es-ES",
    fr: "fr-FR",
  };
  return map[appLocale] ?? appLocale;
}

export function formatMoneyAmountTwoDecimals(value: number, localeTag: string): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString(localeTag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseMoneyInputString(raw: string): number {
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return NaN;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * On blur: empty stays empty; otherwise always two decimal places in the given locale.
 */
export function normalizeMoneyInputString(raw: string, localeTag: string): string {
  const trimmed = String(raw).trim();
  if (trimmed === "") return "";
  const n = parseMoneyInputString(trimmed);
  if (Number.isNaN(n)) return formatMoneyAmountTwoDecimals(0, localeTag);
  return formatMoneyAmountTwoDecimals(n, localeTag);
}
