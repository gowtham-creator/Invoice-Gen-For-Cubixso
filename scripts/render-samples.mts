/**
 * Renders sample invoices straight to PDF, with no browser and no dev server.
 *
 * The document component is the deliverable; Next only hosts it. Rendering it
 * here proves the PDF itself is correct — fonts embedded, rupee glyph present,
 * totals matching — and gives something to look at without waiting on a
 * Turbopack compile.
 *
 * Written as .mts without JSX: @react-pdf/hyphenate declares subpath exports
 * that Node will not resolve through tsx's CommonJS pipeline, and a .tsx file
 * in a package without "type": "module" is always treated as CommonJS.
 *
 * Run: npx tsx scripts/render-samples.mts
 */

import { createElement } from "react";
import { Font, renderToFile } from "@react-pdf/renderer";
import { join } from "node:path";
import { blankInvoice, emptyItem } from "../lib/defaults.ts";
import { InvoiceDocument } from "../pdf/invoice-document.tsx";
import { computeTotals } from "../lib/invoice-math.ts";
import { currencyOf, formatMoney } from "../lib/currency.ts";
import { amountInWords } from "../lib/amount-in-words.ts";

// The component registers fonts by URL, which only resolves in the browser.
// Re-register the same family from disk so Node can embed the real files.
const FONTS = join(process.cwd(), "public", "fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: join(FONTS, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: join(FONTS, "Inter-Medium.ttf"), fontWeight: 500 },
    { src: join(FONTS, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: join(FONTS, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});

const OUT = process.argv[2] ?? "/tmp";

// Invoice #003 (COLTEC), the document the maths tests are pinned to.
const gst = blankInvoice("gst");
gst.number = "003";
gst.buyer = {
  ...gst.buyer,
  name: "Coltec India Private Limited",
  address: "Plot 42, HITEC City\nMadhapur, Hyderabad\nTelangana 500081",
  gstin: "36AABCC1234M1Z9",
  state: "Telangana",
  email: "accounts@coltec.example",
};
gst.items = [{
  ...emptyItem(18),
  description: 'COLTEC RISE-V2 65" Interactive Flat Panel Display\nOptical bonding, Android 14, 8/128 GB, 3-year warranty',
  hsn: "8528",
  quantity: 2,
  unitPriceMinor: 110_000 * 100,
  taxRatePercent: 18,
}];
gst.notes = "Includes standard wall mount and 12 months QEEB Basic.\nDelivery and installation quoted separately.";

// The other kind, in another currency, to exercise the 0% path.
const nonGst = blankInvoice("non-gst");
nonGst.number = "004";
nonGst.currencyCode = "USD";
nonGst.buyer = {
  ...nonGst.buyer,
  name: "Northwind Labs LLC",
  address: "1209 Orange Street\nWilmington, DE 19801\nUnited States",
  state: "",
  email: "ap@northwind.example",
};
nonGst.items = [
  { ...emptyItem(0), description: "AI platform development — Milestone 2 of 3", quantity: 1, unitPriceMinor: 8_500 * 100 },
  { ...emptyItem(0), description: "Support retainer (40 hours @ $65/hr)", quantity: 40, unitPriceMinor: 65 * 100 },
];
nonGst.notes = "Export of services. GST not applicable.";
nonGst.bank = { ...nonGst.bank, swift: "UTIBINBBXXX" };

// Wrapped rather than top-level await: the package is CommonJS, so esbuild
// has no module context to await in.
async function main() {
for (const [name, inv] of [["gst-invoice-003", gst], ["non-gst-invoice-004", nonGst]] as const) {
  const path = join(OUT, `${name}.pdf`);
  await renderToFile(createElement(InvoiceDocument, { invoice: inv }), path);
  const t = computeTotals(inv);
  const c = currencyOf(inv.currencyCode);
  console.log(`\n${path}`);
  console.log(`  kind      ${inv.kind}   currency ${c.code}`);
  console.log(`  taxable   ${formatMoney(t.taxableMinor, c)}`);
  if (t.intraState && t.taxMinor > 0) {
    console.log(`  CGST      ${formatMoney(t.cgstMinor, c)}`);
    console.log(`  SGST      ${formatMoney(t.sgstMinor, c)}`);
  } else if (t.taxMinor > 0) {
    console.log(`  IGST      ${formatMoney(t.igstMinor, c)}`);
  } else {
    console.log(`  tax       none (0%)`);
  }
  console.log(`  TOTAL     ${formatMoney(t.grandTotalMinor, c)}`);
  console.log(`  in words  ${amountInWords(t.grandTotalMinor, inv.currencyCode)}`);
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
