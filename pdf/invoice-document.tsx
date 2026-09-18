/**
 * The invoice, as a PDF.
 *
 * This component is the only renderer of the document. The on-screen preview is
 * this same tree rasterised by the PDF viewer, not a separate HTML mock-up —
 * so what the user approves is literally the file that gets sent. Keeping one
 * renderer is worth more than the convenience of an HTML preview: a preview
 * that can drift from its PDF is a preview you cannot trust.
 *
 * Visual direction follows the Cubixso design system: near-black ink on white,
 * one accent colour, hairline rules instead of boxes, and whitespace doing the
 * work that borders usually do. A billing document should read as a record.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import type { Invoice } from "../lib/invoice-types";
import { computeTotals, effectivePlaceOfSupply } from "../lib/invoice-math";
import { currencyOf, formatMoney } from "../lib/currency";
import { amountInWords } from "../lib/amount-in-words";
import { BUILTIN_SEAL, formatPlaceOfSupply, signatureSrc } from "../lib/defaults";
import {
  FAINT, FONT, INK, MUTED, PAGE_MARGIN, PARCHMENT, RULE, RULE_SOFT,
  TRACK_DISPLAY, TRACK_EYEBROW, TRACK_TIGHT,
} from "./theme";

Font.register({
  family: FONT,
  fonts: [
    { src: "/fonts/Inter-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Inter-Medium.ttf", fontWeight: 500 },
    { src: "/fonts/Inter-SemiBold.ttf", fontWeight: 600 },
    { src: "/fonts/Inter-Bold.ttf", fontWeight: 700 },
  ],
});

// Inter's default hyphenation splits client names and addresses mid-word, which
// looks like a typo on a document someone is going to file. Off entirely.
Font.registerHyphenationCallback((word) => [word]);

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 8.5,
    color: INK,
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN + 14,
    paddingHorizontal: PAGE_MARGIN,
    lineHeight: 1.45,
    backgroundColor: "#ffffff",
  },

  masthead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  /* The real mark from the Cubixso site, not a redraw. Printed at its own
     colour: a logo is not a themeable element, so the document's accent recolours
     the labels around it and leaves the mark alone. */
  logo: { width: 26, height: 26, objectFit: "contain" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  wordmark: { fontSize: 13, fontWeight: 600, letterSpacing: TRACK_TIGHT },
  brandSub: { fontSize: 7, color: FAINT, letterSpacing: 0.3, marginTop: 1 },

  docType: {
    fontSize: 7.5, fontWeight: 600, letterSpacing: TRACK_EYEBROW,
    textTransform: "uppercase", textAlign: "right",
  },
  docNumber: { fontSize: 22, fontWeight: 700, letterSpacing: TRACK_DISPLAY, textAlign: "right", marginTop: 1 },

  rule: { borderTopWidth: 1, borderTopColor: RULE, marginVertical: 16 },
  ruleSoft: { borderTopWidth: 1, borderTopColor: RULE_SOFT },
  /* Rows close themselves underneath, so the header rule is not doubled
     and the last row still has an edge below it. */
  rowRule: { borderBottomWidth: 1, borderBottomColor: RULE_SOFT },

  eyebrow: {
    fontSize: 6.5, fontWeight: 600, letterSpacing: TRACK_EYEBROW,
    textTransform: "uppercase", color: FAINT, marginBottom: 5,
  },

  parties: { flexDirection: "row", gap: 28 },
  party: { flex: 1 },
  partyName: { fontSize: 10.5, fontWeight: 600, letterSpacing: TRACK_TIGHT, marginBottom: 3 },
  partyLine: { color: MUTED, fontSize: 8.5 },
  partyTag: { marginTop: 4, fontSize: 8, fontWeight: 500 },

  metaRow: { flexDirection: "row", gap: 20, marginTop: 18 },
  metaCell: { flex: 1 },
  metaValue: { fontSize: 9, fontWeight: 500 },

  th: {
    fontSize: 6.5, fontWeight: 600, letterSpacing: TRACK_EYEBROW,
    textTransform: "uppercase", color: FAINT,
  },
  tr: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8 },
  cellDesc: { fontSize: 9, fontWeight: 500 },
  cellSub: { fontSize: 7.5, color: FAINT, marginTop: 2 },
  num: { textAlign: "right", fontSize: 8.5 },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totals: { width: "56%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  totalLabel: { color: MUTED, fontSize: 8.5 },
  totalValue: { fontSize: 8.5, fontWeight: 500 },

  grand: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: PARCHMENT, paddingVertical: 11, paddingHorizontal: 13,
    marginTop: 8, borderRadius: 5,
  },
  grandLabel: { fontSize: 7, fontWeight: 600, letterSpacing: TRACK_EYEBROW, textTransform: "uppercase" },
  grandValue: { fontSize: 15, fontWeight: 700, letterSpacing: TRACK_DISPLAY },

  words: { marginTop: 12, fontSize: 8, color: MUTED },
  wordsValue: { color: INK, fontWeight: 500 },

  panels: { flexDirection: "row", gap: 28, marginTop: 20 },
  panel: { flex: 1 },
  kv: { flexDirection: "row", marginBottom: 2 },
  kvKey: { width: "42%", color: FAINT, fontSize: 8 },
  kvVal: { flex: 1, fontSize: 8, fontWeight: 500 },
  body: { fontSize: 8, color: MUTED },

  signOff: { flexDirection: "row", alignItems: "flex-end", gap: 28, marginTop: 22 },
  signBlock: { width: 240, alignItems: "flex-end" },
  /* Seal to the left of the signature, centred on it, as on a stamped
     and signed Indian invoice. */
  signRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  seal: { width: 60, height: 60, objectFit: "contain" },
  signCol: { width: 170, alignItems: "flex-end" },
  signFor: { fontSize: 7.5, color: MUTED, textAlign: "right", marginBottom: 4 },
  signName: { fontSize: 8.5, fontWeight: 500, textAlign: "right" },
  signRole: { fontSize: 7, color: FAINT, textAlign: "right", marginTop: 1 },
  /* Bounded on both axes to the signature line's width: a 7:1 signature at a
     fixed height alone renders ~400pt wide and runs off the page. `contain`
     keeps a square stamp and a wide signature both inside the same box. */
  signImage: { width: 170, height: 40, objectFit: "contain", objectPosition: "right", marginBottom: 2 },
  signRule: { borderTopWidth: 1, borderTopColor: RULE, width: 170, marginTop: 4, paddingTop: 4 },

  footer: {
    position: "absolute", bottom: PAGE_MARGIN - 16, left: PAGE_MARGIN,
    fontSize: 6.8, color: FAINT,
  },
});

/** Table geometry, kept in one place so header and body can never disagree. */
const COLS_GST = { idx: "4%", desc: "34%", hsn: "10%", qty: "8%", rate: "15%", tax: "8%", amt: "21%" };
const COLS_PLAIN = { idx: "4%", desc: "48%", hsn: "0%", qty: "10%", rate: "17%", tax: "0%", amt: "21%" };

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * A style as produced by `StyleSheet.create`.
 *
 * Derived from the call rather than written out, so it tracks whatever
 * @react-pdf accepts instead of drifting from it. `object` was too wide and
 * would not type-check against <Text>.
 */
type PdfStyle = ReturnType<typeof StyleSheet.create>[string];

/** Renders a textarea's contents as one Text per line. */
function Lines({ text, style }: { text: string; style?: PdfStyle }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Text key={i} style={style}>
          {line || " "}
        </Text>
      ))}
    </>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <Text style={s.eyebrow}>{children}</Text>;
}

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const t = computeTotals(invoice);
  const c = currencyOf(invoice.currencyCode);
  const isGst = invoice.kind === "gst";
  const col = isGst ? COLS_GST : COLS_PLAIN;
  const accent = invoice.accent || "#0066cc";
  const pos = formatPlaceOfSupply(effectivePlaceOfSupply(invoice));

  // Only worth a column when the rates actually differ; a table repeating "18%"
  // on every row spends width to say nothing.
  const rates = new Set(invoice.items.map((i) => i.taxRatePercent));
  const showTaxCol = isGst && rates.size > 1;
  const showHsn = isGst && invoice.items.some((i) => i.hsn.trim() !== "");
  const showDiscount = invoice.items.some((i) => i.discountPercent > 0);

  // The description absorbs whatever the hidden columns would have used, so the
  // amount column always ends at the right margin and lines up with the totals
  // ladder beneath it. With fixed widths, hiding HSN and GST left the table 82%
  // wide and every amount sitting visibly short of the total it adds up to.
  const pct = (w: string) => Number.parseFloat(w);
  const descWidth = `${
    100 -
    pct(col.idx) - pct(col.qty) - pct(col.rate) - pct(col.amt) -
    (showHsn ? pct(col.hsn) : 0) - (showTaxCol ? pct(col.tax) : 0)
  }%`;

  return (
    <Document
      title={`${isGst ? "Tax Invoice" : "Invoice"} ${invoice.number} — ${invoice.seller.name}`}
      author={invoice.seller.name}
      subject={`Invoice for ${invoice.buyer.name || "client"}`}
    >
      <Page size="A4" style={s.page}>
        {/* Masthead */}
        <View style={s.masthead}>
          <View>
            {invoice.showLogo && (
              <View style={s.brandRow}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src="/cubixso-logo.png" style={s.logo} />
                <View>
                  <Text style={s.wordmark}>{invoice.seller.name.split(" ")[0].toUpperCase()}</Text>
                  <Text style={s.brandSub}>
                    {invoice.seller.name.split(" ").slice(1).join(" ").toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <View>
            <Text style={[s.docType, { color: accent }]}>{isGst ? "Tax Invoice" : "Invoice"}</Text>
            <Text style={s.docNumber}>{invoice.number || "—"}</Text>
          </View>
        </View>

        <View style={s.rule} />

        {/* Parties */}
        <View style={s.parties}>
          <View style={s.party}>
            <Eyebrow>From</Eyebrow>
            <Text style={s.partyName}>{invoice.seller.name}</Text>
            <Lines text={invoice.seller.address} style={s.partyLine} />
            {isGst && invoice.seller.gstin ? (
              <Text style={s.partyTag}>GSTIN {invoice.seller.gstin}</Text>
            ) : null}
            {!isGst && invoice.seller.pan ? (
              <Text style={s.partyTag}>PAN {invoice.seller.pan}</Text>
            ) : null}
            {invoice.seller.email ? <Text style={s.partyLine}>{invoice.seller.email}</Text> : null}
            {invoice.seller.phone ? <Text style={s.partyLine}>{invoice.seller.phone}</Text> : null}
          </View>

          <View style={s.party}>
            <Eyebrow>Billed to</Eyebrow>
            <Text style={s.partyName}>{invoice.buyer.name || "—"}</Text>
            <Lines text={invoice.buyer.address} style={s.partyLine} />
            {isGst && invoice.buyer.gstin ? (
              <Text style={s.partyTag}>GSTIN {invoice.buyer.gstin}</Text>
            ) : null}
            {invoice.buyer.email ? <Text style={s.partyLine}>{invoice.buyer.email}</Text> : null}
            {invoice.buyer.phone ? <Text style={s.partyLine}>{invoice.buyer.phone}</Text> : null}
          </View>
        </View>

        {/* Meta */}
        <View style={s.metaRow}>
          <View style={s.metaCell}>
            <Eyebrow>Issue date</Eyebrow>
            <Text style={s.metaValue}>{fmtDate(invoice.issueDate)}</Text>
          </View>
          <View style={s.metaCell}>
            <Eyebrow>Due date</Eyebrow>
            <Text style={s.metaValue}>{fmtDate(invoice.dueDate)}</Text>
          </View>
          {isGst && (
            <View style={s.metaCell}>
              <Eyebrow>Place of supply</Eyebrow>
              <Text style={s.metaValue}>{pos || "—"}</Text>
            </View>
          )}
          <View style={s.metaCell}>
            <Eyebrow>Currency</Eyebrow>
            <Text style={s.metaValue}>
              {c.code} · {c.name}
            </Text>
          </View>
        </View>

        <View style={s.rule} />

        {/* Items */}
        <View style={{ flexDirection: "row", paddingBottom: 7 }}>
          <Text style={[s.th, { width: col.idx }]}>#</Text>
          <Text style={[s.th, { width: descWidth }]}>Description</Text>
          {showHsn && <Text style={[s.th, { width: col.hsn }]}>HSN/SAC</Text>}
          <Text style={[s.th, { width: col.qty, textAlign: "right" }]}>Qty</Text>
          <Text style={[s.th, { width: col.rate, textAlign: "right" }]}>Rate</Text>
          {showTaxCol && <Text style={[s.th, { width: col.tax, textAlign: "right" }]}>GST</Text>}
          <Text style={[s.th, { width: col.amt, textAlign: "right" }]}>Amount</Text>
        </View>
        <View style={s.ruleSoft} />

        {invoice.items.map((item, i) => {
          const line = t.lines[i];
          return (
            <View key={item.id} style={[s.tr, s.rowRule]} wrap={false}>
              <Text style={[s.num, { width: col.idx, textAlign: "left", color: FAINT }]}>
                {String(i + 1).padStart(2, "0")}
              </Text>
              <View style={{ width: descWidth, paddingRight: 8 }}>
                <Lines text={item.description || "—"} style={s.cellDesc} />
                {item.unit ? <Text style={s.cellSub}>Unit: {item.unit}</Text> : null}
                {showDiscount && item.discountPercent > 0 ? (
                  <Text style={s.cellSub}>
                    Discount {item.discountPercent}% (−{formatMoney(line.discountMinor, c)})
                  </Text>
                ) : null}
              </View>
              {showHsn && <Text style={[s.num, { width: col.hsn, textAlign: "left" }]}>{item.hsn || "—"}</Text>}
              <Text style={[s.num, { width: col.qty }]}>{formatQty(item.quantity)}</Text>
              <Text style={[s.num, { width: col.rate }]}>{formatMoney(item.unitPriceMinor, c)}</Text>
              {showTaxCol && (
                <Text style={[s.num, { width: col.tax }]}>{item.taxRatePercent}%</Text>
              )}
              <Text style={[s.num, { width: col.amt, fontWeight: 500 }]}>
                {formatMoney(invoice.taxMode === "inclusive" ? line.totalMinor : line.taxableMinor, c)}
              </Text>
            </View>
          );
        })}

        {/* Totals */}
        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            {showDiscount && (
              <>
                <Row label="Gross" value={formatMoney(t.subtotalMinor, c)} />
                <Row label="Discount" value={`−${formatMoney(t.discountMinor, c)}`} />
              </>
            )}
            <Row label={isGst ? "Taxable value" : "Subtotal"} value={formatMoney(t.taxableMinor, c)} />

            {isGst && t.intraState && (
              <>
                <Row label={`CGST${rateSuffix(rates)}`} value={formatMoney(t.cgstMinor, c)} />
                <Row label={`SGST${rateSuffix(rates)}`} value={formatMoney(t.sgstMinor, c)} />
              </>
            )}
            {isGst && !t.intraState && (
              <Row label={`IGST${rateSuffix(rates, false)}`} value={formatMoney(t.igstMinor, c)} />
            )}
            {!isGst && <Row label="GST @ 0%" value={formatMoney(0, c)} />}

            {t.roundOffMinor !== 0 && (
              <Row
                label="Round off"
                value={`${t.roundOffMinor > 0 ? "+" : "−"}${formatMoney(Math.abs(t.roundOffMinor), c)}`}
              />
            )}

            <View style={[s.grand, { backgroundColor: PARCHMENT }]}>
              <Text style={s.grandLabel}>Total due</Text>
              <Text style={[s.grandValue, { color: accent }]}>
                {formatMoney(t.grandTotalMinor, c)}
              </Text>
            </View>
          </View>
        </View>

        {invoice.showAmountInWords && (
          <Text style={s.words}>
            Amount in words:{" "}
            <Text style={s.wordsValue}>{amountInWords(t.grandTotalMinor, invoice.currencyCode)}</Text>
          </Text>
        )}

        {/* Per-rate tax summary. Only earns its space on a mixed-rate invoice —
            at a single rate the totals ladder above already says everything. */}
        {isGst && t.buckets.length > 1 && (
          <View style={{ marginTop: 18 }} wrap={false}>
            <Eyebrow>Tax summary</Eyebrow>
            <View style={{ flexDirection: "row", paddingBottom: 5 }}>
              <Text style={[s.th, { width: "20%" }]}>Rate</Text>
              <Text style={[s.th, { width: "27%", textAlign: "right" }]}>Taxable</Text>
              <Text style={[s.th, { width: "26%", textAlign: "right" }]}>
                {t.intraState ? "CGST" : "IGST"}
              </Text>
              <Text style={[s.th, { width: "27%", textAlign: "right" }]}>
                {t.intraState ? "SGST" : "Total tax"}
              </Text>
            </View>
            <View style={s.ruleSoft} />
            {t.buckets.map((b) => (
              <View key={b.ratePercent} style={[s.tr, s.rowRule, { paddingVertical: 5 }]}>
                <Text style={{ width: "20%", fontSize: 8.5 }}>{b.ratePercent}%</Text>
                <Text style={[s.num, { width: "27%" }]}>{formatMoney(b.taxableMinor, c)}</Text>
                <Text style={[s.num, { width: "26%" }]}>
                  {formatMoney(t.intraState ? b.cgstMinor : b.igstMinor, c)}
                </Text>
                <Text style={[s.num, { width: "27%" }]}>
                  {formatMoney(t.intraState ? b.sgstMinor : b.taxMinor, c)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes and payment */}
        <View style={s.panels} wrap={false}>
          {invoice.notes.trim() !== "" && (
            <View style={s.panel}>
              <Eyebrow>Notes</Eyebrow>
              <Lines text={invoice.notes} style={s.body} />
            </View>
          )}
          {invoice.showBank && (
            <View style={s.panel}>
              <Eyebrow>Payment details</Eyebrow>
              <KV k="Payee" v={invoice.bank.payeeName} />
              <KV k="Account" v={invoice.bank.accountNumber} />
              <KV k="Type" v={invoice.bank.accountType} />
              <KV k="Bank" v={invoice.bank.bankName} />
              <KV k="Branch" v={invoice.bank.branch} />
              <KV k="IFSC" v={invoice.bank.ifsc} />
              <KV k="SWIFT" v={invoice.bank.swift} />
              <KV k="UPI" v={invoice.bank.upi} />
            </View>
          )}
        </View>

        {/* Sign-off: terms and signature share one row.
            Stacked, the pair ran about 10pt taller than what a one-line invoice
            leaves on page 1, and because it is kept together it jumped whole to
            page 2 and left a quarter of the first page blank. Side by side it
            is roughly half the height. */}
        <View style={s.signOff} wrap={false}>
          <View style={{ flex: 1 }}>
            {invoice.terms.trim() !== "" && (
              <>
                <Eyebrow>Terms</Eyebrow>
                <Lines text={invoice.terms} style={s.body} />
              </>
            )}
          </View>

          {invoice.showSignature && (
            <View style={s.signBlock}>
              {/* The conventional Indian sign-off: the company the signatory
                  acts for above the signature, the capacity below it. */}
              <Text style={s.signFor}>For {invoice.seller.name}</Text>
              <View style={s.signRow}>
                {invoice.showStamp && (
                  /* eslint-disable-next-line jsx-a11y/alt-text */
                  <Image src={BUILTIN_SEAL} style={s.seal} />
                )}
                <View style={s.signCol}>
                  {/* Always an image: signatureSrc falls back to the built-in
                      signature, so no saved draft can leave this line blank. */}
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={signatureSrc(invoice)} style={s.signImage} />
                  <View style={s.signRule}>
                    <Text style={s.signName}>{invoice.signatoryName || invoice.seller.name}</Text>
                    <Text style={s.signRole}>Authorised Signatory</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* One fixed Text, absolutely positioned against the page, repeated on
            every page. The original footer, a flex-row View holding two Texts,
            never rendered, which silently dropped the non-GST disclaimer from
            every PDF. A "page X of Y" counter was dropped too: react-pdf's
            `render` Text would not draw in any position tried. The invoice
            number is written in statically instead, so a loose second page can
            still be matched to its invoice. */}
        <Text style={s.footer} fixed>
          {`No. ${invoice.number || "—"} · ${
            isGst
              ? "This is a computer-generated tax invoice."
              : "Not a tax invoice. GST is not charged (0%)."
          }`}
        </Text>
      </Page>
    </Document>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.totalRow}>
      <Text style={s.totalLabel}>{label}</Text>
      <Text style={s.totalValue}>{value}</Text>
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  if (!v.trim()) return null;
  return (
    <View style={s.kv}>
      <Text style={s.kvKey}>{k}</Text>
      <Text style={s.kvVal}>{v}</Text>
    </View>
  );
}

/**
 * " @ 9%" when every line shares a rate, and nothing when they differ — half of
 * a mixed rate is not a number that means anything, and printing one would be
 * worse than leaving the ladder unlabelled.
 */
function rateSuffix(rates: Set<number>, half = true): string {
  if (rates.size !== 1) return "";
  const r = [...rates][0];
  return ` @ ${half ? r / 2 : r}%`;
}

/**
 * Whole quantities print bare ("2"), fractional ones keep just the digits they
 * need ("1.5", not "1.500"). Hourly and part-month billing needs the decimals;
 * a count of two panels does not.
 */
function formatQty(q: number): string {
  if (!Number.isFinite(q)) return "0";
  return Number.isInteger(q) ? String(q) : String(Number(q.toFixed(3)));
}
