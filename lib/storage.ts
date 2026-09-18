"use client";

/**
 * Local persistence.
 *
 * Everything lives in localStorage and nothing is sent anywhere. Invoices carry
 * client names, bank account numbers and GSTINs; keeping them on the machine
 * that typed them means there is no server to secure, no account to create, and
 * nothing to leak. The trade — no sync between devices — is the right one for a
 * tool one person uses to bill their own clients.
 *
 * Reads are defensive. A draft saved by an older version of the app is merged
 * over the current defaults rather than used as-is, so adding a field to the
 * model never leaves an existing draft with `undefined` where a string is
 * expected.
 */

import type { Invoice } from "./invoice-types";
import { blankInvoice } from "./defaults";

const DRAFT_KEY = "cubixso.invoice.draft.v1";
const SAVED_KEY = "cubixso.invoice.saved.v1";

export interface SavedInvoice {
  id: string;
  savedAt: string;
  invoice: Invoice;
}

/**
 * Fills gaps in a stored object from a fresh default, one level into the nested
 * party and bank objects. Deliberately not a deep merge: `items` is an array
 * that must be taken wholesale, and merging it element-wise would resurrect
 * lines the user deleted.
 */
function reconcile(stored: unknown): Invoice {
  const base = blankInvoice();
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Partial<Invoice>;

  return {
    ...base,
    ...s,
    seller: { ...base.seller, ...(s.seller ?? {}) },
    buyer: { ...base.buyer, ...(s.buyer ?? {}) },
    bank: { ...base.bank, ...(s.bank ?? {}) },
    items: Array.isArray(s.items) && s.items.length > 0 ? s.items : base.items,
  };
}

export function loadDraft(): Invoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? reconcile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveDraft(invoice: Invoice): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(invoice));
  } catch {
    // Quota exceeded, or storage disabled in a private window. The app still
    // works for this session; losing autosave is not worth interrupting over.
  }
}

export function listSaved(): SavedInvoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is SavedInvoice => !!e && typeof e === "object" && "id" in e)
      .map((e) => ({ ...e, invoice: reconcile(e.invoice) }));
  } catch {
    return [];
  }
}

/**
 * Saves under the invoice number, so re-saving a document the user is still
 * editing updates it rather than piling up near-identical copies.
 */
export function saveInvoice(invoice: Invoice): SavedInvoice[] {
  const id = `${invoice.kind}-${invoice.number || "draft"}`;
  const entry: SavedInvoice = { id, savedAt: new Date().toISOString(), invoice };
  const next = [entry, ...listSaved().filter((e) => e.id !== id)];
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    /* see saveDraft */
  }
  return next;
}

export function deleteSaved(id: string): SavedInvoice[] {
  const next = listSaved().filter((e) => e.id !== id);
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    /* see saveDraft */
  }
  return next;
}

/**
 * Suggests the next invoice number by incrementing the highest one already
 * saved, preserving whatever zero-padding and prefix the user established.
 * "CBX-007" becomes "CBX-008"; "003" becomes "004".
 */
export function nextInvoiceNumber(saved: SavedInvoice[]): string {
  const parsed = saved
    .map((e) => /^(.*?)(\d+)$/.exec(e.invoice.number.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ prefix: m[1], digits: m[2], n: Number(m[2]) }))
    .filter((p) => Number.isFinite(p.n));

  if (parsed.length === 0) return "001";
  const top = parsed.reduce((a, b) => (b.n > a.n ? b : a));
  return `${top.prefix}${String(top.n + 1).padStart(top.digits.length, "0")}`;
}
