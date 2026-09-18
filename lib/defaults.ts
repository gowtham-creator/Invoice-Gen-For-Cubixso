/**
 * Cubixso's real billing particulars, pre-filled so a new invoice starts from
 * a usable document rather than an empty form.
 *
 * Sourced from the signed agreements and previously issued invoices: the
 * registered-office line and CIN/GSTIN from the company letterhead, the Axis
 * account from Invoice #003 (COLTEC), the SBI account from the Hare Krishna
 * Movement invoices. Every field stays editable — these are starting points,
 * not constants.
 */

import type { BankDetails, Invoice, LineItem, Party } from "./invoice-types";

export const SELLER_STATE = "Telangana";

export const CUBIXSO_SELLER: Party = {
  name: "CUBIXSO Solutions Private Limited",
  address: "WeWork, RMZ Spire, Hyderabad\nTelangana 500081, India\nCIN: U63999TS2024PTC187911",
  gstin: "36AAMCC0213G1Z2",
  pan: "AAMCC0213G",
  email: "contact@cubixso.com",
  phone: "+91 92469 01689",
  state: SELLER_STATE,
};

/** The earlier registered address, kept as a one-click alternative. */
export const CUBIXSO_THUB_ADDRESS =
  "T-Hub Phase 2, Raidurg, Hyderabad\nTelangana 500081, India\nCIN: U63999TS2024PTC187911";

export const BANK_PROFILES: BankDetails[] = [
  {
    label: "Axis Bank — Company Current",
    payeeName: "CUBIXSO SOLUTIONS PRIVATE LIMITED",
    accountNumber: "924020063787956",
    accountType: "Current",
    bankName: "Axis Bank",
    branch: "Kukatpally, Hyderabad",
    ifsc: "UTIB0000193",
    swift: "",
    upi: "",
  },
  {
    label: "SBI — Proprietor Savings",
    payeeName: "Nayini Gowtham Reddy",
    accountNumber: "00000042216852880",
    accountType: "Savings",
    bankName: "State Bank of India",
    branch: "Matrusri Nagar, Miyapur, Hyderabad",
    ifsc: "SBIN0040950",
    swift: "",
    upi: "",
  },
];

/**
 * Nayini Gowtham Reddy's signature, from the Board Resolution: a transparent
 * PNG, so it sits on the paper rather than in a white box.
 */
export const BUILTIN_SIGNATURE = "/signature.png";

/** The company seal, trimmed to its ink so it prints at a readable size. */
export const BUILTIN_SEAL = "/seal.png";

/**
 * The signature to print.
 *
 * Only an uploaded image (a data URL) replaces the built-in signature. Anything
 * else falls back to it, including `null` and the file paths older drafts
 * stored here. Resolving at render time, rather than seeding a default into
 * the draft, is what makes the signature permanent: a draft saved before it
 * existed held `null`, and that saved value was overriding the new default.
 */
export function signatureSrc(inv: Pick<Invoice, "signatureImage">): string {
  const v = inv.signatureImage;
  return v && v.startsWith("data:") ? v : BUILTIN_SIGNATURE;
}

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

/**
 * Indian states with their GST state codes. The code is what appears on a tax
 * invoice's place-of-supply line ("Telangana (36)"), so it is carried here
 * rather than left to the user to remember.
 */
export const INDIAN_STATES: { name: string; code: string }[] = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" }, { name: "Bihar", code: "10" },
  { name: "Chandigarh", code: "04" }, { name: "Chhattisgarh", code: "22" },
  { name: "Delhi", code: "07" }, { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" }, { name: "Jammu and Kashmir", code: "01" },
  { name: "Jharkhand", code: "20" }, { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" }, { name: "Ladakh", code: "38" },
  { name: "Madhya Pradesh", code: "23" }, { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" }, { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" }, { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" }, { name: "Puducherry", code: "34" },
  { name: "Punjab", code: "03" }, { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" }, { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" }, { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" }, { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
];

export function stateCode(name: string): string | null {
  const n = name.trim().toLowerCase();
  return INDIAN_STATES.find((s) => s.name.toLowerCase() === n)?.code ?? null;
}

/** "Telangana (36)" when the state is recognised, otherwise the raw text. */
export function formatPlaceOfSupply(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const code = stateCode(trimmed);
  return code ? `${trimmed} (${code})` : trimmed;
}

export const DEFAULT_TERMS = [
  "Payment due within 15 days of the invoice date.",
  "Please quote the invoice number with your remittance.",
  "All prices are exclusive of GST unless stated otherwise.",
].join("\n");

let seq = 0;
/** Collision-resistant without pulling in a uuid dependency. */
export function newId(): string {
  seq += 1;
  return `${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function emptyItem(taxRatePercent = 18): LineItem {
  return {
    id: newId(),
    description: "",
    hsn: "",
    quantity: 1,
    unit: "",
    unitPriceMinor: 0,
    discountPercent: 0,
    taxRatePercent,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function blankInvoice(kind: Invoice["kind"] = "gst"): Invoice {
  return {
    kind,
    number: "001",
    issueDate: today(),
    dueDate: plusDays(15),
    currencyCode: "INR",
    taxMode: "exclusive",
    roundOff: true,
    seller: { ...CUBIXSO_SELLER },
    buyer: { name: "", address: "", gstin: "", pan: "", email: "", phone: "", state: "" },
    placeOfSupply: "",
    items: [emptyItem(kind === "gst" ? 18 : 0)],
    notes: "",
    terms: DEFAULT_TERMS,
    bank: { ...BANK_PROFILES[0] },
    showLogo: true,
    showBank: true,
    showSignature: true,
    showAmountInWords: true,
    signatoryName: "Nayini Gowtham Reddy",
    showStamp: true,
    signatureImage: null,
    accent: "#0066cc",
  };
}
