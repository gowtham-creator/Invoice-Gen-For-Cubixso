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
