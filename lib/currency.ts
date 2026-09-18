/**
 * Currency table and money formatting.
 *
 * Every amount in this app is an integer in the currency's *minor* unit —
 * paise for INR, cents for USD, whole yen for JPY. Floats are never used to
 * hold money: 0.1 + 0.2 on a line item is how invoices end up a rupee off the
 * total, and an invoice that does not add up is not an invoice.
 *
 * `decimals` therefore does double duty: it is both how many fraction digits
 * to print and the power of ten that converts major to minor. JPY at 0 means
 * ¥500 is stored as 500, not 50000.
 */

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  /** Fraction digits, and the major↔minor exponent. */
  decimals: number;
  /** Locale used for digit grouping. */
  locale: string;
  /**
   * Indian currencies group as 1,00,000 rather than 100,000. Intl gets this
   * right from the locale, but the amount-in-words conversion needs to know
   * explicitly whether to speak lakh/crore or million/billion.
   */
  numbering: "indian" | "western";
  /** Word used for the minor unit when writing amounts out in words. */
  minorName: string;
}

export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2, locale: "en-IN", numbering: "indian", minorName: "Paise" },
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, locale: "en-US", numbering: "western", minorName: "Cents" },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2, locale: "de-DE", numbering: "western", minorName: "Cents" },
  { code: "GBP", symbol: "£", name: "Pound Sterling", decimals: 2, locale: "en-GB", numbering: "western", minorName: "Pence" },
  { code: "AED", symbol: "AED", name: "UAE Dirham", decimals: 2, locale: "en-AE", numbering: "western", minorName: "Fils" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2, locale: "en-SG", numbering: "western", minorName: "Cents" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2, locale: "en-AU", numbering: "western", minorName: "Cents" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2, locale: "en-CA", numbering: "western", minorName: "Cents" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0, locale: "ja-JP", numbering: "western", minorName: "" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", decimals: 2, locale: "de-CH", numbering: "western", minorName: "Rappen" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal", decimals: 2, locale: "en-SA", numbering: "western", minorName: "Halala" },
  { code: "ZAR", symbol: "R", name: "South African Rand", decimals: 2, locale: "en-ZA", numbering: "western", minorName: "Cents" },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** Falls back to INR so a corrupted saved draft still renders something sane. */
export function currencyOf(code: string): Currency {
  return BY_CODE.get(code) ?? CURRENCIES[0];
}

/** 10^decimals — the major→minor multiplier. */
export function minorPerMajor(c: Currency): number {
  return 10 ** c.decimals;
}

/**
 * Parse user keystrokes into minor units.
 *
 * Deliberately permissive: people paste "₹1,10,000.00" and "1 10 000" out of
 * spreadsheets and emails. Everything that is not a digit, dot or minus is
 * stripped before parsing, so grouping separators never corrupt the value.
 *
 * Rounds at the end because `2.345 * 100` is `234.49999999999997` in binary
 * floating point, and truncating that would silently lose a paisa.
 */
export function parseMoney(input: string, c: Currency): number {
  const cleaned = input.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const major = Number.parseFloat(cleaned);
  if (!Number.isFinite(major)) return 0;
  return Math.round(major * minorPerMajor(c));
}

/** Minor units back to a plain editable string, with no symbol or grouping. */
export function toMajorString(minor: number, c: Currency): string {
  return (minor / minorPerMajor(c)).toFixed(c.decimals);
}

/** Grouped amount without the symbol, e.g. "2,59,600.00". */
export function formatNumber(minor: number, c: Currency): string {
  return new Intl.NumberFormat(c.locale, {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  }).format(minor / minorPerMajor(c));
}

/**
 * Full amount with symbol, e.g. "₹2,59,600.00".
 *
 * The symbol is prepended manually rather than using Intl's `style: "currency"`
 * because Intl renders some codes as "SGD 500.00" and others as "S$500.00"
 * depending on locale, and a totals column that switches format between rows
 * looks broken. One rule, applied everywhere.
 */
export function formatMoney(minor: number, c: Currency): string {
  const sign = minor < 0 ? "-" : "";
  const body = formatNumber(Math.abs(minor), c);
  // Multi-letter symbols ("AED", "CHF") need a space; glyphs sit flush.
  // A non-breaking space, written as an escape rather than typed literally: an
  // invisible U+00A0 sitting in source is indistinguishable from a plain space
  // and makes any failing comparison unreadable. It is deliberate — "AED" must
  // never wrap away from the amount it belongs to.
  const gap = c.symbol.length > 1 && /[A-Za-z]/.test(c.symbol) ? "\u00a0" : "";
  return `${sign}${c.symbol}${gap}${body}`;
}
