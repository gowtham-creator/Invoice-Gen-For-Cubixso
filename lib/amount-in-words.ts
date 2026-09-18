/**
 * Amounts written out in words, for the line Indian invoices are expected to
 * carry ("Rupees Two Lakh Fifty Nine Thousand Six Hundred Only").
 *
 * Two numbering systems, because they group differently and the words are not
 * interchangeable. Indian splits the last three digits then pairs upward —
 * 2,59,600 is "two lakh fifty-nine thousand six hundred". Western triples all
 * the way — 259,600 is "two hundred fifty-nine thousand six hundred". Printing
 * "lakh" on a USD invoice, or "million" on an INR one, both read as mistakes.
 */

import { currencyOf, minorPerMajor, type Currency } from "./currency";

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 0–999 in words. The building block both systems are assembled from. */
function under1000(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const o = n % 10;
    return o ? `${t}-${ONES[o]}` : t;
  }
  const h = `${ONES[Math.floor(n / 100)]} Hundred`;
  const rest = n % 100;
  return rest ? `${h} ${under1000(rest)}` : h;
}

function indianWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;

  // Beyond 99,99,99,999 the next unit is "lakh crore"; recursing on the crore
  // count gives that for free rather than capping at some arbitrary maximum.
  if (crore) parts.push(`${crore >= 1000 ? indianWords(crore) : under1000(crore)} Crore`);
  if (lakh) parts.push(`${under1000(lakh)} Lakh`);
  if (thousand) parts.push(`${under1000(thousand)} Thousand`);
  if (rest) parts.push(under1000(rest));
  return parts.join(" ");
}

const WESTERN_SCALES = ["", " Thousand", " Million", " Billion", " Trillion"];

function westernWords(n: number): string {
  if (n === 0) return "Zero";
  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  return groups
    .map((g, i) => (g === 0 ? "" : `${under1000(g)}${WESTERN_SCALES[i] ?? ""}`))
    .filter(Boolean)
    .reverse()
    .join(" ");
}

function wholeWords(n: number, c: Currency): string {
  return c.numbering === "indian" ? indianWords(n) : westernWords(n);
}

/**
 * The full sentence for the invoice footer, e.g.
 * "Indian Rupee Two Lakh Fifty-Nine Thousand Six Hundred Only".
 *
 * The minor unit is appended only when it is non-zero and the currency has one,
 * so a round total does not trail a pointless "and Zero Paise".
 */
export function amountInWords(minor: number, currencyCode: string): string {
  const c = currencyOf(currencyCode);
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const per = minorPerMajor(c);
  const major = Math.floor(abs / per);
  const rest = abs - major * per;

  let sentence = `${c.name} ${wholeWords(major, c)}`;
  if (rest > 0 && c.minorName) {
    sentence += ` and ${wholeWords(rest, c)} ${c.minorName}`;
  }
  return `${negative ? "Minus " : ""}${sentence} Only`;
}
