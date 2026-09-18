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
import { CUBIXSO_SELLER, RETIRED_SELLER_PHONES, blankInvoice, newId } from "./defaults";

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
 * Starts a new invoice. What belongs to the business rather than the client
 * (who bills, from where, into which account, how it is signed) carries over
 * from the most recent invoice; the number follows on from the highest.
 */
export function createInvoice(kind: Invoice["kind"]): InvoiceRecord {
  const records = listInvoices();
  const last = records[0]?.invoice;
  const fresh = blankInvoice(kind);
  const invoice: Invoice = {
    ...fresh,
    number: nextInvoiceNumber(records),
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

/** A copy under the next number, as a fresh draft: the usual start for a repeat bill. */
export function duplicateInvoice(id: string): InvoiceRecord | null {
  const records = listInvoices();
  const source = records.find((r) => r.id === id);
  if (!source) return null;
  const now = new Date().toISOString();
  const record: InvoiceRecord = {
    id: newId(),
    invoice: {
      ...source.invoice,
      number: nextInvoiceNumber(records),
      items: source.invoice.items.map((i) => ({ ...i, id: newId() })),
    },
    createdAt: now,
    updatedAt: now,
    exportedAt: null,
  };
  write([record, ...records]);
  return record;
}

/**
 * The next invoice number: one more than the highest already used, keeping the
 * prefix and zero-padding the user established. "CBX-007" becomes "CBX-008";
 * "003" becomes "004".
 */
export function nextInvoiceNumber(records: InvoiceRecord[]): string {
  const parsed = records
    .map((r) => /^(.*?)(\d+)$/.exec(r.invoice.number.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ prefix: m[1], digits: m[2], n: Number(m[2]) }))
    .filter((p) => Number.isFinite(p.n));
  if (parsed.length === 0) return "001";
  const top = parsed.reduce((a, b) => (b.n > a.n ? b : a));
  return `${top.prefix}${String(top.n + 1).padStart(top.digits.length, "0")}`;
}
