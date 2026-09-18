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
import { formatPlaceOfSupply, isCustomSignature } from "../lib/defaults";
import { FONT, PAGE_MARGIN, PALETTES, liftForDark, totalSize, typeFor, type Palette, type Variant } from "./theme";

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

/**
 * The stylesheet for one palette. Built once per variant at module load, so
 * switching the theme swaps a finished stylesheet rather than rebuilding one on
 * every keystroke.
 */
function buildStyles(p: Palette) {
  const TYPE = typeFor(p);
  return StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 8.5,
    color: p.ink,
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN + 14,
    paddingHorizontal: PAGE_MARGIN,
    lineHeight: 1.45,
    backgroundColor: p.paper,
  },

  masthead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  /* The real mark from the Cubixso site, not a redraw. Printed at its own
     colour: a logo is not a themeable element. */
  logo: { width: 28, height: 28, objectFit: "contain" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: { ...TYPE.brand },
  brandSub: { ...TYPE.overline, marginTop: 2 },
  docType: { ...TYPE.docTitle, textAlign: "right" },
  docNumber: { ...TYPE.docNumber, textAlign: "right", marginTop: 3 },

  rule: { borderTopWidth: 1, borderTopColor: p.rule, marginVertical: 18 },
  ruleSoft: { borderTopWidth: 1, borderTopColor: p.ruleSoft },
  /* Rows close themselves underneath, so the header rule is not doubled
     and the last row still has an edge below it. */
  rowRule: { borderBottomWidth: 1, borderBottomColor: p.ruleSoft },

  eyebrow: { ...TYPE.overline, marginBottom: 6 },

  parties: { flexDirection: "row", gap: 28 },
  party: { flex: 1 },
  partyName: { ...TYPE.name, marginBottom: 3 },
  partyLine: { ...TYPE.body },
  partyTag: { ...TYPE.bodyInk, marginTop: 4 },

  metaRow: { flexDirection: "row", gap: 20, marginTop: 18 },
  metaCell: { flex: 1 },
  metaValue: { ...TYPE.value },

  th: { ...TYPE.tableHead },
  tr: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 9 },
  cellDesc: { ...TYPE.name },
  cellSub: { ...TYPE.body, marginTop: 2 },
  num: { ...TYPE.figure, textAlign: "right" },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totals: { width: "50%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { ...TYPE.subValue },
  totalValue: { ...TYPE.figure },

  /* The template's grand-total band: full width under an ink rule, label and
     due date on the left, the figure large and Regular on the right. No shaded
     box: the template separates with rules, never with filled panels. */
  grand: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    borderTopWidth: 1, borderTopColor: p.ruleStrong, marginTop: 12, paddingTop: 10,
  },
  grandLabel: { ...TYPE.totalLabel },
  grandSub: { ...TYPE.subValue, marginTop: 3 },
  grandValue: { ...TYPE.total, lineHeight: 1 },

  words: { ...TYPE.body, marginTop: 16 },
  wordsValue: { color: p.ink },

  notes: { marginTop: 20 },
  kv: { flexDirection: "row", marginBottom: 2 },
  /* A fixed key width, not a percentage: the left column is narrower now, and
     42% of it would squeeze the payee name onto two lines. */
  kvKey: { ...TYPE.body, width: 56 },
  kvVal: { ...TYPE.bodyInk, flex: 1 },
  body: { ...TYPE.body },

  close: { flexDirection: "row", alignItems: "flex-start", gap: 28, marginTop: 20 },
  closeLeft: { flex: 1 },
  signBlock: { width: 190, alignItems: "flex-end" },
  /* Beneath "Authorised Signatory", centred under the signature line. */
  /* 86pt reads as a real rubber seal on an A4 page; at 58pt the ring text
     was too small to read. The page has room: the close is two columns. */
  seal: { width: 86, height: 86, objectFit: "contain", alignSelf: "center", marginTop: 8 },
  signFor: { ...TYPE.body, textAlign: "right", marginBottom: 4 },
  signName: { ...TYPE.name, textAlign: "right" },
  signRole: { ...TYPE.caption, textAlign: "right", marginTop: 1 },
  /* Bounded on both axes to the signature line's width: a 7:1 signature at a
     fixed height alone renders ~400pt wide and runs off the page. */
  signImage: { width: 190, height: 40, objectFit: "contain", objectPosition: "right", marginBottom: 2 },
  signRule: { borderTopWidth: 1, borderTopColor: p.rule, width: 190, marginTop: 4, paddingTop: 4 },

  footer: { ...TYPE.caption, position: "absolute", bottom: PAGE_MARGIN - 16, left: PAGE_MARGIN },
  });
}

const STYLES = { light: buildStyles(PALETTES.light), dark: buildStyles(PALETTES.dark) };
type Styles = (typeof STYLES)[Variant];

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

function Eyebrow({ children, s }: { children: string; s: Styles }) {
  return <Text style={s.eyebrow}>{children}</Text>;
}

export function InvoiceDocument({
  invoice,
  variant = "light",
  darkSignature,
}: {
  invoice: Invoice;
  /**
   * "dark" follows the template's dark mode, for reading on a dark screen.
   * Anything that leaves the app (downloads, exports, the preview screen) is
   * rendered "light": that is the document a client files and prints.
   */
  variant?: Variant;
  /** An uploaded signature redrawn in light ink, for the dark variant. */
  darkSignature?: string;
}) {
  const s = STYLES[variant];
  const p = PALETTES[variant];
  const t = computeTotals(invoice);
  const c = currencyOf(invoice.currencyCode);
  const isGst = invoice.kind === "gst";
  const col = isGst ? COLS_GST : COLS_PLAIN;
  const baseAccent = invoice.accent || "#0066cc";
  const accent = variant === "dark" ? liftForDark(baseAccent) : baseAccent;
  // The built-in signature has a light-ink twin; an upload is redrawn by the
  // preview (see darkSignature) since it cannot be known ahead of time.
  const signature = isCustomSignature(invoice)
    ? variant === "dark" && darkSignature ? darkSignature : (invoice.signatureImage as string)
    : p.signature;
  const totalText = formatMoney(t.grandTotalMinor, c);
  const totalSizePt = totalSize(totalText);
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
                <Image src={p.logo} style={s.logo} />
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
            {/* The accent lives on the small title: at 40pt the template sets the
                total in ink, and a coloured figure that size shouts. */}
            <Text style={[s.docType, { color: accent }]}>{isGst ? "Tax Invoice" : "Invoice"}</Text>
            <Text style={s.docNumber}>No. {invoice.number || "—"}</Text>
          </View>
        </View>

        <View style={s.rule} />

        {/* Parties */}
        <View style={s.parties}>
          <View style={s.party}>
            <Eyebrow s={s}>From</Eyebrow>
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
            <Eyebrow s={s}>Billed to</Eyebrow>
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
            <Eyebrow s={s}>Issue date</Eyebrow>
            <Text style={s.metaValue}>{fmtDate(invoice.issueDate)}</Text>
          </View>
          <View style={s.metaCell}>
            <Eyebrow s={s}>Due date</Eyebrow>
            <Text style={s.metaValue}>{fmtDate(invoice.dueDate)}</Text>
          </View>
          {isGst && (
            <View style={s.metaCell}>
              <Eyebrow s={s}>Place of supply</Eyebrow>
              <Text style={s.metaValue}>{pos || "—"}</Text>
            </View>
          )}
          <View style={s.metaCell}>
            <Eyebrow s={s}>Currency</Eyebrow>
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
              <Text style={[s.num, { width: col.idx, textAlign: "left", color: p.muted }]}>
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
                <Row s={s} label="Gross" value={formatMoney(t.subtotalMinor, c)} />
                <Row s={s} label="Discount" value={`−${formatMoney(t.discountMinor, c)}`} />
              </>
            )}
            <Row s={s} label={isGst ? "Taxable value" : "Subtotal"} value={formatMoney(t.taxableMinor, c)} />

            {isGst && t.intraState && (
              <>
                <Row s={s} label={`CGST${rateSuffix(rates)}`} value={formatMoney(t.cgstMinor, c)} />
                <Row s={s} label={`SGST${rateSuffix(rates)}`} value={formatMoney(t.sgstMinor, c)} />
              </>
            )}
            {isGst && !t.intraState && (
              <Row s={s} label={`IGST${rateSuffix(rates, false)}`} value={formatMoney(t.igstMinor, c)} />
            )}
            {!isGst && <Row s={s} label="GST @ 0%" value={formatMoney(0, c)} />}

            {t.roundOffMinor !== 0 && (
              <Row
                s={s}
                label="Round off"
                value={`${t.roundOffMinor > 0 ? "+" : "−"}${formatMoney(Math.abs(t.roundOffMinor), c)}`}
              />
            )}

          </View>
        </View>

        <View style={s.grand} wrap={false}>
          <View>
            <Text style={s.grandLabel}>Total due</Text>
            {invoice.dueDate ? (
              <Text style={s.grandSub}>Payable by {fmtDate(invoice.dueDate)}</Text>
            ) : null}
          </View>
          <Text
            style={[
              s.grandValue,
              // Tracking stays at the template's −3% of whatever size the
              // figure steps down to.
              { fontSize: totalSizePt, letterSpacing: totalSizePt * -0.03 },
            ]}
          >
            {totalText}
          </Text>
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
            <Eyebrow s={s}>Tax summary</Eyebrow>
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

        {invoice.notes.trim() !== "" && (
          <View style={s.notes} wrap={false}>
            <Eyebrow s={s}>Notes</Eyebrow>
            <Lines text={invoice.notes} style={s.body} />
          </View>
        )}

        {/* Close: payment details and terms stacked on the left, the signature
            column on the right with the seal beneath "Authorised Signatory".
            Stacking the seal under the signature adds ~60pt; laying the two
            columns side by side is what keeps a one-line invoice on one page,
            and stops payment details sprawling across the full width. */}
        <View style={s.close} wrap={false}>
          <View style={s.closeLeft}>
            {invoice.showBank && (
              <View>
                <Eyebrow s={s}>Payment details</Eyebrow>
                <KV s={s} k="Payee" v={invoice.bank.payeeName} />
                <KV s={s} k="Account" v={invoice.bank.accountNumber} />
                <KV s={s} k="Type" v={invoice.bank.accountType} />
                <KV s={s} k="Bank" v={invoice.bank.bankName} />
                <KV s={s} k="Branch" v={invoice.bank.branch} />
                <KV s={s} k="IFSC" v={invoice.bank.ifsc} />
                <KV s={s} k="SWIFT" v={invoice.bank.swift} />
                <KV s={s} k="UPI" v={invoice.bank.upi} />
              </View>
            )}
            {invoice.terms.trim() !== "" && (
              <View style={invoice.showBank ? { marginTop: 16 } : undefined}>
                <Eyebrow s={s}>Terms</Eyebrow>
                <Lines text={invoice.terms} style={s.body} />
              </View>
            )}
          </View>

          {invoice.showSignature && (
            <View style={s.signBlock}>
              {/* The conventional Indian sign-off: the company the signatory
                  acts for above the signature, the capacity below it, and the
                  company seal beneath that. */}
              <Text style={s.signFor}>For {invoice.seller.name}</Text>
              {/* Always an image: signatureSrc falls back to the built-in
                  signature, so no saved draft can leave this line blank. */}
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={signature} style={s.signImage} />
              <View style={s.signRule}>
                <Text style={s.signName}>{invoice.signatoryName || invoice.seller.name}</Text>
                <Text style={s.signRole}>Authorised Signatory</Text>
              </View>
              {invoice.showStamp && (
                /* eslint-disable-next-line jsx-a11y/alt-text */
                <Image src={p.seal} style={s.seal} />
              )}
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
          {`No. ${invoice.number || "—"} · All amounts in ${c.code} · ${
            isGst
              ? "This is a computer-generated tax invoice."
              : "Not a tax invoice. GST is not charged (0%)."
          }`}
        </Text>
      </Page>
    </Document>
  );
}

function Row({ s, label, value }: { s: Styles; label: string; value: string }) {
  return (
    <View style={s.totalRow}>
      <Text style={s.totalLabel}>{label}</Text>
      <Text style={s.totalValue}>{value}</Text>
    </View>
  );
}

function KV({ s, k, v }: { s: Styles; k: string; v: string }) {
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
