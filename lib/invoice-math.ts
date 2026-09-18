/**
 * Every number that appears on the invoice is computed here, once.
 *
 * The editor, the on-screen preview and the PDF all read this module rather
 * than each doing their own arithmetic. That is the whole point: a preview that
 * disagrees with the PDF it generates is worse than no preview, and a totals
 * row that disagrees with the lines above it is a document you cannot send.
 *
 * Everything is integer minor units. Rounding happens at exactly two places —
 * once per line, and once on the optional round-off — and the parts are always
 * derived so they reconstruct the whole. CGST and SGST are computed as
 * `floor(tax/2)` and `tax - floor(tax/2)` rather than as two independent
 * half-rate calculations, so an odd paise can never make the halves fail to
 * add back up to the tax.
 */

import type { Invoice, LineItem } from "./invoice-types";
import { currencyOf, minorPerMajor } from "./currency";

export interface LineTotals {
  /** quantity × unit price, before discount. */
  grossMinor: number;
  discountMinor: number;
  /** Value of the supply excluding tax. */
  taxableMinor: number;
  taxMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  /** What this line contributes to the grand total. */
  totalMinor: number;
}

export interface RateBucket {
  ratePercent: number;
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
}

export interface InvoiceTotals {
  lines: LineTotals[];
  subtotalMinor: number;
  discountMinor: number;
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
  /** Signed delta applied to reach a whole-unit grand total. */
  roundOffMinor: number;
  grandTotalMinor: number;
  /** True when CGST/SGST applies; false means a single IGST line. */
  intraState: boolean;
  /** Per-rate summary, for the HSN/SAC table on GST invoices. */
  buckets: RateBucket[];
}

/** Loose compare: "telangana", "Telangana ", "TELANGANA" are one state. */
function sameState(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(a) !== "" && norm(a) === norm(b);
}

/**
 * Where the supply is deemed to occur, for the intra/inter-state test.
 * An explicit place of supply wins; otherwise the buyer's state stands in.
 */
export function effectivePlaceOfSupply(inv: Invoice): string {
  return inv.placeOfSupply.trim() || inv.buyer.state.trim();
}

/**
 * A supply is intra-state when it lands in the seller's own state, and that is
 * what makes it CGST + SGST rather than IGST. Getting this backwards prints a
 * legally wrong invoice, so it is derived from the addresses rather than left
 * as a toggle someone can forget to flip.
 *
 * When the destination is unknown we assume intra-state: the seller is in
 * Telangana and that is the common case, and an unwarranted IGST line is the
 * more damaging of the two errors.
 */
export function isIntraState(inv: Invoice): boolean {
  const pos = effectivePlaceOfSupply(inv);
  if (pos === "") return true;
  return sameState(pos, inv.seller.state);
}

function lineTotals(item: LineItem, inv: Invoice, intraState: boolean): LineTotals {
  const grossMinor = Math.round(item.quantity * item.unitPriceMinor);
  const discountMinor = Math.round((grossMinor * clampPercent(item.discountPercent)) / 100);
  const net = grossMinor - discountMinor;

  // A non-GST invoice is a 0% invoice: force the rate rather than trusting the
  // per-line value, so switching kinds can never leave a stale 18% behind.
  const rate = inv.kind === "non-gst" ? 0 : clampPercent(item.taxRatePercent);

  let taxableMinor: number;
  let taxMinor: number;
  if (inv.taxMode === "inclusive") {
    // `net` already contains the tax; back it out instead of adding on top.
    taxableMinor = Math.round(net / (1 + rate / 100));
    taxMinor = net - taxableMinor;
  } else {
    taxableMinor = net;
    taxMinor = Math.round((net * rate) / 100);
  }

  // Halve so the two parts always reconstruct the whole, even on odd paise.
  const half = Math.floor(taxMinor / 2);
  return {
    grossMinor,
    discountMinor,
    taxableMinor,
    taxMinor,
    cgstMinor: intraState ? half : 0,
    sgstMinor: intraState ? taxMinor - half : 0,
    igstMinor: intraState ? 0 : taxMinor,
    totalMinor: taxableMinor + taxMinor,
  };
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
}

export function computeTotals(inv: Invoice): InvoiceTotals {
  const intraState = isIntraState(inv);
  const lines = inv.items.map((i) => lineTotals(i, inv, intraState));

  const sum = (pick: (l: LineTotals) => number) => lines.reduce((a, l) => a + pick(l), 0);

  const subtotalMinor = sum((l) => l.grossMinor);
  const discountMinor = sum((l) => l.discountMinor);
  const taxableMinor = sum((l) => l.taxableMinor);
  const cgstMinor = sum((l) => l.cgstMinor);
  const sgstMinor = sum((l) => l.sgstMinor);
  const igstMinor = sum((l) => l.igstMinor);
  const taxMinor = sum((l) => l.taxMinor);

  const beforeRounding = taxableMinor + taxMinor;

  // Round the payable to a whole rupee/dollar and print the difference, the way
  // Indian invoices conventionally do. On zero-decimal currencies the total is
  // already whole, so this is a no-op rather than a spurious 0.00 line.
  let roundOffMinor = 0;
  const per = minorPerMajor(currencyOf(inv.currencyCode));
  if (inv.roundOff && per > 1) {
    roundOffMinor = Math.round(beforeRounding / per) * per - beforeRounding;
  }

  return {
    lines,
    subtotalMinor,
    discountMinor,
    taxableMinor,
    cgstMinor,
    sgstMinor,
    igstMinor,
    taxMinor,
    roundOffMinor,
    grandTotalMinor: beforeRounding + roundOffMinor,
    intraState,
    buckets: bucketByRate(inv, lines),
  };
}

/**
 * Collapse the lines into one row per tax rate.
 *
 * A GST invoice has to show tax broken out by rate, not just as one total —
 * an invoice mixing 18% consulting with 5% goods needs both rates visible for
 * the buyer to claim input credit correctly.
 */
function bucketByRate(inv: Invoice, lines: LineTotals[]): RateBucket[] {
  const byRate = new Map<number, RateBucket>();
  inv.items.forEach((item, i) => {
    const rate = inv.kind === "non-gst" ? 0 : clampPercent(item.taxRatePercent);
    const l = lines[i];
    const b = byRate.get(rate) ?? {
      ratePercent: rate,
      taxableMinor: 0,
      cgstMinor: 0,
      sgstMinor: 0,
      igstMinor: 0,
      taxMinor: 0,
    };
    b.taxableMinor += l.taxableMinor;
    b.cgstMinor += l.cgstMinor;
    b.sgstMinor += l.sgstMinor;
    b.igstMinor += l.igstMinor;
    b.taxMinor += l.taxMinor;
    byRate.set(rate, b);
  });
  return [...byRate.values()].sort((a, b) => a.ratePercent - b.ratePercent);
}
