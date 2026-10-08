/**
 * What every export format needs, computed once so the PDF, the Word file and
 * the HTML file print the same words and the same figures. The layouts differ
 * by format; the content must not.
 */

import type { Invoice } from "../invoice-types";
import { computeTotals, effectivePlaceOfSupply, receiptBalance } from "../invoice-math";
import { currencyOf, formatMoney } from "../currency";
import { amountInWords } from "../amount-in-words";
import { formatPlaceOfSupply, paymentModeLabel, receiptOf } from "../defaults";

export type ExportFormat = "pdf" | "docx" | "html";

/** The copyright line in every footer. The year is the invoice's own, not
    today's, so a reprinted old invoice still reads as it did when issued. */
export function copyrightLine(invoice: Invoice): string {
  const year = /^\d{4}/.exec(invoice.issueDate)?.[0] ?? String(new Date().getFullYear());
  const owner = invoice.seller.name.trim() || "CUBIXSO Solutions Private Limited";
  return `© ${year} ${owner}. All rights reserved.`;
}

/** Artwork for the light document: logo, signature and seal. */
export interface ExportAssets<T> {
  logo: T;
  signature: T;
  seal: T;
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatQty(q: number): string {
  if (!Number.isFinite(q)) return "0";
  return Number.isInteger(q) ? String(q) : String(Number(q.toFixed(3)));
}

/** " @ 9%" when every line shares a rate; nothing when they differ. */
export function rateSuffix(rates: Set<number>, half = true): string {
  if (rates.size !== 1) return "";
  const r = [...rates][0];
  return ` @ ${half ? r / 2 : r}%`;
}

/** The file name every format shares, e.g. "Tax-Invoice-001-Coltec-India.pdf". */
export function exportFileName(invoice: Invoice, format: ExportFormat): string {
  const kind = invoice.kind === "gst" ? "Tax-Invoice" : invoice.kind === "receipt" ? "Receipt" : "Invoice";
  const client = invoice.buyer.name.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${kind}-${invoice.number || "draft"}${client ? `-${client}` : ""}.${format}`;
}

/** One run of the receipt sentence; `strong` is the amount, set in ink. */
export interface Span {
  text: string;
  strong?: boolean;
}

/**
 * A payment receipt reduced to what it prints. Every format reads this, so the
 * sentence, the figures and the balance are worded once.
 */
export function describeReceipt(invoice: Invoice) {
  const r = receiptOf(invoice);
  const c = currencyOf(invoice.currencyCode);
  const money = (m: number) => formatMoney(m, c);
  const amount = money(r.amountMinor);
  const words = amountInWords(r.amountMinor, invoice.currencyCode);
  const purpose = r.purpose.trim();
  const against = r.againstInvoice.trim();

  // "Received with thanks from X the sum of ₹1,00,000.00 (Rupees … Only)
  // towards Y against Invoice No. 003." Each clause is left out, cleanly, when
  // its field is empty.
  const sentence: Span[] = [
    { text: `Received with thanks from ${invoice.buyer.name.trim() || "—"} the sum of ` },
    { text: amount, strong: true },
    { text: ` (${words})` },
    ...(purpose ? [{ text: ` towards ${purpose}` }] : []),
    ...(against ? [{ text: ` against Invoice No. ${against}` }] : []),
    { text: "." },
  ];

  const meta: [string, string][] = [
    ["Date received", fmtDate(invoice.issueDate)],
    ["Payment mode", paymentModeLabel(r.mode)],
    ...(r.reference.trim() ? ([["Reference", r.reference.trim()]] as [string, string][]) : []),
    ["Currency", `${c.code} · ${c.name}`],
  ];

  // Where the invoice stands. Only printed when there is an invoice to stand
  // against and its total is known; otherwise there is nothing to reconcile.
  const ladder: { label: string; value: string }[] = [];
  if (against && r.invoiceTotalMinor !== null) {
    const b = receiptBalance(r);
    ladder.push({ label: "Invoice total", value: money(r.invoiceTotalMinor) });
    if (r.receivedEarlierMinor !== 0) ladder.push({ label: "Received earlier", value: money(r.receivedEarlierMinor) });
    ladder.push({ label: "Received now", value: amount });
    ladder.push({ label: "Balance due", value: money(b.balanceMinor ?? 0) });
    if (b.excessMinor > 0) ladder.push({ label: "Received in excess", value: money(b.excessMinor) });
  }

  return {
    c,
    title: "Payment Receipt",
    amount,
    words,
    sentence,
    sentenceText: sentence.map((x) => x.text).join(""),
    meta,
    ladder,
    footer: `No. ${invoice.number || "—"} · All amounts in ${c.code} · Payment receipt. Not a tax invoice.`,
    copyright: copyrightLine(invoice),
  };
}

/**
 * The invoice reduced to the strings and figures a document prints. For a
 * receipt the invoice parts are inert (it has no lines to speak of) and
 * `receipt` carries what is printed instead; title and footer say receipt.
 */
export function describe(invoice: Invoice) {
  const t = computeTotals(invoice);
  const c = currencyOf(invoice.currencyCode);
  const money = (m: number) => formatMoney(m, c);
  const isGst = invoice.kind === "gst";
  const rates = new Set(invoice.items.map((i) => i.taxRatePercent));

  const ladder: { label: string; value: string }[] = [];
  if (invoice.items.some((i) => i.discountPercent > 0)) {
    ladder.push({ label: "Gross", value: money(t.subtotalMinor) });
    ladder.push({ label: "Discount", value: `−${money(t.discountMinor)}` });
  }
  ladder.push({ label: isGst ? "Taxable value" : "Subtotal", value: money(t.taxableMinor) });
  if (isGst && t.intraState) {
    ladder.push({ label: `CGST${rateSuffix(rates)}`, value: money(t.cgstMinor) });
    ladder.push({ label: `SGST${rateSuffix(rates)}`, value: money(t.sgstMinor) });
  } else if (isGst) {
    ladder.push({ label: `IGST${rateSuffix(rates, false)}`, value: money(t.igstMinor) });
  } else {
    ladder.push({ label: "GST @ 0%", value: money(0) });
  }
  if (t.roundOffMinor !== 0) {
    ladder.push({
      label: "Round off",
      value: `${t.roundOffMinor > 0 ? "+" : "−"}${money(Math.abs(t.roundOffMinor))}`,
    });
  }

  const bank = invoice.bank;
  const payment = [
    ["Payee", bank.payeeName],
    ["Account", bank.accountNumber],
    ["Type", bank.accountType],
    ["Bank", bank.bankName],
    ["Branch", bank.branch],
    ["IFSC", bank.ifsc],
    ["SWIFT", bank.swift],
    ["UPI", bank.upi],
  ].filter(([, v]) => v.trim() !== "") as [string, string][];

  const receipt = invoice.kind === "receipt" ? describeReceipt(invoice) : null;

  return {
    t,
    c,
    money,
    isGst,
    receipt,
    title: receipt ? receipt.title : isGst ? "Tax Invoice" : "Invoice",
    showHsn: isGst && invoice.items.some((i) => i.hsn.trim() !== ""),
    showRate: isGst && rates.size > 1,
    lines: invoice.items.map((item, i) => ({
      index: String(i + 1).padStart(2, "0"),
      description: item.description || "—",
      hsn: item.hsn || "—",
      qty: formatQty(item.quantity),
      rate: money(item.unitPriceMinor),
      gst: `${item.taxRatePercent}%`,
      amount: money(invoice.taxMode === "inclusive" ? t.lines[i].totalMinor : t.lines[i].taxableMinor),
      discount: item.discountPercent > 0 ? `Discount ${item.discountPercent}% (−${money(t.lines[i].discountMinor)})` : "",
    })),
    ladder,
    total: money(t.grandTotalMinor),
    payableBy: invoice.dueDate ? `Payable by ${fmtDate(invoice.dueDate)}` : "",
    words: amountInWords(t.grandTotalMinor, invoice.currencyCode),
    placeOfSupply: formatPlaceOfSupply(effectivePlaceOfSupply(invoice)) || "—",
    payment,
    footer: receipt
      ? receipt.footer
      : `No. ${invoice.number || "—"} · All amounts in ${c.code} · ${
          isGst ? "This is a computer-generated tax invoice." : "Not a tax invoice. GST is not charged (0%)."
        }`,
    copyright: copyrightLine(invoice),
    buckets: isGst && t.buckets.length > 1 ? t.buckets : [],
  };
}
