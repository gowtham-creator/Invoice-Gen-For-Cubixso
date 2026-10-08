/**
 * Storage: the migration from the previous version, and the invariants the
 * home screen relies on.
 *
 * The migration tests matter most. They run against the real data shape the
 * previous version wrote to the user's browser, and a mistake there loses
 * invoices, so each rule gets its own case.
 *
 * Run: npm test
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const RECORDS_KEY = "cubixso.invoices.v2";
const V1_DRAFT = "cubixso.invoice.draft.v1";
const V1_SAVED = "cubixso.invoice.saved.v1";

let store: Map<string, string>;

function stubStorage(seed: Record<string, unknown> = {}) {
  store = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    },
  };
}

beforeEach(() => stubStorage());

const v1Invoice = (number: string, client: string, extra: object = {}) => ({
  kind: "gst",
  number,
  buyer: { name: client },
  items: [{ id: "a", description: "Work", quantity: 1, unitPriceMinor: 100_00, discountPercent: 0, taxRatePercent: 18, hsn: "", unit: "" }],
  ...extra,
});

test("every saved v1 invoice becomes a record, and the v1 keys are left in place", async () => {
  stubStorage({
    [V1_SAVED]: [
      { id: "gst-001", savedAt: "2026-09-10T10:00:00Z", invoice: v1Invoice("001", "Coltec") },
      { id: "gst-002", savedAt: "2026-09-12T10:00:00Z", invoice: v1Invoice("002", "HKM") },
    ],
  });
  const { listInvoices } = await import("./storage.ts");
  const records = listInvoices();
  assert.deepEqual(records.map((r) => r.invoice.buyer.name).sort(), ["Coltec", "HKM"]);
  assert.ok(store.has(V1_SAVED), "v1 saved list is kept as a backup");
  assert.ok(store.has(RECORDS_KEY), "migration is written once");
});

test("a draft with a saved invoice's number replaces that invoice's contents, not duplicates it", async () => {
  stubStorage({
    [V1_SAVED]: [{ id: "gst-001", savedAt: "2026-09-10T10:00:00Z", invoice: v1Invoice("001", "Coltec") }],
    [V1_DRAFT]: v1Invoice("001", "Coltec India Private Limited"),
  });
  const { listInvoices } = await import("./storage.ts");
  const records = listInvoices();
  assert.equal(records.length, 1);
  assert.equal(records[0].invoice.buyer.name, "Coltec India Private Limited", "the newer edit wins");
});

test("a draft with its own content becomes its own record", async () => {
  stubStorage({
    [V1_SAVED]: [{ id: "gst-001", savedAt: "2026-09-10T10:00:00Z", invoice: v1Invoice("001", "Coltec") }],
    [V1_DRAFT]: v1Invoice("002", "HKM"),
  });
  const { listInvoices } = await import("./storage.ts");
  assert.equal(listInvoices().length, 2);
});

test("a blank draft is not turned into an empty invoice", async () => {
  stubStorage({ [V1_DRAFT]: { kind: "gst", number: "001" } });
  const { listInvoices } = await import("./storage.ts");
  assert.equal(listInvoices().length, 0);
});

test("migrated invoices are not claimed as sent", async () => {
  stubStorage({ [V1_SAVED]: [{ id: "x", savedAt: "2026-09-10T10:00:00Z", invoice: v1Invoice("001", "Coltec") }] });
  const { listInvoices } = await import("./storage.ts");
  assert.equal(listInvoices()[0].exportedAt, null);
});

test("a stored invoice with the old default phone number picks up the new one", async () => {
  stubStorage({ [V1_DRAFT]: v1Invoice("001", "Coltec", { seller: { name: "CUBIXSO", phone: "+91 92469 01689" } }) });
  const { listInvoices } = await import("./storage.ts");
  assert.equal(listInvoices()[0].invoice.seller.phone, "+91 83745 63012");
});

test("a phone number the user typed themselves is kept", async () => {
  stubStorage({ [V1_DRAFT]: v1Invoice("001", "Coltec", { seller: { phone: "+91 99999 00000" } }) });
  const { listInvoices } = await import("./storage.ts");
  assert.equal(listInvoices()[0].invoice.seller.phone, "+91 99999 00000");
});

test("an old invoice with no seal setting gets the seal", async () => {
  stubStorage({ [V1_DRAFT]: v1Invoice("001", "Coltec", { signatureImage: null }) });
  const { listInvoices } = await import("./storage.ts");
  assert.equal(listInvoices()[0].invoice.showStamp, true);
});

test("a new invoice takes the next number and carries the business details forward", async () => {
  const { createInvoice, saveInvoiceContent } = await import("./storage.ts");
  const first = createInvoice("gst");
  assert.equal(first.invoice.number, "001");
  saveInvoiceContent(first.id, { ...first.invoice, bank: { ...first.invoice.bank, upi: "cubixso@axis" } });
  const second = createInvoice("non-gst");
  assert.equal(second.invoice.number, "002");
  assert.equal(second.invoice.bank.upi, "cubixso@axis", "bank details follow from the last invoice");
  assert.equal(second.invoice.buyer.name, "", "the client does not");
});

test("editing an invoice moves it to the top of the list", async () => {
  const { createInvoice, saveInvoiceContent, listInvoices } = await import("./storage.ts");
  const a = createInvoice("gst");
  const b = createInvoice("gst");
  assert.equal(listInvoices()[0].id, b.id);
  await new Promise((r) => setTimeout(r, 5));
  saveInvoiceContent(a.id, { ...a.invoice, notes: "edited" });
  assert.equal(listInvoices()[0].id, a.id);
});

test("duplicating gives a new draft under the next number", async () => {
  const { createInvoice, duplicateInvoice, markExported, getInvoice } = await import("./storage.ts");
  const a = createInvoice("gst");
  markExported(a.id);
  const copy = duplicateInvoice(a.id)!;
  assert.notEqual(copy.id, a.id);
  assert.equal(copy.invoice.number, "002");
  assert.equal(copy.exportedAt, null, "a copy has not been sent");
  assert.ok(getInvoice(a.id)?.exportedAt, "the original keeps its sent date");
});

test("deleting removes only that invoice", async () => {
  const { createInvoice, deleteInvoice, listInvoices } = await import("./storage.ts");
  const a = createInvoice("gst");
  const b = createInvoice("gst");
  deleteInvoice(a.id);
  assert.deepEqual(listInvoices().map((r) => r.id), [b.id]);
});

test("receipts are numbered in their own series", async () => {
  const { createInvoice } = await import("./storage.ts");
  assert.equal(createInvoice("receipt").invoice.number, "R-001");
  assert.equal(createInvoice("receipt").invoice.number, "R-002");
});

test("receipts never take or move on an invoice number, and invoices never move receipts", async () => {
  const { createInvoice, nextInvoiceNumber, nextReceiptNumber, listInvoices } = await import("./storage.ts");
  createInvoice("gst");
  createInvoice("non-gst");
  assert.equal(nextInvoiceNumber(listInvoices()), "003");
  createInvoice("receipt");
  createInvoice("receipt");
  assert.equal(nextInvoiceNumber(listInvoices()), "003", "receipts leave the invoice series alone");
  assert.equal(createInvoice("gst").invoice.number, "003");
  assert.equal(nextReceiptNumber(listInvoices()), "R-003", "invoices leave the receipt series alone");
});

test("a receipt issued for an invoice is prefilled from it, net of earlier receipts", async () => {
  const { createInvoice, createReceiptFor, saveInvoiceContent, getInvoice } = await import("./storage.ts");
  const inv = createInvoice("gst");
  // Invoice #003 (COLTEC): two panels at ₹1,10,000 plus 18% GST is ₹2,59,600.
  saveInvoiceContent(inv.id, {
    ...inv.invoice,
    number: "003",
    buyer: { ...inv.invoice.buyer, name: "Coltec India Private Limited", state: "Telangana" },
    signatoryName: "A. Signatory",
    items: [{ ...inv.invoice.items[0], description: "Panel", quantity: 2, unitPriceMinor: 110_000_00, taxRatePercent: 18 }],
  });

  const first = createReceiptFor(inv.id)!;
  const r1 = first.invoice;
  assert.equal(r1.kind, "receipt");
  assert.equal(r1.number, "R-001");
  assert.equal(r1.buyer.name, "Coltec India Private Limited");
  assert.equal(r1.signatoryName, "A. Signatory");
  assert.equal(r1.currencyCode, "INR");
  assert.equal(r1.receipt?.againstInvoice, "003");
  assert.equal(r1.receipt?.invoiceTotalMinor, 259_600_00);
  assert.equal(r1.receipt?.receivedEarlierMinor, 0);
  assert.equal(r1.receipt?.amountMinor, 259_600_00, "the whole balance, to be edited down for a tranche");
  assert.equal(r1.receipt?.mode, "bank-transfer");

  saveInvoiceContent(first.id, { ...r1, receipt: { ...r1.receipt!, amountMinor: 100_000_00 } });
  // A receipt in another currency, or against another invoice, is not counted.
  const stray = createInvoice("receipt");
  saveInvoiceContent(stray.id, { ...stray.invoice, currencyCode: "USD", receipt: { ...stray.invoice.receipt!, againstInvoice: "003", amountMinor: 500_00 } });
  const other = createInvoice("receipt");
  saveInvoiceContent(other.id, { ...other.invoice, receipt: { ...other.invoice.receipt!, againstInvoice: "004", amountMinor: 700_00 } });

  const second = createReceiptFor(inv.id)!.invoice;
  assert.equal(second.number, "R-004");
  assert.equal(second.receipt?.receivedEarlierMinor, 100_000_00);
  assert.equal(second.receipt?.amountMinor, 159_600_00);
  assert.equal(getInvoice(inv.id)?.invoice.number, "003", "the invoice is untouched");
  assert.equal(createReceiptFor(first.id), null, "a receipt takes no receipt");
});

test("the remaining balance on a receipt is never negative", async () => {
  const { createInvoice, createReceiptFor, saveInvoiceContent } = await import("./storage.ts");
  const inv = createInvoice("non-gst");
  saveInvoiceContent(inv.id, { ...inv.invoice, items: [{ ...inv.invoice.items[0], unitPriceMinor: 1_000_00 }] });
  const r = createReceiptFor(inv.id)!;
  saveInvoiceContent(r.id, { ...r.invoice, receipt: { ...r.invoice.receipt!, amountMinor: 1_500_00 } });
  assert.equal(createReceiptFor(inv.id)!.invoice.receipt?.amountMinor, 0);
});

test("duplicating a receipt stays in the receipt series", async () => {
  const { createInvoice, duplicateInvoice, nextInvoiceNumber, listInvoices } = await import("./storage.ts");
  createInvoice("gst");
  const r = createInvoice("receipt");
  const copy = duplicateInvoice(r.id)!;
  assert.equal(copy.invoice.kind, "receipt");
  assert.equal(copy.invoice.number, "R-002");
  assert.equal(nextInvoiceNumber(listInvoices()), "002");
  const invCopy = duplicateInvoice(listInvoices().find((x) => x.invoice.kind === "gst")!.id)!;
  assert.equal(invCopy.invoice.number, "002", "duplicating an invoice still takes the next invoice number");
});

test("an invoice stored before receipts existed has no receipt details", async () => {
  stubStorage({ [RECORDS_KEY]: [{ id: "a", invoice: v1Invoice("001", "Coltec"), createdAt: "2026-09-10T10:00:00Z", updatedAt: "2026-09-10T10:00:00Z" }] });
  const { listInvoices } = await import("./storage.ts");
  const [r] = listInvoices();
  assert.equal(r.invoice.kind, "gst");
  assert.equal(r.invoice.receipt, undefined);
});
