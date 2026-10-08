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
  const { createInvoice, createReceiptFor, saveInvoiceContent, getInvoice, markExported } = await import("./storage.ts");
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
  markExported(first.id);
  // A receipt in another currency, or against another invoice, is not counted.
  const stray = createInvoice("receipt");
  saveInvoiceContent(stray.id, { ...stray.invoice, currencyCode: "USD", receipt: { ...stray.invoice.receipt!, againstInvoice: "003", amountMinor: 500_00 } });
  const other = createInvoice("receipt");
  saveInvoiceContent(other.id, { ...other.invoice, receipt: { ...other.invoice.receipt!, againstInvoice: "004", amountMinor: 700_00 } });
  markExported(stray.id);
  markExported(other.id);

  const second = createReceiptFor(inv.id)!.invoice;
  assert.equal(second.number, "R-004");
  assert.equal(second.receipt?.receivedEarlierMinor, 100_000_00);
  assert.equal(second.receipt?.amountMinor, 159_600_00);
  assert.equal(getInvoice(inv.id)?.invoice.number, "003", "the invoice is untouched");
  assert.equal(createReceiptFor(first.id), null, "a receipt takes no receipt");
});

test("the remaining balance on a receipt is never negative", async () => {
  const { createInvoice, createReceiptFor, saveInvoiceContent, markExported } = await import("./storage.ts");
  const inv = createInvoice("non-gst");
  saveInvoiceContent(inv.id, { ...inv.invoice, items: [{ ...inv.invoice.items[0], unitPriceMinor: 1_000_00 }] });
  const r = createReceiptFor(inv.id)!;
  saveInvoiceContent(r.id, { ...r.invoice, receipt: { ...r.invoice.receipt!, amountMinor: 1_500_00 } });
  markExported(r.id);
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

/** An invoice numbered `number` for a flat `minor`, no tax, saved and returned. */
async function billed(number: string, minor: number, currencyCode = "INR") {
  const { createInvoice, saveInvoiceContent, getInvoice } = await import("./storage.ts");
  const inv = createInvoice("non-gst");
  saveInvoiceContent(inv.id, { ...inv.invoice, number, currencyCode, items: [{ ...inv.invoice.items[0], unitPriceMinor: minor, taxRatePercent: 0 }] });
  return getInvoice(inv.id)!;
}

/** A receipt typed by hand: no link, just a number. */
async function typedReceipt(againstInvoice: string, amountMinor: number, currencyCode = "INR") {
  const { createInvoice, saveInvoiceContent, markExported, getInvoice } = await import("./storage.ts");
  const r = createInvoice("receipt");
  saveInvoiceContent(r.id, { ...r.invoice, currencyCode, receipt: { ...r.invoice.receipt!, againstInvoice, amountMinor } });
  markExported(r.id);
  return getInvoice(r.id)!;
}

const ref = (r: { id: string; invoice: { number: string; currencyCode: string } }) => ({
  id: r.id,
  number: r.invoice.number,
  currencyCode: r.invoice.currencyCode,
});

test("a receipt left by a deleted invoice does not attach to a new invoice that reuses its number", async () => {
  const { createReceiptFor, markExported, deleteInvoice, listInvoices, receivedTowards } = await import("./storage.ts");
  await billed("001", 1_000_00);
  const old = await billed("002", 1_000_00);
  const r1 = createReceiptFor(old.id)!;
  assert.equal(r1.invoice.receipt?.againstInvoiceId, old.id, "issuing links the receipt to the invoice");
  markExported(r1.id);
  assert.equal(receivedTowards(listInvoices(), ref(old)), 1_000_00);

  deleteInvoice(old.id);
  const reused = await billed("002", 5_000_00);
  assert.equal(receivedTowards(listInvoices(), ref(reused)), 0, "the new 002 is not paid by the old 002's receipt");
  const fresh = createReceiptFor(reused.id)!.invoice.receipt!;
  assert.equal(fresh.receivedEarlierMinor, 0);
  assert.equal(fresh.amountMinor, 5_000_00, "the prefill is the new invoice's whole total");
});

test("a typed receipt matches by number, ignoring case and spaces, in the same currency only", async () => {
  const { listInvoices, receivedTowards, receiptIsTowards } = await import("./storage.ts");
  const inv = await billed("CBX-007", 10_000_00);
  await typedReceipt("  cbx-007 ", 1_000_00);
  await typedReceipt("CBX-007", 500_00, "USD");
  await typedReceipt("CBX-0070", 300_00);
  assert.equal(receivedTowards(listInvoices(), ref(inv)), 1_000_00);

  // A linked receipt answers to its id alone, whatever number it shows.
  const linked = { ...(await typedReceipt("CBX-007", 0)).invoice };
  linked.receipt = { ...linked.receipt!, againstInvoiceId: "some-other-id" };
  assert.equal(receiptIsTowards(linked, ref(inv)), false);
  linked.receipt = { ...linked.receipt, againstInvoiceId: inv.id, againstInvoice: "something else" };
  assert.equal(receiptIsTowards(linked, ref(inv)), true);
});

test("an old receipt stored without a link still matches by number", async () => {
  const { listInvoices, receivedTowards } = await import("./storage.ts");
  const inv = await billed("003", 1_000_00);
  const records = listInvoices();
  const legacy = {
    id: "legacy",
    invoice: { ...records[0].invoice, kind: "receipt", number: "R-001", receipt: { amountMinor: 400_00, mode: "upi", reference: "", purpose: "", againstInvoice: "003", invoiceTotalMinor: null, receivedEarlierMinor: 0 } },
    createdAt: "2026-09-10T10:00:00Z",
    updatedAt: "2026-09-10T10:00:00Z",
    exportedAt: "2026-09-10T10:00:00Z",
  };
  store.set(RECORDS_KEY, JSON.stringify([...records, legacy]));
  const all = listInvoices();
  assert.equal(all.find((r) => r.id === "legacy")?.invoice.receipt?.againstInvoiceId, null);
  assert.equal(receivedTowards(all, ref(inv)), 400_00);
});

test("retyping a linked receipt's invoice number to another drops the link", async () => {
  const { retypeAgainstInvoice, blankReceipt } = await import("./defaults.ts");
  const linked = { ...blankReceipt(), againstInvoice: "002", againstInvoiceId: "inv-1" };
  assert.equal(retypeAgainstInvoice(linked, " 002 ", "002").againstInvoiceId, "inv-1", "the same number keeps it");
  assert.equal(retypeAgainstInvoice(linked, "003", "002").againstInvoiceId, null);
  assert.equal(retypeAgainstInvoice(linked, "003", "002").againstInvoice, "003");
  assert.equal(retypeAgainstInvoice(linked, "002", null).againstInvoiceId, null, "a deleted invoice keeps no link");
});

test("a receipt counts as received only once it has been downloaded", async () => {
  const { createReceiptFor, markExported, listInvoices, receivedTowards, countsAsReceived } = await import("./storage.ts");
  const inv = await billed("004", 1_000_00);
  const r = createReceiptFor(inv.id)!;
  assert.equal(countsAsReceived(r), false);
  assert.equal(receivedTowards(listInvoices(), ref(inv)), 0, "a draft receipt marks nothing paid");
  assert.equal(createReceiptFor(inv.id)!.invoice.receipt?.receivedEarlierMinor, 0, "nor does it reduce the next prefill");

  markExported(r.id);
  const issued = listInvoices().find((x) => x.id === r.id)!;
  assert.equal(countsAsReceived(issued), true);
  assert.equal(receivedTowards(listInvoices(), ref(inv)), 1_000_00);
  assert.equal(createReceiptFor(inv.id)!.invoice.receipt?.amountMinor, 0, "the next prefill is net of it");
});

test("a negative amount stored on a receipt reads back as zero", async () => {
  const { receiptOf, blankReceipt } = await import("./defaults.ts");
  const r = receiptOf({ receipt: { ...blankReceipt(), amountMinor: -5000_00, receivedEarlierMinor: -1, invoiceTotalMinor: -10 } });
  assert.equal(r.amountMinor, 0);
  assert.equal(r.receivedEarlierMinor, 0);
  assert.equal(r.invoiceTotalMinor, null, "a total that is not positive reads as not given");
});

test("a receipt renamed outside the R- series does not pull the series off its prefix", async () => {
  const { createInvoice, saveInvoiceContent, nextInvoiceNumber, nextReceiptNumber, listInvoices } = await import("./storage.ts");
  createInvoice("gst");
  createInvoice("gst");
  const r = createInvoice("receipt");
  createInvoice("receipt");
  saveInvoiceContent(r.id, { ...r.invoice, number: "900" });
  assert.equal(nextReceiptNumber(listInvoices()), "R-003");
  assert.equal(nextInvoiceNumber(listInvoices()), "003", "the invoice series is unchanged");
  assert.equal(createInvoice("receipt").invoice.number, "R-003");
});

test("a receipt series with no R- numbers starts at R-001, and keeps counting past R-999", async () => {
  const { createInvoice, saveInvoiceContent, nextReceiptNumber, listInvoices } = await import("./storage.ts");
  const r = createInvoice("receipt");
  saveInvoiceContent(r.id, { ...r.invoice, number: "Advance" });
  assert.equal(nextReceiptNumber(listInvoices()), "R-001");
  saveInvoiceContent(r.id, { ...r.invoice, number: "r-999" });
  assert.equal(nextReceiptNumber(listInvoices()), "R-1000");
});

test("duplicating a receipt is the next payment: today, no reference, a draft", async () => {
  const { createReceiptFor, duplicateInvoice, saveInvoiceContent, markExported, getInvoice } = await import("./storage.ts");
  const { today } = await import("./defaults.ts");
  const inv = await billed("005", 3_000_00);
  const src = createReceiptFor(inv.id)!;
  saveInvoiceContent(src.id, {
    ...src.invoice,
    issueDate: "2026-01-15",
    receipt: { ...src.invoice.receipt!, amountMinor: 1_000_00, reference: "UTR AXISN26281123456" },
  });

  const draftCopy = duplicateInvoice(src.id)!;
  assert.equal(draftCopy.invoice.receipt?.reference, "");
  assert.equal(draftCopy.invoice.issueDate, today());
  assert.equal(draftCopy.exportedAt, null);
  assert.equal(draftCopy.invoice.receipt?.againstInvoiceId, inv.id, "still towards the same invoice");
  assert.equal(draftCopy.invoice.receipt?.receivedEarlierMinor, 0, "an unissued source is not yet received");

  markExported(src.id);
  const copy = duplicateInvoice(src.id)!;
  assert.equal(copy.exportedAt, null);
  assert.equal(copy.invoice.receipt?.receivedEarlierMinor, 1_000_00, "an issued source counts as received earlier");
  assert.equal(getInvoice(src.id)?.invoice.receipt?.reference, "UTR AXISN26281123456", "the source is untouched");
});
