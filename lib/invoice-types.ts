/**
 * The invoice document model.
 *
 * One shape serves both invoice kinds. A non-GST invoice is not a different
 * document with different fields — it is this document with every tax rate at
 * zero and the tax apparatus (GSTINs, place of supply, CGST/SGST ladder)
 * suppressed at render time. Keeping one model means switching kinds never
 * loses the line items the user already typed.
 */

/**
 * `gst` prints a compliant Indian tax invoice: both GSTINs, place of supply,
 * HSN/SAC per line and a CGST+SGST or IGST ladder.
 * `non-gst` prints a plain bill of supply at 0%.
 */
export type InvoiceKind = "gst" | "non-gst";

/**
 * Whether the unit price already contains tax.
 *
 * `exclusive` adds tax on top, which is how Cubixso's service invoices are
 * quoted ("Above price is exclusive of GST"). `inclusive` back-computes the tax
 * out of the price, which is how retail catalogue pricing works. The customer
 * pays a different total under each, so this is never a display-only setting.
 */
export type TaxMode = "exclusive" | "inclusive";

export interface Party {
  name: string;
  /** Free-form, one line per newline. Printed verbatim. */
  address: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  /** Drives the CGST/SGST vs IGST decision when this party is the buyer. */
  state: string;
}

export interface LineItem {
  id: string;
  description: string;
  /** HSN for goods, SAC for services. GST invoices only. */
  hsn: string;
  /** Allowed fractional for hourly or partial-month billing. */
  quantity: number;
  unit: string;
  /** Integer minor units. */
  unitPriceMinor: number;
  /** Percent off this line, applied before tax. */
  discountPercent: number;
  /** Per-line so a single invoice can mix 18% services and 5% goods. */
  taxRatePercent: number;
}

export interface BankDetails {
  label: string;
  payeeName: string;
  accountNumber: string;
  accountType: string;
  bankName: string;
  branch: string;
  ifsc: string;
  swift: string;
  upi: string;
}

export interface Invoice {
  kind: InvoiceKind;
  number: string;
  issueDate: string;
  dueDate: string;
  currencyCode: string;
  taxMode: TaxMode;
  /** Round the grand total to a whole unit and print the delta as a line. */
  roundOff: boolean;

  seller: Party;
  buyer: Party;
  /** Where the supply is deemed to occur. Empty means "same as buyer state". */
  placeOfSupply: string;

  items: LineItem[];

  /** The free-text box: scope recap, milestone notes, anything worth saying. */
  notes: string;
  terms: string;
  bank: BankDetails;

  showLogo: boolean;
  showBank: boolean;
  showSignature: boolean;
  /** The company seal beside the signature. */
  showStamp: boolean;
  showAmountInWords: boolean;
  signatoryName: string;
  /**
   * An uploaded replacement signature, as a data URL. Null means "use the
   * built-in one", and so does anything that is not a data URL (older drafts
   * stored file paths here). The built-in signature is therefore permanent: no
   * saved value can blank it. Only `showSignature` hides the block.
   */
  signatureImage: string | null;
  /** Accent colour for the document, as a hex string. */
  accent: string;
}
