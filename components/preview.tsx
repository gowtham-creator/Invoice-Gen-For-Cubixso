"use client";

/**
 * The live preview.
 *
 * This renders the actual PDF and shows it, rather than drawing an HTML
 * lookalike beside it. It is slower and it means carrying a PDF engine into the
 * browser, and it is still the right call: an HTML preview is a second
 * implementation of the document that will eventually disagree with the file
 * being sent, and the moment you cannot trust the preview it is worth nothing.
 *
 * The cost is managed rather than avoided — regeneration is debounced, and the
 * previous page stays on screen while the next one renders, so typing never
 * flashes the pane empty.
 */

import { useEffect, useRef, useState } from "react";
import { usePDF } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import type { Invoice } from "@/lib/invoice-types";
import { InvoiceDocument } from "@/pdf/invoice-document";

/** Long enough to skip most intermediate keystrokes, short enough to feel live. */
const DEBOUNCE_MS = 400;

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export function Preview({ invoice }: { invoice: Invoice }) {
  const settled = useDebounced(invoice, DEBOUNCE_MS);
  const [instance, update] = usePDF({ document: <InvoiceDocument invoice={settled} /> });

  useEffect(() => {
    update(<InvoiceDocument invoice={settled} />);
    // `update` is recreated each render by usePDF; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  // Hold the last good URL so the pane never blanks between renders.
  const lastUrl = useRef<string | null>(null);
  if (instance.url) lastUrl.current = instance.url;
  const shown = instance.url ?? lastUrl.current;

  const filename = `${invoice.kind === "gst" ? "Tax-Invoice" : "Invoice"}-${
    invoice.number || "draft"
  }${invoice.buyer.name ? `-${invoice.buyer.name.replace(/[^\w-]+/g, "-")}` : ""}.pdf`;

  const busy = instance.loading;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-2 text-[11px] text-faint">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
              busy ? "bg-action-bright" : "bg-hairline-bright"
            }`}
          />
          {busy ? "Rendering" : "Up to date"}
        </div>

        {shown ? (
          <a
            href={shown}
            download={filename}
            className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-action-bright"
          >
            <Download size={13} />
            Download PDF
          </a>
        ) : null}
      </header>

      <div className="scroll-slim flex-1 overflow-auto px-6 pb-6">
        <div className="mx-auto w-full max-w-[720px]">
          {instance.error ? (
            <p className="rounded-lg border border-alert/40 bg-alert/10 p-4 text-[13px] text-ink">
              The document could not be rendered: {String(instance.error)}
            </p>
          ) : shown ? (
            <iframe
              key="preview"
              title="Invoice preview"
              src={`${shown}#toolbar=0&navpanes=0&view=FitH`}
              className="h-[min(1040px,calc(100vh-7rem))] w-full rounded-lg bg-paper"
              /* The one signature shadow in the system: the sheet resting on
                 the desk. Nothing else in the chrome carries elevation. */
              style={{ boxShadow: "0 24px 64px -16px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)" }}
            />
          ) : (
            <div className="flex h-[70vh] items-center justify-center rounded-lg border border-hairline">
              <Loader2 size={18} className="animate-spin text-faint" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
