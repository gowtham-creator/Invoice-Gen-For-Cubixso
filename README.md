# Cubixso Invoicer

GST and non-GST invoices, in any currency, as print-ready PDFs.

Everything stays on your machine. There is no account, no server and no database:
invoices carry client names, bank account numbers and GSTINs, so the safest place
to keep them is the laptop that typed them.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # the money maths
```

Fonts are committed under `public/fonts`. If they ever go missing:

```bash
npm run fonts
```

## The two invoice kinds

**GST Invoice** prints a compliant Indian tax invoice: both GSTINs, place of
supply, HSN/SAC per line, and a tax ladder that is either CGST + SGST or a single
IGST line. Which one you get is *derived from the addresses*, not chosen from a
menu — a supply landing in the seller's own state is intra-state and splits into
CGST + SGST; anywhere else is IGST. Printing the wrong one makes the invoice
legally wrong, so it is not left to a toggle somebody can forget to flip.

**Non-GST (0%)** prints a plain invoice with no tax breakdown and no GSTIN
required. Switching to it genuinely zeroes every line rate rather than hiding
them, so the totals can never carry tax the printed page does not show.

Prices can be quoted **exclusive** of GST (added on top — how Cubixso's service
invoices are written) or **inclusive** (backed out of the price — how retail
pricing works). The customer pays a different total under each.

## How the money works

Every amount is an **integer in the currency's minor unit** — paise, cents, or
whole yen. Floats are never used to hold money: `0.1 + 0.2` on a line item is how
invoices end up a rupee off, and an invoice that does not add up is not an
invoice.

Rounding happens in exactly two places: once per line, and once on the optional
round-off. Derived parts are always computed *from* the whole rather than
independently, so CGST and SGST are `floor(tax/2)` and `tax - floor(tax/2)` and
can never fail to sum back to the tax.

`lib/invoice-math.test.ts` checks this against Invoice #003 (COLTEC) verbatim —
two panels at ₹1,10,000 with 18% GST — so the code fails the moment it stops
agreeing with a document a client already paid against.

## Why the preview is the PDF

The right-hand pane is the real PDF, rendered by the same component that produces
the download, not an HTML lookalike beside it. An HTML preview is a second
implementation of the document that will eventually disagree with the file being
sent, and a preview you cannot trust is worth nothing. Regeneration is debounced
and the previous page stays up while the next renders.

## Currency

Twelve currencies, each with its own grouping and decimal count. Amounts in words
follow the currency's numbering system — Indian currencies speak lakh and crore,
the rest speak million and billion. "Lakh" on a USD invoice reads as a mistake.

The PDF embeds Inter rather than using a standard PDF font, because the built-in
ones are Latin-1 and cannot encode `₹` (U+20B9). `scripts/get-fonts.mjs` verifies
the glyph is present in the cmap before accepting a download — a subsetted font
loads fine and silently renders every rupee amount as a blank box.

## Layout

```
lib/       money, GST engine, amounts in words, persistence
pdf/       the invoice document, brand tokens, the logo as vectors
components/ editor controls, line items, preview pane
app/       shell and design tokens
```

`lib/defaults.ts` holds Cubixso's real billing particulars — registered office,
CIN, GSTIN, and both bank profiles (Axis company current, SBI proprietor savings).
Every field is editable; these are starting points, not constants.
