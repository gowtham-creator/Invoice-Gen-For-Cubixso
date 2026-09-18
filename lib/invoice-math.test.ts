/**
 * Money maths, checked against invoices Cubixso actually issued.
 *
 * The COLTEC case below is Invoice #003 verbatim — two panels at ₹1,10,000,
 * 18% GST intra-state — and its printed totals are the expected values. Using a
 * real document rather than invented numbers means the test fails if the code
 * ever stops agreeing with something a client already paid against.
 *
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeTotals, isIntraState } from "./invoice-math.ts";
import { blankInvoice, emptyItem } from "./defaults.ts";
import { amountInWords } from "./amount-in-words.ts";
import { currencyOf, formatMoney, parseMoney } from "./currency.ts";
import type { Invoice } from "./invoice-types.ts";

/** An invoice with one line, built from the real defaults. */
function oneLine(over: Partial<Invoice> = {}, item: Partial<ReturnType<typeof emptyItem>> = {}): Invoice {
  const base = blankInvoice();
  return {
    ...base,
    roundOff: false,
    buyer: { ...base.buyer, state: "Telangana" },
    items: [{ ...emptyItem(18), ...item }],
    ...over,
  };
}

const RUPEE = 100; // paise per rupee

test("COLTEC invoice #003 reproduces its printed totals", () => {
  const inv = oneLine({}, { quantity: 2, unitPriceMinor: 110_000 * RUPEE, taxRatePercent: 18 });
  const t = computeTotals(inv);

  assert.equal(t.taxableMinor, 220_000 * RUPEE, "taxable value");
  assert.equal(t.cgstMinor, 19_800 * RUPEE, "CGST @ 9%");
  assert.equal(t.sgstMinor, 19_800 * RUPEE, "SGST @ 9%");
  assert.equal(t.igstMinor, 0, "no IGST on an intra-state supply");
  assert.equal(t.grandTotalMinor, 259_600 * RUPEE, "total billable");
});

test("an inter-state supply is IGST, never CGST/SGST", () => {
  const inv = oneLine({
    buyer: { ...blankInvoice().buyer, state: "Karnataka" },
    placeOfSupply: "Karnataka",
  }, { quantity: 2, unitPriceMinor: 110_000 * RUPEE });
  const t = computeTotals(inv);

  assert.equal(t.intraState, false);
  assert.equal(t.igstMinor, 39_600 * RUPEE);
  assert.equal(t.cgstMinor, 0);
  assert.equal(t.sgstMinor, 0);
  assert.equal(t.grandTotalMinor, 259_600 * RUPEE, "the total is the same either way");
});

test("an unknown destination assumes intra-state rather than printing IGST", () => {
  const inv = oneLine({ buyer: { ...blankInvoice().buyer, state: "" }, placeOfSupply: "" });
  assert.equal(isIntraState(inv), true);
});

test("a non-GST invoice charges nothing, whatever the line rate says", () => {
  // A stale 18% left on the item must not survive the kind switch.
  const inv = oneLine({ kind: "non-gst" }, { quantity: 1, unitPriceMinor: 35_000 * RUPEE, taxRatePercent: 18 });
  const t = computeTotals(inv);

  assert.equal(t.taxMinor, 0);
  assert.equal(t.cgstMinor, 0);
  assert.equal(t.sgstMinor, 0);
  assert.equal(t.grandTotalMinor, 35_000 * RUPEE);
});

test("inclusive pricing backs tax out instead of adding it on", () => {
  // ₹720 inclusive of 5% is ₹685.71 + ₹34.29, and the customer still pays ₹720.
  const inv = oneLine({ taxMode: "inclusive" }, { quantity: 1, unitPriceMinor: 720 * RUPEE, taxRatePercent: 5 });
  const t = computeTotals(inv);

  assert.equal(t.taxableMinor, 68_571);
  assert.equal(t.taxMinor, 3_429);
  assert.equal(t.grandTotalMinor, 720 * RUPEE, "the payable is unchanged by the rate");
});

test("CGST and SGST always reconstruct the tax, even on an odd paise", () => {
  // 333.33 at 18% gives an odd number of paise, so the halves cannot be equal.
  const inv = oneLine({}, { quantity: 1, unitPriceMinor: 33_333, taxRatePercent: 18 });
  const t = computeTotals(inv);

  assert.equal(t.cgstMinor + t.sgstMinor, t.taxMinor, "halves must sum to the whole");
  assert.equal(t.taxableMinor + t.taxMinor, t.grandTotalMinor, "ladder must reach the total");
  assert.equal(Math.abs(t.cgstMinor - t.sgstMinor) <= 1, true, "halves differ by at most one paisa");
});

test("round-off moves the total to a whole rupee and is disclosed", () => {
  const inv = oneLine({ roundOff: true }, { quantity: 1, unitPriceMinor: 33_333, taxRatePercent: 18 });
  const t = computeTotals(inv);

  assert.equal(t.grandTotalMinor % RUPEE, 0, "total lands on a whole rupee");
  assert.equal(t.taxableMinor + t.taxMinor + t.roundOffMinor, t.grandTotalMinor, "delta is accounted for");
});

test("round-off is a no-op on a zero-decimal currency", () => {
  const inv = oneLine({ roundOff: true, currencyCode: "JPY" }, { quantity: 3, unitPriceMinor: 5000 });
  assert.equal(computeTotals(inv).roundOffMinor, 0);
});

test("a discount is taken before tax, not after", () => {
  const inv = oneLine({}, { quantity: 1, unitPriceMinor: 10_000 * RUPEE, discountPercent: 10, taxRatePercent: 18 });
  const t = computeTotals(inv);

  assert.equal(t.discountMinor, 1_000 * RUPEE);
  assert.equal(t.taxableMinor, 9_000 * RUPEE);
  assert.equal(t.taxMinor, 1_620 * RUPEE, "18% of the discounted value");
});

test("mixed rates are bucketed per rate for the summary table", () => {
  const base = blankInvoice();
  const inv: Invoice = {
    ...base,
    roundOff: false,
    buyer: { ...base.buyer, state: "Telangana" },
    items: [
      { ...emptyItem(18), quantity: 1, unitPriceMinor: 10_000 * RUPEE, taxRatePercent: 18 },
      { ...emptyItem(5), quantity: 1, unitPriceMinor: 10_000 * RUPEE, taxRatePercent: 5 },
    ],
  };
  const t = computeTotals(inv);

  assert.equal(t.buckets.length, 2);
  assert.deepEqual(t.buckets.map((b) => b.ratePercent), [5, 18], "sorted by rate");
  assert.equal(t.taxMinor, 2_300 * RUPEE, "1800 + 500");
});

test("amounts in words follow the currency's numbering system", () => {
  assert.equal(
    amountInWords(259_600 * RUPEE, "INR"),
    "Indian Rupee Two Lakh Fifty-Nine Thousand Six Hundred Only",
  );
  assert.equal(
    amountInWords(259_600 * 100, "USD"),
    "US Dollar Two Hundred Fifty-Nine Thousand Six Hundred Only",
  );
  assert.match(amountInWords(1_50_00_000 * RUPEE, "INR"), /Crore/, "crore, not million");
});

test("the minor unit is spoken only when it is non-zero", () => {
  assert.equal(amountInWords(50_025, "INR"), "Indian Rupee Five Hundred and Twenty-Five Paise Only");
  assert.match(amountInWords(50_000, "INR"), /Five Hundred Only$/);
});

test("pasted amounts survive their grouping separators", () => {
  const inr = currencyOf("INR");
  assert.equal(parseMoney("₹1,10,000.00", inr), 110_000 * RUPEE);
  assert.equal(parseMoney("1 10 000", inr), 110_000 * RUPEE);
  assert.equal(parseMoney("", inr), 0);
  assert.equal(parseMoney("2.345", inr), 235, "rounds rather than truncating the binary error");
});

test("zero-decimal currencies do not gain cents", () => {
  const jpy = currencyOf("JPY");
  assert.equal(parseMoney("5000", jpy), 5000);
  assert.equal(formatMoney(5000, jpy), "¥5,000");
});

test("multi-letter symbols are spaced, glyphs are flush", () => {
  // U+00A0, not a plain space: the code word and its amount must not be split
  // across a line break. Written as an escape so this expectation is readable.
  assert.equal(formatMoney(100_00, currencyOf("AED")), "AED\u00a0100.00");
  assert.equal(formatMoney(100_00, currencyOf("USD")), "$100.00");
});
