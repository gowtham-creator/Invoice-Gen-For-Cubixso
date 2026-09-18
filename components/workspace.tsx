"use client";

/**
 * The workspace: the whole application, rendered only in the browser.
 *
 * Two panes: the editor on the left, the invoice on the right, sitting on the
 * desk as the sheet of paper it will become. Every control has a visible
 * consequence on the sheet, so there is no preview step and no save-then-check
 * loop. On a narrow screen the panes become tabs rather than stacking, because
 * a preview scrolled two screens below its controls is one nobody looks at.
 *
 * The primary action is Download. Downloading is also what files an invoice
 * under "Your invoices": the invoices worth keeping are the ones that went out.
 * The draft in progress autosaves regardless.
 *
 * The invoice object lives here and flows down; children never hold document
 * state, which keeps autosave, history and "new invoice" one-line operations.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Check, Download, FilePlus2, FileText, Loader2, Trash2, X } from "lucide-react";
import type { Invoice } from "@/lib/invoice-types";
import { blankInvoice } from "@/lib/defaults";
import { computeTotals } from "@/lib/invoice-math";
import { currencyOf, formatMoney } from "@/lib/currency";
import {
  deleteSaved, listSaved, loadDraft, nextInvoiceNumber, saveDraft, saveInvoice,
  type SavedInvoice,
} from "@/lib/storage";
import { Editor } from "@/components/editor";
import { Button, Segmented } from "@/components/controls";

/**
 * The PDF engine is browser-only: it needs canvas and font APIs that do not
 * exist during server rendering. Loading it lazily also keeps it out of the
 * first paint, so the editor is usable before the renderer arrives.
 */
const Preview = dynamic(() => import("@/components/preview").then((m) => m.Preview), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 size={18} className="animate-spin text-ink-3" />
    </div>
  ),
});

type Pane = "edit" | "preview";

export default function Workspace() {
  // Read straight from localStorage: this component only ever renders in the
  // browser (see app/page.tsx), so the draft is there before the first paint.
  // Restoring it in an effect instead drew a blank invoice, rendered its PDF,
  // then swapped the draft in and rendered again.
  const [invoice, setInvoice] = useState<Invoice>(() => loadDraft() ?? blankInvoice());
  const [saved, setSaved] = useState<SavedInvoice[]>(() => listSaved());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pane, setPane] = useState<Pane>("edit");
  const [pdf, setPdf] = useState<{ url: string | null; stale: boolean }>({ url: null, stale: true });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveDraft(invoice);
  }, [invoice]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const set = useCallback((patch: Partial<Invoice>) => {
    setInvoice((prev) => ({ ...prev, ...patch }));
  }, []);

  const onPdfReady = useCallback((url: string | null, stale: boolean) => setPdf({ url, stale }), []);

  const totals = useMemo(() => computeTotals(invoice), [invoice]);
  const currency = currencyOf(invoice.currencyCode);
  const isGst = invoice.kind === "gst";

  const filename = `${isGst ? "Tax-Invoice" : "Invoice"}-${invoice.number || "draft"}${
    invoice.buyer.name ? `-${invoice.buyer.name.trim().replace(/[^\w-]+/g, "-")}` : ""
  }.pdf`;

  const onDownload = () => {
    setSaved(saveInvoice(invoice));
    setToast(`Invoice ${invoice.number || ""} saved to your invoices`);
  };

  const onNew = () => {
    const fresh = blankInvoice(invoice.kind);
    // Carry forward what belongs to the business rather than the client: who
    // is billing, from where, into which account, and how it is signed.
    setInvoice({
      ...fresh,
      number: nextInvoiceNumber(saved),
      seller: invoice.seller,
      bank: invoice.bank,
      terms: invoice.terms,
      accent: invoice.accent,
      signatoryName: invoice.signatoryName,
      signatureImage: invoice.signatureImage,
      showStamp: invoice.showStamp,
    });
    setPane("edit");
  };

  const ready = !!pdf.url && !pdf.stale;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-canvas px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cubixso-logo.png" alt="Cubixso" width={22} height={22} className="shrink-0" />
          <span className="text-[13px] font-semibold text-ink">Invoices</span>
          <span className="text-ink-3" aria-hidden>
            /
          </span>
          <span className="truncate text-[13px] text-ink-2">
            <span className="tnum">No. {invoice.number || "—"}</span>
            {invoice.buyer.name ? <span className="hidden sm:inline"> · {invoice.buyer.name}</span> : null}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" onClick={() => setHistoryOpen(true)} title="Your invoices">
            <FileText size={15} />
            <span className="hidden sm:inline">Your invoices</span>
            {saved.length ? (
              <span className="tnum rounded-full bg-well px-1.5 text-[11px] text-ink-2">{saved.length}</span>
            ) : null}
          </Button>
          <Button onClick={onNew} title="Start a new invoice">
            <FilePlus2 size={15} />
            <span className="hidden sm:inline">New</span>
          </Button>
          {ready ? (
            <a
              href={pdf.url ?? undefined}
              download={filename}
              onClick={onDownload}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.15)] transition-[background-color,transform] duration-150 hover:bg-accent-strong active:translate-y-px"
            >
              <Download size={15} />
              Download PDF
            </a>
          ) : (
            // Disabled while the file on hand is out of date, so a download
            // straight after an edit can never carry the previous figures.
            <span
              aria-disabled
              className="inline-flex h-8 cursor-wait items-center gap-1.5 rounded-md bg-accent/55 px-3 text-[13px] font-medium text-white"
            >
              <Loader2 size={15} className="animate-spin" />
              Download PDF
            </span>
          )}
        </div>
      </header>

      {/* Pane switch, narrow screens only. */}
      <div className="shrink-0 border-b border-line bg-canvas px-4 py-2 lg:hidden">
        <Segmented
          value={pane}
          onChange={setPane}
          options={[
            { value: "edit", label: "Edit" },
            { value: "preview", label: "Preview" },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`min-h-0 w-full shrink-0 flex-col border-r border-line bg-canvas lg:flex lg:w-[440px] ${
            pane === "edit" ? "flex" : "hidden"
          }`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Editor invoice={invoice} set={set} />
          </div>

          {/* The total, always in view while editing. */}
          <div className="flex shrink-0 items-end justify-between gap-4 border-t border-line bg-canvas px-5 py-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-ink-2">Total due</p>
              <p className="tnum truncate text-[12px] text-ink-3">
                {formatMoney(totals.taxableMinor, currency)}
                {totals.taxMinor > 0 ? ` + ${formatMoney(totals.taxMinor, currency)} GST` : isGst ? "" : " · no GST"}
              </p>
            </div>
            <p className="tnum shrink-0 text-[20px] font-semibold tracking-[-0.01em] text-ink">
              {formatMoney(totals.grandTotalMinor, currency)}
            </p>
          </div>
        </aside>

        <section className={`min-w-0 flex-1 bg-desk lg:block ${pane === "preview" ? "block" : "hidden"}`}>
          <Preview invoice={invoice} onReady={onPdfReady} />
        </section>
      </div>

      <AnimatePresence>
        {historyOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setHistoryOpen(false)}
              className="fixed inset-0 z-40 bg-[rgba(16,24,40,0.2)]"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-[min(400px,92vw)] flex-col border-l border-line bg-canvas shadow-[0_12px_40px_-12px_rgba(16,24,40,0.25)]"
              aria-label="Your invoices"
            >
              <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-4">
                <h2 className="text-[13px] font-semibold text-ink">Your invoices</h2>
                <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(false)} title="Close">
                  <X size={15} />
                </Button>
              </header>

              {saved.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <FileText size={22} className="mx-auto text-ink-3" />
                  <p className="mt-3 text-[13px] font-medium text-ink">No invoices yet</p>
                  <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-ink-3">
                    Every invoice you download is kept here, on this computer, ready to reopen or use as the
                    start of the next one.
                  </p>
                </div>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                  {saved.map((entry) => {
                    const t = computeTotals(entry.invoice);
                    const current = entry.invoice.number === invoice.number && entry.invoice.kind === invoice.kind;
                    return (
                      <li key={entry.id} className="group flex items-center gap-2 pr-2">
                        <button
                          type="button"
                          onClick={() => {
                            setInvoice(entry.invoice);
                            setHistoryOpen(false);
                            setPane("edit");
                          }}
                          className="min-w-0 flex-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-well"
                        >
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-ink">
                              {entry.invoice.buyer.name || "Untitled client"}
                            </span>
                            {current ? <Check size={13} className="shrink-0 text-accent" aria-label="Open now" /> : null}
                          </span>
                          <span className="tnum mt-0.5 flex justify-between gap-3 text-[12px] text-ink-3">
                            <span className="truncate">
                              No. {entry.invoice.number} · {entry.invoice.kind === "gst" ? "Tax invoice" : "No GST"} ·{" "}
                              {new Date(entry.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                            <span className="shrink-0 text-ink-2">
                              {formatMoney(t.grandTotalMinor, currencyOf(entry.invoice.currencyCode))}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          title="Remove from your invoices"
                          aria-label={`Remove invoice ${entry.invoice.number}`}
                          onClick={() => setSaved(deleteSaved(entry.id))}
                          className="rounded-md p-1.5 text-ink-3 opacity-0 transition-[opacity,color,background-color] duration-150 group-hover:opacity-100 hover:bg-well hover:text-danger focus-visible:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(16,24,40,0.4)]"
          >
            <span className="flex items-center gap-2">
              <Check size={14} className="text-[oklch(0.85_0.12_155)]" />
              {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
