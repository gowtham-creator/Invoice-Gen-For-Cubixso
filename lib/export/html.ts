/**
 * The invoice as a single, self-contained HTML file.
 *
 * Laid out to the same template spec as the PDF (Inter, the template's text
 * styles, 40pt margins on an A4 sheet) and printable: in a browser's print
 * dialog it lands on one A4 page with the screen framing stripped away.
 * Images are embedded as data URLs, so the file opens anywhere with nothing
 * else beside it.
 *
 * Every piece of user text is escaped. Notes and addresses are typed by the
 * user and may be pasted from anywhere; unescaped, text in a notes field would
 * run as markup, or as script, for whoever opens the file.
 */

import type { Invoice } from "../invoice-types";
import { describe, fmtDate, type ExportAssets } from "./shared";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, with line breaks kept. */
const lines = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");

export function invoiceToHtml(invoice: Invoice, assets: ExportAssets<string>): string {
  const d = describe(invoice);
  const inv = invoice;
  const [brand, ...rest] = inv.seller.name.split(" ");
  const accent = /^#[0-9a-f]{6}$/i.test(inv.accent) ? inv.accent : "#0066cc";

  const party = (label: string, p: Invoice["seller"], taxLine: string) => `
      <div>
        <p class="overline">${label}</p>
        <p class="name">${escapeHtml(p.name || "—")}</p>
        <p class="body">${lines(p.address)}</p>
        ${taxLine ? `<p class="tag">${escapeHtml(taxLine)}</p>` : ""}
        ${p.email ? `<p class="body">${escapeHtml(p.email)}</p>` : ""}
        ${p.phone ? `<p class="body">${escapeHtml(p.phone)}</p>` : ""}
      </div>`;

  const sellerTax = d.isGst ? (inv.seller.gstin ? `GSTIN ${inv.seller.gstin}` : "") : inv.seller.pan ? `PAN ${inv.seller.pan}` : "";
  const buyerTax = d.isGst && inv.buyer.gstin ? `GSTIN ${inv.buyer.gstin}` : "";

  const meta = [
    ["Issue date", fmtDate(inv.issueDate)],
    ["Due date", fmtDate(inv.dueDate)],
    ...(d.isGst ? [["Place of supply", d.placeOfSupply]] : []),
    ["Currency", `${d.c.code} · ${d.c.name}`],
  ];

  const head = `
        <tr>
          <th class="idx">#</th>
          <th>Description</th>
          ${d.showHsn ? "<th>HSN/SAC</th>" : ""}
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          ${d.showRate ? '<th class="num">GST</th>' : ""}
          <th class="num">Amount</th>
        </tr>`;

  const rows = d.lines
    .map(
      (l) => `
        <tr>
          <td class="idx muted">${l.index}</td>
          <td><span class="item">${lines(l.description)}</span>${l.discount ? `<span class="sub">${escapeHtml(l.discount)}</span>` : ""}</td>
          ${d.showHsn ? `<td>${escapeHtml(l.hsn)}</td>` : ""}
          <td class="num">${escapeHtml(l.qty)}</td>
          <td class="num">${escapeHtml(l.rate)}</td>
          ${d.showRate ? `<td class="num">${escapeHtml(l.gst)}</td>` : ""}
          <td class="num">${escapeHtml(l.amount)}</td>
        </tr>`,
    )
    .join("");

  const ladder = d.ladder
    .map((r) => `<div class="ladder-row"><span class="soft">${escapeHtml(r.label)}</span><span>${escapeHtml(r.value)}</span></div>`)
    .join("");

  const buckets = d.buckets.length
    ? `
      <section class="summary">
        <p class="overline">Tax summary</p>
        <table class="items">
          <tr><th>Rate</th><th class="num">Taxable</th><th class="num">${d.t.intraState ? "CGST" : "IGST"}</th><th class="num">${d.t.intraState ? "SGST" : "Total tax"}</th></tr>
          ${d.buckets
            .map(
              (b) =>
                `<tr><td>${b.ratePercent}%</td><td class="num">${escapeHtml(d.money(b.taxableMinor))}</td><td class="num">${escapeHtml(
                  d.money(d.t.intraState ? b.cgstMinor : b.igstMinor),
                )}</td><td class="num">${escapeHtml(d.money(d.t.intraState ? b.sgstMinor : b.taxMinor))}</td></tr>`,
            )
            .join("")}
        </table>
      </section>`
    : "";

  const payment = inv.showBank && d.payment.length
    ? `<div><p class="overline">Payment details</p><dl class="kv">${d.payment
        .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
        .join("")}</dl></div>`
    : "";
  const terms = inv.terms.trim() ? `<div class="terms"><p class="overline">Terms</p><p class="body">${lines(inv.terms)}</p></div>` : "";

  const signature = inv.showSignature
    ? `
        <div class="sign">
          <p class="body">For ${escapeHtml(inv.seller.name)}</p>
          <img class="signature" src="${escapeHtml(assets.signature)}" alt="Signature">
          <div class="sign-rule">
            <p class="name">${escapeHtml(inv.signatoryName || inv.seller.name)}</p>
            <p class="caption">Authorised Signatory</p>
          </div>
          ${inv.showStamp ? `<img class="seal" src="${escapeHtml(assets.seal)}" alt="Company seal">` : ""}
        </div>`
    : "";

  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${d.title} ${inv.number} · ${inv.seller.name}`)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  /* The template's text styles, as in the PDF (pdf/theme.ts). */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { background: #eef0f3; }
  body { font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif; color: #0a0a0a; font-size: 8.5pt; line-height: 1.45; font-variant-numeric: tabular-nums; }
  .page { position: relative; width: 210mm; min-height: 297mm; margin: 32px auto; padding: 40pt 40pt 72pt; background: #fff;
          box-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px -8px rgba(16,24,40,.18); }
  @media print { html { background: #fff; } .page { margin: 0; box-shadow: none; } }
  @media (max-width: 820px) { .page { width: auto; min-height: 0; margin: 0; } }
  .masthead { display: flex; justify-content: space-between; align-items: center; }
  .brand { display: flex; align-items: center; gap: 10pt; }
  .brand img { width: 28pt; height: 28pt; object-fit: contain; }
  .wordmark { font-size: 11pt; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; }
  .doc-title { font-size: 11pt; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; text-align: right; }
  .doc-number { font-size: 10pt; text-align: right; margin-top: 3pt; }
  .rule { border-top: 1px solid #e3e3e3; margin: 18pt 0; }
  .overline { font-size: 7pt; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: #494949; margin-bottom: 6pt; }
  .name { font-size: 9.5pt; font-weight: 500; margin-bottom: 3pt; }
  .body { font-size: 8.5pt; color: #494949; }
  .tag { font-size: 8.5pt; margin-top: 4pt; }
  .caption { font-size: 8pt; color: #494949; }
  .soft { color: #242424; }
  .muted { color: #494949; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 28pt; }
  .meta { display: grid; grid-template-columns: repeat(${meta.length}, 1fr); gap: 20pt; margin-top: 18pt; }
  .meta .value { font-size: 9pt; }
  table.items { width: 100%; border-collapse: collapse; }
  .items th { font-size: 7.5pt; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: #494949; text-align: left; padding-bottom: 7pt; border-bottom: 1px solid #eee; }
  .items td { font-size: 9.5pt; padding: 9pt 8pt 9pt 0; border-bottom: 1px solid #eee; vertical-align: top; }
  .items .num { text-align: right; padding-right: 0; padding-left: 8pt; white-space: nowrap; }
  .items .idx { width: 4%; }
  .item { font-weight: 500; display: block; }
  .sub { display: block; font-size: 8.5pt; color: #494949; margin-top: 2pt; }
  .ladder { width: 50%; margin: 12pt 0 0 auto; }
  .ladder-row { display: flex; justify-content: space-between; padding: 3pt 0; font-size: 9.5pt; }
  .ladder-row .soft { font-size: 9pt; }
  .grand { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #0a0a0a; margin-top: 12pt; padding-top: 10pt; }
  .grand .label { font-size: 7.5pt; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: #494949; }
  .grand .payable { font-size: 9pt; color: #242424; margin-top: 3pt; }
  .grand .figure { font-size: ${d.total.length <= 12 ? 40 : d.total.length <= 14 ? 34 : 28}pt; letter-spacing: -.03em; line-height: 1; }
  .words { margin-top: 16pt; font-size: 8.5pt; color: #494949; }
  .words span { color: #0a0a0a; }
  .summary, .notes { margin-top: 20pt; }
  .close { display: grid; grid-template-columns: 1fr 190pt; gap: 28pt; margin-top: 20pt; }
  .kv { display: grid; grid-template-columns: 56pt 1fr; row-gap: 2pt; font-size: 8.5pt; }
  .kv dt { color: #494949; }
  .terms { margin-top: 16pt; }
  .sign { text-align: right; }
  .signature { display: block; width: 190pt; height: 40pt; object-fit: contain; object-position: right; margin: 4pt 0 2pt; }
  .sign-rule { border-top: 1px solid #e3e3e3; margin-top: 4pt; padding-top: 4pt; }
  .sign-rule .name { margin: 0; }
  .seal { display: block; width: 86pt; height: 86pt; object-fit: contain; margin: 8pt auto 0; }
  .footer { position: absolute; left: 40pt; right: 40pt; bottom: 24pt; font-size: 8pt; color: #494949; border-top: .75pt solid #e3e3e3; padding-top: 5pt; }
  .copyright { display: flex; align-items: center; gap: 4pt; margin-top: 2pt; }
  .copyright img { width: 9pt; height: 9pt; object-fit: contain; }
</style>
</head>
<body>
  <main class="page">
    <header class="masthead">
      <div class="brand">
        ${inv.showLogo ? `<img src="${escapeHtml(assets.logo)}" alt="">` : ""}
        ${inv.showLogo ? `<div><p class="wordmark">${escapeHtml(brand ?? "")}</p><p class="overline" style="margin:2pt 0 0">${escapeHtml(rest.join(" "))}</p></div>` : ""}
      </div>
      <div>
        <p class="doc-title" style="color:${accent}">${d.title}</p>
        <p class="doc-number">No. ${escapeHtml(inv.number || "—")}</p>
      </div>
    </header>

    <div class="rule"></div>

    <section class="parties">
      ${party("From", inv.seller, sellerTax)}
      ${party("Billed to", inv.buyer, buyerTax)}
    </section>

    <section class="meta">
      ${meta.map(([k, v]) => `<div><p class="overline">${k}</p><p class="value">${escapeHtml(v)}</p></div>`).join("")}
    </section>

    <div class="rule"></div>

    <table class="items">
      ${head}
      ${rows}
    </table>

    <div class="ladder">${ladder}</div>

    <section class="grand">
      <div>
        <p class="label">Total due</p>
        ${d.payableBy ? `<p class="payable">${escapeHtml(d.payableBy)}</p>` : ""}
      </div>
      <p class="figure">${escapeHtml(d.total)}</p>
    </section>

    ${inv.showAmountInWords ? `<p class="words">Amount in words: <span>${escapeHtml(d.words)}</span></p>` : ""}
    ${buckets}
    ${inv.notes.trim() ? `<section class="notes"><p class="overline">Notes</p><p class="body">${lines(inv.notes)}</p></section>` : ""}

    <section class="close">
      <div>${payment}${terms}</div>
      ${signature}
    </section>

    <footer class="footer">
      <p>${escapeHtml(d.footer)}</p>
      <p class="copyright">${inv.showLogo ? `<img src="${escapeHtml(assets.logo)}" alt="">` : ""}${escapeHtml(d.copyright)}</p>
    </footer>
  </main>
</body>
</html>
`;
}
