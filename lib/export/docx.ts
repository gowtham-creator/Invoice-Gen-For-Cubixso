/**
 * The invoice as a Word document.
 *
 * Built from the same description as the PDF and HTML exports, so the words
 * and figures are identical; the layout is rebuilt in Word's own terms, as
 * borderless tables, which is how a Word invoice holds columns in place when
 * the client edits it.
 *
 * Inter is embedded so the file looks like the PDF on a machine that does not
 * have it installed. Word finds an embedded font by its legacy family name,
 * and for the static Medium weight that is "Inter Medium", not "Inter": the
 * name tables in public/fonts say so. Medium text uses that name, or Word would
 * quietly substitute.
 */

import {
  AlignmentType,
  BorderStyle,
  CharacterSet,
  Document,
  Footer,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IBorderOptions,
  type ParagraphChild,
} from "docx";
import type { Invoice } from "../invoice-types";
import { describe, fmtDate, type ExportAssets } from "./shared";

/** An image and its natural size, so it can be fitted without distortion. */
export interface DocxImage {
  data: Uint8Array;
  type: "png" | "jpg";
  width: number;
  height: number;
}

export interface DocxFonts {
  regular: Uint8Array;
  medium: Uint8Array;
}

const INK = "0A0A0A";
const SOFT = "242424";
const MUTED = "494949";
const RULE = "E3E3E3";
const RULE_SOFT = "EEEEEE";

/** Twips per point. Word measures page geometry in twentieths of a point. */
const TW = 20;
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 40 * TW;
const CONTENT = PAGE_W - 2 * MARGIN;

/** Word sizes images in pixels at 96 dpi. */
const px = (pt: number) => Math.round((pt * 96) / 72);

const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const line = (color: string, eighths = 4): IBorderOptions => ({ style: BorderStyle.SINGLE, size: eighths, color });
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

interface RunStyle {
  size?: number;
  medium?: boolean;
  color?: string;
  caps?: boolean;
  /** Tracking as a fraction of the size, the way the template states it. */
  track?: number;
}

function run(text: string, o: RunStyle = {}): TextRun {
  const size = o.size ?? 8.5;
  return new TextRun({
    text,
    font: o.medium ? "Inter Medium" : "Inter",
    size: Math.round(size * 2),
    color: o.color ?? INK,
    allCaps: o.caps,
    characterSpacing: o.track ? Math.round(size * o.track * TW) : undefined,
  });
}

/** Text with its line breaks kept. */
function runs(text: string, o: RunStyle = {}): TextRun[] {
  return text.split("\n").map((l, i) =>
    new TextRun({
      text: l,
      break: i > 0 ? 1 : undefined,
      font: o.medium ? "Inter Medium" : "Inter",
      size: Math.round((o.size ?? 8.5) * 2),
      color: o.color ?? INK,
    }),
  );
}

function para(children: ParagraphChild[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) {
  return new Paragraph({
    children,
    alignment: o.align,
    spacing: { before: (o.before ?? 0) * TW, after: (o.after ?? 0) * TW, line: 276 },
  });
}

const overline = (text: string) =>
  para([run(text, { size: 7, medium: true, color: MUTED, caps: true, track: 0.08 })], { after: 5 });

function cell(children: (Paragraph | Table)[], width: number, o: { borders?: Record<string, IBorderOptions>; top?: number; bottom?: number; right?: number; align?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable] } = {}) {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: o.align,
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, ...(o.borders ?? {}) },
    margins: { top: (o.top ?? 0) * TW, bottom: (o.bottom ?? 0) * TW, left: 0, right: (o.right ?? 0) * TW },
  });
}

function table(widths: number[], rows: TableRow[]) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows,
  });
}

/** Fits an image inside a box, keeping its proportions. */
function fit(img: DocxImage, boxW: number, boxH: number) {
  const scale = Math.min(boxW / img.width, boxH / img.height);
  return new ImageRun({
    type: img.type,
    data: img.data,
    transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
  });
}

const rule = (color: string, space = 16) =>
  new Paragraph({ border: { bottom: line(color, 6) }, spacing: { before: space * TW, after: space * TW } });

export function buildInvoiceDocx(invoice: Invoice, assets: ExportAssets<DocxImage>, fonts?: DocxFonts): Document {
  const d = describe(invoice);
  const inv = invoice;
  const [brand, ...rest] = inv.seller.name.split(" ");
  const accent = /^#[0-9a-f]{6}$/i.test(inv.accent) ? inv.accent.slice(1).toUpperCase() : "0066CC";

  // Masthead: logo, wordmark, and the document title on the right.
  const masthead = table([px(28) * 15 + 200, CONTENT * 0.5, CONTENT * 0.5 - (px(28) * 15 + 200)], [
    new TableRow({
      children: [
        cell([para(inv.showLogo ? [fit(assets.logo, px(28), px(28))] : [])], px(28) * 15 + 200, { align: VerticalAlignTable.CENTER }),
        cell(
          inv.showLogo
            ? [
                para([run(brand ?? "", { size: 11, medium: true, caps: true, track: 0.16 })]),
                para([run(rest.join(" "), { size: 7, medium: true, color: MUTED, caps: true, track: 0.08 })]),
              ]
            : [para([])],
          CONTENT * 0.5,
          { align: VerticalAlignTable.CENTER },
        ),
        cell(
          [
            para([run(d.title, { size: 11, medium: true, color: accent, caps: true, track: 0.22 })], { align: AlignmentType.RIGHT }),
            para([run(`No. ${inv.number || "—"}`, { size: 10 })], { align: AlignmentType.RIGHT, before: 3 }),
          ],
          CONTENT * 0.5 - (px(28) * 15 + 200),
          { align: VerticalAlignTable.CENTER },
        ),
      ],
    }),
  ]);

  const party = (label: string, p: Invoice["seller"], taxLine: string) => [
    overline(label),
    para([run(p.name || "—", { size: 9.5, medium: true })], { after: 3 }),
    para(runs(p.address, { color: MUTED })),
    ...(taxLine ? [para([run(taxLine)], { before: 4 })] : []),
    ...(p.email ? [para([run(p.email, { color: MUTED })])] : []),
    ...(p.phone ? [para([run(p.phone, { color: MUTED })])] : []),
  ];
  const sellerTax = d.isGst ? (inv.seller.gstin ? `GSTIN ${inv.seller.gstin}` : "") : inv.seller.pan ? `PAN ${inv.seller.pan}` : "";
  const buyerTax = d.isGst && inv.buyer.gstin ? `GSTIN ${inv.buyer.gstin}` : "";
  const half = Math.floor(CONTENT / 2);
  const parties = table([half, CONTENT - half], [
    new TableRow({
      children: [
        cell(party("From", inv.seller, sellerTax), half, { right: 28 }),
        cell(party("Billed to", inv.buyer, buyerTax), CONTENT - half),
      ],
    }),
  ]);

  const metaCells: [string, string][] = [
    ["Issue date", fmtDate(inv.issueDate)],
    ["Due date", fmtDate(inv.dueDate)],
    ...(d.isGst ? ([["Place of supply", d.placeOfSupply]] as [string, string][]) : []),
    ["Currency", `${d.c.code} · ${d.c.name}`],
  ];
  const metaW = Math.floor(CONTENT / metaCells.length);
  const meta = table(metaCells.map(() => metaW), [
    new TableRow({ children: metaCells.map(([k, v]) => cell([overline(k), para([run(v, { size: 9 })])], metaW, { right: 12 })) }),
  ]);

  // Items. The description absorbs the width of hidden columns, as in the PDF.
  const cols = {
    idx: CONTENT * 0.04,
    hsn: d.showHsn ? CONTENT * 0.1 : 0,
    qty: CONTENT * 0.08,
    rate: CONTENT * 0.15,
    gst: d.showRate ? CONTENT * 0.08 : 0,
    amt: CONTENT * 0.21,
  };
  const descW = CONTENT - cols.idx - cols.hsn - cols.qty - cols.rate - cols.gst - cols.amt;
  const widths = [cols.idx, descW, ...(d.showHsn ? [cols.hsn] : []), cols.qty, cols.rate, ...(d.showRate ? [cols.gst] : []), cols.amt].map(Math.round);
  const head = ["#", "Description", ...(d.showHsn ? ["HSN/SAC"] : []), "Qty", "Rate", ...(d.showRate ? ["GST"] : []), "Amount"];
  const rightFrom = d.showHsn ? 3 : 2;
  const headRow = new TableRow({
    tableHeader: true,
    children: head.map((h, i) =>
      cell(
        [para([run(h, { size: 7.5, medium: true, color: MUTED, caps: true, track: 0.08 })], { align: i >= rightFrom ? AlignmentType.RIGHT : undefined })],
        widths[i],
        { borders: { bottom: line(RULE_SOFT) }, bottom: 6 },
      ),
    ),
  });
  const itemRows = d.lines.map((l) => {
    const values = [l.index, null, ...(d.showHsn ? [l.hsn] : []), l.qty, l.rate, ...(d.showRate ? [l.gst] : []), l.amount];
    return new TableRow({
      cantSplit: true,
      children: values.map((v, i) =>
        cell(
          i === 1
            ? [para(runs(l.description, { size: 9.5, medium: true })), ...(l.discount ? [para([run(l.discount, { color: MUTED })], { before: 2 })] : [])]
            : [para([run(v as string, { size: 9.5, color: i === 0 ? MUTED : INK })], { align: i >= rightFrom ? AlignmentType.RIGHT : undefined })],
          widths[i],
          { borders: { bottom: line(RULE_SOFT) }, top: 8, bottom: 8, right: i === 1 ? 8 : 0 },
        ),
      ),
    });
  });
  const items = table(widths, [headRow, ...itemRows]);

  // The ladder sits in the right half, under the amount column.
  const ladder = table([half, CONTENT - half - CONTENT * 0.21, CONTENT * 0.21].map(Math.round), d.ladder.map(
    (r) =>
      new TableRow({
        children: [
          cell([para([])], half),
          cell([para([run(r.label, { size: 9, color: SOFT })])], Math.round(CONTENT - half - CONTENT * 0.21), { top: 2, bottom: 2 }),
          cell([para([run(r.value, { size: 9.5 })], { align: AlignmentType.RIGHT })], Math.round(CONTENT * 0.21), { top: 2, bottom: 2 }),
        ],
      }),
  ));

  const figureSize = d.total.length <= 12 ? 40 : d.total.length <= 14 ? 34 : 28;
  const grand = table([Math.round(CONTENT * 0.4), Math.round(CONTENT * 0.6)], [
    new TableRow({
      cantSplit: true,
      children: [
        cell(
          [
            para([run("Total due", { size: 7.5, medium: true, color: MUTED, caps: true, track: 0.14 })]),
            ...(d.payableBy ? [para([run(d.payableBy, { size: 9, color: SOFT })], { before: 3 })] : []),
          ],
          Math.round(CONTENT * 0.4),
          { borders: { top: line(INK, 8) }, top: 10, align: VerticalAlignTable.BOTTOM },
        ),
        cell(
          [para([run(d.total, { size: figureSize, track: -0.03 })], { align: AlignmentType.RIGHT })],
          Math.round(CONTENT * 0.6),
          { borders: { top: line(INK, 8) }, top: 10, align: VerticalAlignTable.BOTTOM },
        ),
      ],
    }),
  ]);

  const summary = d.buckets.length
    ? [
        para([], { before: 14 }),
        overline("Tax summary"),
        table([0.2, 0.27, 0.26, 0.27].map((f) => Math.round(CONTENT * f)), [
          new TableRow({
            children: ["Rate", "Taxable", d.t.intraState ? "CGST" : "IGST", d.t.intraState ? "SGST" : "Total tax"].map((h, i) =>
              cell([para([run(h, { size: 7.5, medium: true, color: MUTED, caps: true, track: 0.08 })], { align: i ? AlignmentType.RIGHT : undefined })],
                Math.round(CONTENT * [0.2, 0.27, 0.26, 0.27][i]), { borders: { bottom: line(RULE_SOFT) }, bottom: 5 }),
            ),
          }),
          ...d.buckets.map(
            (b) =>
              new TableRow({
                children: [
                  `${b.ratePercent}%`,
                  d.money(b.taxableMinor),
                  d.money(d.t.intraState ? b.cgstMinor : b.igstMinor),
                  d.money(d.t.intraState ? b.sgstMinor : b.taxMinor),
                ].map((v, i) =>
                  cell([para([run(v, { size: 9.5 })], { align: i ? AlignmentType.RIGHT : undefined })],
                    Math.round(CONTENT * [0.2, 0.27, 0.26, 0.27][i]), { borders: { bottom: line(RULE_SOFT) }, top: 4, bottom: 4 }),
                ),
              }),
          ),
        ]),
      ]
    : [];

  // Close: payment and terms on the left; signature, rule, name and seal right.
  const signW = 190 * TW;
  const leftW = CONTENT - signW - 28 * TW;
  const kvRows = d.payment.map(
    ([k, v]) =>
      new TableRow({
        children: [
          cell([para([run(k, { color: MUTED })])], 56 * TW, { bottom: 1 }),
          cell([para([run(v)])], leftW - 56 * TW, { bottom: 1 }),
        ],
      }),
  );
  const left: (Paragraph | Table)[] = [
    ...(inv.showBank && kvRows.length ? [overline("Payment details"), table([56 * TW, leftW - 56 * TW], kvRows)] : []),
    ...(inv.terms.trim() ? [para([], { before: inv.showBank ? 14 : 0 }), overline("Terms"), para(runs(inv.terms, { color: MUTED }))] : []),
  ];
  const right: Paragraph[] = inv.showSignature
    ? [
        para([run(`For ${inv.seller.name}`, { color: MUTED })], { align: AlignmentType.RIGHT, after: 4 }),
        para([fit(assets.signature, px(190), px(40))], { align: AlignmentType.RIGHT }),
        new Paragraph({
          border: { top: line(RULE, 6) },
          alignment: AlignmentType.RIGHT,
          spacing: { before: 4 * TW },
          children: [run(inv.signatoryName || inv.seller.name, { size: 9.5, medium: true })],
        }),
        para([run("Authorised Signatory", { size: 8, color: MUTED })], { align: AlignmentType.RIGHT }),
        ...(inv.showStamp ? [para([fit(assets.seal, px(86), px(86))], { align: AlignmentType.CENTER, before: 8 })] : []),
      ]
    : [para([])];
  const close = table([leftW, 28 * TW, signW], [
    new TableRow({
      cantSplit: true,
      children: [cell(left.length ? left : [para([])], leftW), cell([para([])], 28 * TW), cell(right, signW)],
    }),
  ]);

  const body: (Paragraph | Table)[] = [
    masthead,
    rule(RULE),
    parties,
    para([], { before: 12 }),
    meta,
    rule(RULE),
    items,
    para([], { before: 8 }),
    ladder,
    para([], { before: 6 }),
    grand,
    ...(inv.showAmountInWords
      ? [para([run("Amount in words: ", { color: MUTED }), run(d.words)], { before: 14 })]
      : []),
    ...summary,
    ...(inv.notes.trim() ? [para([], { before: 14 }), overline("Notes"), para(runs(inv.notes, { color: MUTED }))] : []),
    para([], { before: 16 }),
    close,
  ];

  return new Document({
    creator: inv.seller.name,
    title: `${d.title} ${inv.number}`,
    description: `Invoice for ${inv.buyer.name || "client"}`,
    ...(fonts
      ? {
          // docx types this as Node's Buffer, but only slices and maps the
          // bytes, so a browser Uint8Array works as-is.
          fonts: [
            { name: "Inter", data: fonts.regular as unknown as Buffer, characterSet: CharacterSet.ANSI },
            { name: "Inter Medium", data: fonts.medium as unknown as Buffer, characterSet: CharacterSet.ANSI },
          ],
        }
      : {}),
    styles: { default: { document: { run: { font: "Inter", size: 17, color: INK } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, bottom: MARGIN + 14 * TW, left: MARGIN, right: MARGIN, footer: 24 * TW },
          },
        },
        footers: { default: new Footer({ children: [para([run(d.footer, { size: 8, color: MUTED })])] }) },
        children: body,
      },
    ],
  });
}
