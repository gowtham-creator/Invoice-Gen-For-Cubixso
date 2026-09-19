/**
 * What every export format needs, computed once so the PDF, the Word file and
 * the HTML file print the same words and the same figures. The layouts differ
 * by format; the content must not.
 */

import type { Invoice } from "../invoice-types";
import { computeTotals, effectivePlaceOfSupply } from "../invoice-math";
import { currencyOf, formatMoney } from "../currency";
import { amountInWords } from "../amount-in-words";
import { formatPlaceOfSupply } from "../defaults";

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
  const kind = invoice.kind === "gst" ? "Tax-Invoice" : "Invoice";
  const client = invoice.buyer.name.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${kind}-${invoice.number || "draft"}${client ? `-${client}` : ""}.${format}`;
}

/** The invoice reduced to the strings and figures a document prints. */
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

  return {
    t,
    c,
    money,
    isGst,
    title: isGst ? "Tax Invoice" : "Invoice",
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
    footer: `No. ${invoice.number || "—"} · All amounts in ${c.code} · ${
      isGst ? "This is a computer-generated tax invoice." : "Not a tax invoice. GST is not charged (0%)."
    }`,
    copyright: copyrightLine(invoice),
    buckets: isGst && t.buckets.length > 1 ? t.buckets : [],
  };
}
