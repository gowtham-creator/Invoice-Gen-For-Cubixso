/**
 * The HTML and Word exports, checked against Invoice #003 (COLTEC): the same
 * figures the PDF prints, the right document for each invoice type, and user
 * text that cannot escape into markup.
 *
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { Packer } from "docx";
import { blankInvoice, blankReceipt, emptyItem } from "../defaults.ts";
import { invoiceToHtml } from "./html.ts";
import { buildInvoiceDocx, type DocxImage } from "./docx.ts";
import { copyrightLine, exportFileName } from "./shared.ts";
import type { Invoice } from "../invoice-types.ts";

function coltec(over: Partial<Invoice> = {}): Invoice {
  const base = blankInvoice("gst");
  return {
    ...base,
    number: "003",
    buyer: { ...base.buyer, name: "Coltec India Private Limited", state: "Telangana" },
    items: [{ ...emptyItem(18), description: 'COLTEC RISE-V2 65" Panel', quantity: 2, unitPriceMinor: 110_000 * 100 }],
    ...over,
  };
}

const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const htmlAssets = { logo: pixel, signature: pixel, seal: pixel };

test("the HTML export prints the same figures as the PDF", () => {
  const html = invoiceToHtml(coltec(), htmlAssets);
  assert.match(html, /₹2,20,000\.00/, "taxable value");
  assert.match(html, /CGST @ 9%[\s\S]*₹19,800\.00/, "CGST");
  assert.match(html, /₹2,59,600\.00/, "total");
  assert.match(html, /Two Lakh Fifty-Nine Thousand Six Hundred/, "amount in words");
  assert.match(html, /Authorised Signatory/);
});

test("user text in the HTML export cannot become markup", () => {
  const html = invoiceToHtml(coltec({ notes: '<script>alert("x")</script>\n<img src=x onerror=alert(1)>' }), htmlAssets);
  assert.doesNotMatch(html, /<script>alert/, "no live script");
  assert.doesNotMatch(html, /<img src=x/, "no injected tag");
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;<br>&lt;img/, "escaped, line break kept");
});

test("a non-GST HTML export is titled Invoice and charges nothing", () => {
  const html = invoiceToHtml(coltec({ kind: "non-gst" }), htmlAssets);
  assert.match(html, /<p class="doc-title"[^>]*>Invoice<\/p>/);
  assert.match(html, /GST @ 0%/);
  assert.match(html, /Not a tax invoice/);
  assert.doesNotMatch(html, /CGST|Place of supply/);
});

const img = (file: string, w: number, h: number): DocxImage => ({
  data: new Uint8Array(readFileSync(join(process.cwd(), "public", file))),
  type: "png",
  width: w,
  height: h,
});

test("the Word export carries the same figures, the signature block, and Inter", async () => {
  const doc = buildInvoiceDocx(
    coltec(),
    { logo: img("cubixso-logo.png", 1584, 1584), signature: img("signature.png", 737, 99), seal: img("seal.png", 597, 600) },
    {
      regular: new Uint8Array(readFileSync(join(process.cwd(), "public/fonts/Inter-Regular.ttf"))),
      medium: new Uint8Array(readFileSync(join(process.cwd(), "public/fonts/Inter-Medium.ttf"))),
    },
  );
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const xml = await zip.file("word/document.xml")!.async("string");
  const text = xml.replace(/<[^>]+>/g, "");
  for (const want of ["Coltec India Private Limited", "₹2,20,000.00", "₹19,800.00", "₹2,59,600.00", "Authorised Signatory", "Nayini Gowtham Reddy"]) {
    assert.ok(text.includes(want), `document contains ${want}`);
  }
  const footer = Object.keys(zip.files).find((f) => /^word\/footer\d*\.xml$/.test(f))!;
  const footerXml = await zip.file(footer)!.async("string");
  assert.match(footerXml, /computer-generated tax invoice/);
  assert.match(footerXml, /All rights reserved\./);
  // JSZip lists folders as entries too; count only the files inside them.
  const files = Object.keys(zip.files).filter((f) => !f.endsWith("/"));
  const fontParts = files.filter((f) => f.startsWith("word/fonts/"));
  assert.equal(fontParts.length, 2, "Inter and Inter Medium are embedded");
  const media = files.filter((f) => f.startsWith("word/media/"));
  assert.equal(media.length, 3, "logo, signature and seal");
});

test("export file names say what the file is", () => {
  assert.equal(exportFileName(coltec(), "pdf"), "Tax-Invoice-003-Coltec-India-Private-Limited.pdf");
  assert.equal(exportFileName(coltec({ kind: "non-gst" }), "docx"), "Invoice-003-Coltec-India-Private-Limited.docx");
});

test("every footer carries a copyright dated to the invoice, not to today", () => {
  const inv = coltec({ issueDate: "2025-03-14" });
  assert.equal(copyrightLine(inv), "© 2025 CUBIXSO Solutions Private Limited. All rights reserved.");
  const html = invoiceToHtml(inv, htmlAssets);
  assert.ok(html.includes("© 2025 CUBIXSO Solutions Private Limited. All rights reserved."));
  const blankSeller = coltec({ issueDate: "2026-01-02" });
  blankSeller.seller = { ...blankSeller.seller, name: "  " };
  assert.equal(copyrightLine(blankSeller), "© 2026 CUBIXSO Solutions Private Limited. All rights reserved.");
});

/** Receipt R-001: the first ₹1,00,000 tranche against Invoice #003. */
function receipt(over: Partial<Invoice["receipt"] & object> = {}): Invoice {
  const base = blankInvoice("receipt");
  return {
    ...base,
    number: "R-001",
    buyer: { ...base.buyer, name: "Coltec India Private Limited", state: "Telangana" },
    receipt: {
      ...blankReceipt(),
      amountMinor: 100_000_00,
      reference: "UTR AXISN26281123456",
      purpose: "Milestone 1 of 3",
      againstInvoice: "003",
      invoiceTotalMinor: 259_600_00,
      ...over,
    },
  };
}

test("a receipt's HTML acknowledges the amount, in figures and words, and is not a tax invoice", () => {
  const html = invoiceToHtml(receipt(), htmlAssets);
  assert.match(html, /PAYMENT RECEIPT|Payment Receipt/);
  assert.match(html, /Received with thanks from Coltec India Private Limited the sum of <strong>₹1,00,000\.00<\/strong>/);
  assert.match(html, /One Lakh/, "amount in words");
  assert.match(html, /towards Milestone 1 of 3 against Invoice No\. 003\./);
  assert.match(html, /Balance due[\s\S]*₹1,59,600\.00/);
  assert.match(html, /Not a tax invoice/);
  assert.match(html, /Received from/);
  assert.doesNotMatch(html, /Payment details|Total due|Received earlier/);
});

test("a receipt without a purpose or an invoice drops those clauses and the balance", () => {
  const html = invoiceToHtml(receipt({ purpose: "", againstInvoice: "", invoiceTotalMinor: null }), htmlAssets);
  assert.match(html, /One Lakh[^<]*Only\)\.<\/p>/);
  assert.doesNotMatch(html, /towards|against Invoice|Balance due/);
});

test("a receipt's purpose and reference cannot become markup", () => {
  const html = invoiceToHtml(
    receipt({ purpose: '<script>alert("x")</script>', reference: "<img src=x onerror=alert(1)>" }),
    htmlAssets,
  );
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /towards &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("a receipt's Word file says the same as its HTML", async () => {
  const doc = buildInvoiceDocx(receipt(), { logo: img("cubixso-logo.png", 1584, 1584), signature: img("signature.png", 737, 99), seal: img("seal.png", 597, 600) });
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const text = (await zip.file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
  for (const want of ["Payment Receipt", "Received from", "Received with thanks from Coltec India Private Limited", "₹1,00,000.00", "One Lakh", "against Invoice No. 003", "₹1,59,600.00", "Amount received", "Authorised Signatory"]) {
    assert.ok(text.includes(want), `document contains ${want}`);
  }
  assert.ok(!text.includes("Payment details"), "no bank details on a receipt");
  const footer = Object.keys(zip.files).find((f) => /^word\/footer\d*\.xml$/.test(f))!;
  assert.match(await zip.file(footer)!.async("string"), /Payment receipt\. Not a tax invoice\./);
});

test("a receipt's file name says it is a receipt", () => {
  assert.equal(exportFileName(receipt(), "pdf"), "Receipt-R-001-Coltec-India-Private-Limited.pdf");
});

test("a receipt with a negative amount prints zero, never a minus", () => {
  const html = invoiceToHtml(receipt({ amountMinor: -5000_00, receivedEarlierMinor: -100_00 }), htmlAssets);
  assert.doesNotMatch(html, /Minus/);
  assert.doesNotMatch(html, /-₹|₹-|−₹/);
  assert.match(html, /the sum of <strong>₹0\.00<\/strong>/);
});
