"use client";

/**
 * The application shell.
 *
 * Two panes: settings on the left, the document on the right. The split is the
 * whole interaction model — every control has a visible consequence on the
 * sheet, so nothing needs a "preview" step and there is no save-then-check
 * loop. On a narrow screen the two panes become tabs rather than stacking,
 * because a preview scrolled two screens below its controls is a preview
 * nobody looks at.
 *
 * The invoice object lives here and flows down. Children never hold document
 * state, which is what makes autosave, history and reset single-line operations
 * instead of a synchronisation problem.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Check, FilePlus2, History, Loader2, Save, Trash2 } from "lucide-react";
import type { Invoice } from "@/lib/invoice-types";
import { blankInvoice } from "@/lib/defaults";
import { computeTotals } from "@/lib/invoice-math";
import { currencyOf, formatMoney } from "@/lib/currency";
import {
  deleteSaved, listSaved, loadDraft, nextInvoiceNumber, saveDraft, saveInvoice,
  type SavedInvoice,
} from "@/lib/storage";
import { Editor } from "@/components/editor";
import { Button } from "@/components/controls";

/**
 * The PDF engine is browser-only: it reaches for canvas and font APIs that do
 * not exist during server rendering. Loading it lazily also keeps it out of the
 * first paint, so the editor is interactive before the renderer arrives.
 */
const Preview = dynamic(() => import("@/components/preview").then((m) => m.Preview), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 size={18} className="animate-spin text-faint" />
    </div>
  ),
});

type Pane = "edit" | "preview";

export default function Page() {
  const [invoice, setInvoice] = useState<Invoice>(() => blankInvoice());
  const [saved, setSaved] = useState<SavedInvoice[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pane, setPane] = useState<Pane>("edit");
  const [hydrated, setHydrated] = useState(false);

  // Restore after mount rather than during render: localStorage does not exist
  // on the server, and seeding state from it directly would desync hydration.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) setInvoice(draft);
    setSaved(listSaved());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveDraft(invoice);
  }, [invoice, hydrated]);

  const set = useCallback((patch: Partial<Invoice>) => {
    setInvoice((prev) => ({ ...prev, ...patch }));
  }, []);

  const totals = useMemo(() => computeTotals(invoice), [invoice]);
  const currency = currencyOf(invoice.currencyCode);

  const onSave = () => {
    setSaved(saveInvoice(invoice));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  };

  const onNew = () => {
    const fresh = blankInvoice(invoice.kind);
    // Carry forward the things that are about the business rather than the
    // client: who is billing, from where, and into which account.
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

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-void">
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cubixso-logo.png"
            alt=""
            width={22}
            height={22}
            /* The mark is black on transparent, which disappears against the
               dark chrome. Inverting renders it white while keeping the real
               artwork, rather than substituting a redrawn light version. */
            className="shrink-0 invert"
          />
          <div className="leading-none">
            <p className="text-[12px] font-semibold tracking-[-0.01em]">Cubixso Invoicer</p>
            <p className="mt-0.5 text-[10px] text-faint">
              {invoice.kind === "gst" ? "Tax invoice" : "Non-GST invoice"} · {invoice.number || "—"}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="mr-2 hidden text-right sm:block">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-faint">Total due</p>
            <p className="tnum text-[14px] font-semibold tracking-[-0.02em]">
              {formatMoney(totals.grandTotalMinor, currency)}
            </p>
          </div>

          <Button onClick={() => setHistoryOpen((v) => !v)} title="Saved invoices">
            <History size={13} />
            <span className="hidden sm:inline">{saved.length || ""}</span>
          </Button>
          <Button onClick={onNew} title="Start a new invoice">
            <FilePlus2 size={13} />
            <span className="hidden sm:inline">New</span>
          </Button>
          <Button variant="primary" onClick={onSave}>
            {justSaved ? <Check size={13} /> : <Save size={13} />}
            <span className="hidden sm:inline">{justSaved ? "Saved" : "Save"}</span>
          </Button>
        </div>
      </header>

      {/* Pane switch, narrow screens only. */}
      <div className="flex shrink-0 gap-0.5 border-b border-hairline p-1.5 lg:hidden">
        {(["edit", "preview"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPane(p)}
            className={`flex-1 rounded-md py-1.5 text-[12px] font-medium capitalize transition-colors ${
              pane === p ? "bg-raised text-ink" : "text-faint"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <section
          className={`scroll-slim w-full shrink-0 overflow-y-auto border-r border-hairline lg:block lg:w-[520px] ${
            pane === "edit" ? "block" : "hidden"
          }`}
        >
          <Editor invoice={invoice} set={set} />
        </section>

        <section className={`min-w-0 flex-1 lg:block ${pane === "preview" ? "block" : "hidden"}`}>
          <Preview invoice={invoice} />
        </section>
      </div>

      <AnimatePresence>
        {historyOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setHistoryOpen(false)}
              className="fixed inset-0 z-40 bg-black/50"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="scroll-slim fixed inset-y-0 right-0 z-50 w-[min(380px,90vw)] overflow-y-auto border-l border-hairline bg-panel"
            >
              <header className="sticky top-0 flex items-center justify-between border-b border-hairline bg-panel px-4 py-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
                  Saved invoices
                </h2>
                <Button variant="quiet" onClick={() => setHistoryOpen(false)}>Close</Button>
              </header>

              {saved.length === 0 ? (
                <p className="px-4 py-8 text-[13px] leading-relaxed text-faint">
                  Nothing saved yet. Hit Save and this invoice will be kept on this machine,
                  ready to reopen or duplicate.
                </p>
              ) : (
                <ul>
                  {saved.map((entry) => {
                    const t = computeTotals(entry.invoice);
                    return (
                      <li key={entry.id} className="border-b border-hairline">
                        <div className="flex items-center gap-2 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setInvoice(entry.invoice);
                              setHistoryOpen(false);
                              setPane("edit");
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-[13px] font-medium">
                              {entry.invoice.buyer.name || "Untitled client"}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-faint">
                              {entry.invoice.kind === "gst" ? "Tax invoice" : "Non-GST"} ·{" "}
                              {entry.invoice.number} ·{" "}
                              <span className="tnum">
                                {formatMoney(t.grandTotalMinor, currencyOf(entry.invoice.currencyCode))}
                              </span>
                            </p>
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => setSaved(deleteSaved(entry.id))}
                            className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-alert"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
