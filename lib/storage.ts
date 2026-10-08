"use client";

/**
 * Local persistence: every invoice you have made, kept in this browser.
 *
 * Nothing is sent anywhere. Invoices carry client names, bank account numbers
 * and GSTINs; keeping them on the machine that typed them means no server to
 * secure and nothing to leak. The trade, no sync between devices, is the right
 * one for a tool one person uses to bill their own clients.
 *
 * The store is a flat list of records, one per invoice, each with its own id.
 * The editor writes to its record as you type, so there is no save step: the
 * home screen always shows what you left.
 *
 * Reads are defensive. A record written by an older version of the app is
 * merged over the current defaults, so adding a field never leaves an old
 * invoice with `undefined` where a string is expected.
 */

import type { Invoice } from "./invoice-types";
import {
  CUBIXSO_SELLER,
  RETIRED_SELLER_PHONES,
  blankInvoice,
  newId,
  receiptOf,
  sameInvoiceNumber,
  today,
} from "./defaults";
import { computeTotals } from "./invoice-math";

const RECORDS_KEY = "cubixso.invoices.v2";

/** Earlier versions' keys: read once to migrate, and deliberately never deleted. */
const V1_DRAFT_KEY = "cubixso.invoice.draft.v1";
const V1_SAVED_KEY = "cubixso.invoice.saved.v1";

export interface InvoiceRecord {
  id: string;
  invoice: Invoice;
  createdAt: string;
  updatedAt: string;
  /** When it last left the app as a PDF, Word or HTML file. Null for a draft. */
  exportedAt: string | null;
}

/**
 * Fills gaps in a stored invoice from a fresh default, one level into the
 * nested party and bank objects. Deliberately not a deep merge: `items` is an
 * array that must be taken whole, and merging it element-wise would resurrect
 * lines the user deleted.
 */
function reconcile(stored: unknown): Invoice {
  const base = blankInvoice();
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Partial<Invoice>;
  return {
    ...base,
    ...s,
    seller: migrateSeller({ ...base.seller, ...(s.seller ?? {}) }),
    buyer: { ...base.buyer, ...(s.buyer ?? {}) },
    bank: { ...base.bank, ...(s.bank ?? {}) },
    items: Array.isArray(s.items) && s.items.length > 0 ? s.items : base.items,
    // Only a receipt carries receipt details, filled out to the current shape.
    receipt: s.kind === "receipt" ? receiptOf(s) : undefined,
  };
}

/**
 * Brings a stored seller up to date with defaults that have been corrected.
 *
 * A stored invoice wins over defaults, which is right for anything the user
 * typed and wrong for values they merely inherited: those would otherwise stay
 * stale forever, invisibly, on every invoice. This is the lesson of the
 * signature that never appeared: an old draft's inherited `null` kept
 * overriding it.
 */
function migrateSeller(seller: Invoice["seller"]): Invoice["seller"] {
  if (RETIRED_SELLER_PHONES.includes(seller.phone)) {
    return { ...seller, phone: CUBIXSO_SELLER.phone };
  }
  return seller;
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(records: InvoiceRecord[]): void {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Quota exceeded, or storage disabled in a private window. The app still
    // works for this session; losing persistence is not worth interrupting over.
  }
}

/** A draft is worth keeping once anything in it is the user's own work. */
function hasContent(inv: Invoice): boolean {
  return (
    inv.buyer.name.trim() !== "" ||
    inv.notes.trim() !== "" ||
    inv.items.some((i) => i.description.trim() !== "" || i.unitPriceMinor !== 0)
  );
}

const sameInvoice = (a: Invoice, b: Invoice) => a.kind === b.kind && a.number.trim() === b.number.trim();

/**
 * Builds the record list from the previous version's storage: a single
 * working draft plus a list of saved invoices.
 *
 * Nothing is marked as sent, because the old store cannot say what was: early
 * versions saved to history on a Save button, later ones on download. A draft
 * with the same number and type as a saved invoice is the newer edit of that
 * invoice, so it replaces the saved copy's contents rather than duplicating it.
 */
export function migrateFromV1(savedRaw: unknown, draftRaw: unknown, now: string): InvoiceRecord[] {
  const records: InvoiceRecord[] = [];
  if (Array.isArray(savedRaw)) {
    for (const e of savedRaw) {
      if (!e || typeof e !== "object" || !("invoice" in e)) continue;
      const at = typeof e.savedAt === "string" ? e.savedAt : now;
      records.push({ id: newId(), invoice: reconcile(e.invoice), createdAt: at, updatedAt: at, exportedAt: null });
    }
  }
  if (draftRaw && typeof draftRaw === "object") {
    const draft = reconcile(draftRaw);
    const match = records.find((r) => sameInvoice(r.invoice, draft));
    if (match) {
      match.invoice = draft;
      match.updatedAt = now;
    } else if (hasContent(draft)) {
      records.push({ id: newId(), invoice: draft, createdAt: now, updatedAt: now, exportedAt: null });
    }
  }
  return records;
}

const byRecent = (a: InvoiceRecord, b: InvoiceRecord) => b.updatedAt.localeCompare(a.updatedAt);

/** Every invoice, most recently edited first. Migrates older storage on first use. */
export function listInvoices(): InvoiceRecord[] {
  if (typeof window === "undefined") return [];
  const stored = readJson(RECORDS_KEY);
  if (!Array.isArray(stored)) {
    const migrated = migrateFromV1(readJson(V1_SAVED_KEY), readJson(V1_DRAFT_KEY), new Date().toISOString());
    write(migrated);
    return migrated.sort(byRecent);
  }
  return stored
    .filter((r): r is InvoiceRecord => !!r && typeof r === "object" && typeof r.id === "string")
    .map((r) => ({ ...r, invoice: reconcile(r.invoice), exportedAt: r.exportedAt ?? null }))
    .sort(byRecent);
}

export function getInvoice(id: string): InvoiceRecord | null {
  return listInvoices().find((r) => r.id === id) ?? null;
}

/** Writes an invoice's latest contents to its record. */
export function saveInvoiceContent(id: string, invoice: Invoice): InvoiceRecord[] {
  const now = new Date().toISOString();
  const next = listInvoices().map((r) => (r.id === id ? { ...r, invoice, updatedAt: now } : r));
  write(next);
  return next.sort(byRecent);
}

export function markExported(id: string): InvoiceRecord[] {
  const now = new Date().toISOString();
  const next = listInvoices().map((r) => (r.id === id ? { ...r, exportedAt: now } : r));
  write(next);
  return next;
}

export function deleteInvoice(id: string): InvoiceRecord[] {
  const next = listInvoices().filter((r) => r.id !== id);
  write(next);
  return next;
}

/** Puts a deleted record back exactly as it was: the Undo after a delete. */
export function restoreInvoice(record: InvoiceRecord): InvoiceRecord[] {
  const next = [record, ...listInvoices().filter((r) => r.id !== record.id)].sort(byRecent);
  write(next);
  return next;
}

/**
 * Starts a new invoice, or a new receipt. What belongs to the business rather
 * than the client (who bills, from where, into which account, how it is
 * signed) carries over from the most recent document; the number follows on
 * from the highest in its own series.
 */
export function createInvoice(kind: Invoice["kind"]): InvoiceRecord {
  const records = listInvoices();
  const last = records[0]?.invoice;
  const fresh = blankInvoice(kind);
  const invoice: Invoice = {
    ...fresh,
    number: nextNumberFor(kind, records),
    ...(last
      ? {
          seller: last.seller,
          bank: last.bank,
          terms: last.terms,
          accent: last.accent,
          signatoryName: last.signatoryName,
          signatureImage: last.signatureImage,
          showStamp: last.showStamp,
        }
      : {}),
  };
  const now = new Date().toISOString();
  const record: InvoiceRecord = { id: newId(), invoice, createdAt: now, updatedAt: now, exportedAt: null };
  write([record, ...records]);
  return record;
}

/**
 * A copy under the next number in its own series, as a fresh draft: the usual
 * start for a repeat bill, or for the next tranche of a payment.
 *
 * A receipt's copy is the next payment, not the same one again: it is dated
 * today and loses the reference, which identified the earlier transfer. It
 * counts what has been received so far, its source included once that was
 * issued, so its balance stays true; an unissued source is not yet money in.
 */
export function duplicateInvoice(id: string): InvoiceRecord | null {
  const records = listInvoices();
  const source = records.find((r) => r.id === id);
  if (!source) return null;
  const src = source.invoice;
  const now = new Date().toISOString();
  const receipt = src.kind === "receipt" ? receiptOf(src) : undefined;
  const record: InvoiceRecord = {
    id: newId(),
    invoice: {
      ...src,
      number: nextNumberFor(src.kind, records),
      items: src.items.map((i) => ({ ...i, id: newId() })),
      ...(receipt
        ? {
            issueDate: today(),
            receipt: {
              ...receipt,
              reference: "",
              receivedEarlierMinor: receipt.againstInvoice.trim()
                ? receivedTowards(records, invoiceFor(records, receipt, src.currencyCode))
                : receipt.receivedEarlierMinor,
            },
          }
        : {}),
    },
    createdAt: now,
    updatedAt: now,
    exportedAt: null,
  };
  write([record, ...records]);
  return record;
}

/**
 * Issues a receipt for an invoice: a new receipt for the same client, in the
 * same currency, signed and branded the same way, against that invoice's
 * number and total, and linked to that invoice by id. The amount starts at
 * what is still owed after earlier receipts, which is right for a final
 * payment and is edited down for a part-payment. Only invoices take receipts;
 * a receipt for a receipt is null.
 */
export function createReceiptFor(invoiceId: string): InvoiceRecord | null {
  const records = listInvoices();
  const source = records.find((r) => r.id === invoiceId)?.invoice;
  if (!source || source.kind === "receipt") return null;
  const totalMinor = computeTotals(source).grandTotalMinor;
  const earlier = receivedTowards(records, { id: invoiceId, number: source.number, currencyCode: source.currencyCode });
  const fresh = blankInvoice("receipt");
  const invoice: Invoice = {
    ...fresh,
    number: nextReceiptNumber(records),
    currencyCode: source.currencyCode,
    seller: source.seller,
    buyer: source.buyer,
    bank: source.bank,
    terms: source.terms,
    accent: source.accent,
    showLogo: source.showLogo,
    showSignature: source.showSignature,
    showStamp: source.showStamp,
    signatoryName: source.signatoryName,
    signatureImage: source.signatureImage,
    receipt: {
      ...receiptOf(fresh),
      againstInvoice: source.number.trim(),
      againstInvoiceId: invoiceId,
      invoiceTotalMinor: totalMinor,
      receivedEarlierMinor: earlier,
      amountMinor: Math.max(0, totalMinor - earlier),
    },
  };
  const now = new Date().toISOString();
  const record: InvoiceRecord = { id: newId(), invoice, createdAt: now, updatedAt: now, exportedAt: null };
  write([record, ...records]);
  return record;
}

/**
 * Whether a receipt is money in. "Issue receipt" only starts a draft; the
 * payment is acknowledged when the receipt leaves the app, as an invoice is
 * sent when it does. Until then it marks nothing paid and adds to no total.
 */
export function countsAsReceived(record: InvoiceRecord): boolean {
  return record.invoice.kind === "receipt" && record.exportedAt !== null;
}

/** An invoice as receipts point at it. `id` is null for one no record holds. */
export interface InvoiceRef {
  id: string | null;
  number: string;
  currencyCode: string;
}

/**
 * Whether a receipt is towards an invoice. One issued from an invoice is tied
 * to that record and to no other, so a later invoice that reuses a deleted
 * one's number starts clean. One typed by hand names its invoice by number,
 * with case and outer spaces ignored. Either way the currency must match, for
 * the same reason the home screen never adds dollars to rupees.
 */
export function receiptIsTowards(receipt: Invoice, target: InvoiceRef): boolean {
  if (receipt.kind !== "receipt" || receipt.currencyCode !== target.currencyCode) return false;
  const rc = receiptOf(receipt);
  if (rc.againstInvoiceId !== null) return rc.againstInvoiceId === target.id;
  return sameInvoiceNumber(rc.againstInvoice, target.number);
}

/** What has been received towards an invoice: its issued receipts, summed. */
export function receivedTowards(records: InvoiceRecord[], target: InvoiceRef): number {
  return records
    .filter((r) => countsAsReceived(r) && receiptIsTowards(r.invoice, target))
    .reduce((sum, r) => sum + receiptOf(r.invoice).amountMinor, 0);
}

/** The invoice a receipt points at, as a reference whether or not a record holds it. */
function invoiceFor(records: InvoiceRecord[], rc: ReturnType<typeof receiptOf>, currencyCode: string): InvoiceRef {
  if (rc.againstInvoiceId !== null) return { id: rc.againstInvoiceId, number: rc.againstInvoice, currencyCode };
  const typed: InvoiceRef = { id: null, number: rc.againstInvoice, currencyCode };
  const match = records.find(
    (r) => r.invoice.kind !== "receipt" && r.invoice.currencyCode === currencyCode && sameInvoiceNumber(r.invoice.number, typed.number),
  );
  return match ? { ...typed, id: match.id } : typed;
}

function nextNumberFor(kind: Invoice["kind"], records: InvoiceRecord[]): string {
  return kind === "receipt" ? nextReceiptNumber(records) : nextInvoiceNumber(records);
}

/**
 * The next invoice number: one more than the highest already used, keeping the
 * prefix and zero-padding the user established. "CBX-007" becomes "CBX-008";
 * "003" becomes "004".
 *
 * Receipts are left out entirely. GST requires the invoice series to run
 * without gaps, so a receipt must never take, or move on, an invoice number.
 * Tax invoices and invoices without GST still share the one series.
 */
export function nextInvoiceNumber(records: InvoiceRecord[]): string {
  return nextInSeries(records.filter((r) => r.invoice.kind !== "receipt"), "001");
}

/**
 * The next receipt number, in the receipts' own series: "R-001", "R-002", …
 *
 * Only numbers of that shape count. A receipt renamed "900" is the user's
 * business, but it must not pull the series off its prefix ("901"), where it
 * would look like an invoice number.
 */
export function nextReceiptNumber(records: InvoiceRecord[]): string {
  const top = records
    .filter((r) => r.invoice.kind === "receipt")
    .map((r) => /^R-(\d+)$/i.exec(r.invoice.number.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .reduce((max, m) => Math.max(max, Number(m[1])), 0);
  return `R-${String(top + 1).padStart(3, "0")}`;
}

function nextInSeries(records: InvoiceRecord[], first: string): string {
  const parsed = records
    .map((r) => /^(.*?)(\d+)$/.exec(r.invoice.number.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ prefix: m[1], digits: m[2], n: Number(m[2]) }))
    .filter((p) => Number.isFinite(p.n));
  if (parsed.length === 0) return first;
  const top = parsed.reduce((a, b) => (b.n > a.n ? b : a));
  return `${top.prefix}${String(top.n + 1).padStart(top.digits.length, "0")}`;
}
