"use client";

/**
 * The live preview: the real PDF, on the desk.
 *
 * This renders the actual PDF and shows it, rather than an HTML lookalike. An
 * HTML preview is a second implementation of the document that eventually
 * disagrees with the file being sent, and a preview you cannot trust is worth
 * nothing. The cost is managed rather than avoided: regeneration is debounced,
 * and the previous page stays up while the next one renders, so typing never
 * blanks the sheet.
 *
 * The sheet is the only thing here. Download lives in the toolbar, where the
 * primary action belongs, so this component just reports when a file is ready.
 */

import { useEffect, useState } from "react";
import { usePDF } from "@react-pdf/renderer";
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

export function Preview({
  invoice,
  onReady,
}: {
  invoice: Invoice;
  /**
   * The current PDF's object URL (null until the first render), and whether it
   * is stale: for the moment after an edit, before the debounce settles and the
   * renderer catches up, the file on hand is the previous version.
   */
  onReady: (url: string | null, stale: boolean) => void;
}) {
  const settled = useDebounced(invoice, DEBOUNCE_MS);
  const [instance, update] = usePDF({ document: <InvoiceDocument invoice={settled} /> });

  useEffect(() => {
    update(<InvoiceDocument invoice={settled} />);
    // `update` is recreated each render by usePDF; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  // Hold the last good URL so the sheet never blanks between renders. Kept in
  // state and updated during render, React's pattern for remembering a value
  // from a previous render; a ref read here would be invisible to React.
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  if (instance.url && instance.url !== lastUrl) setLastUrl(instance.url);
  const shown = instance.url ?? lastUrl;

  // Stale while the debounce is pending or the renderer is working.
  const busy = instance.loading || settled !== invoice;

  useEffect(() => {
    onReady(shown, busy);
  }, [shown, busy, onReady]);

  return (
    <div className="flex h-full justify-center overflow-auto px-6 py-8">
      <div className="relative w-full max-w-[760px]">
        <div
          className={`pointer-events-none absolute -top-6 right-0 flex items-center gap-1.5 text-[11px] text-ink-3 transition-opacity duration-200 ${
            busy && shown ? "opacity-100" : "opacity-0"
          }`}
          aria-live="polite"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          Updating
        </div>

        <div
          className="aspect-[210/297] w-full overflow-hidden rounded-[3px] bg-white"
          /* The one real shadow in the interface: a sheet resting on a desk.
             Nothing in the chrome carries elevation. */
          style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.06), 0 12px 32px -8px rgba(16,24,40,0.18)" }}
        >
          {instance.error ? (
            <div className="flex h-full items-center justify-center p-10 text-center text-[13px] text-ink-2">
              The invoice could not be drawn: {String(instance.error)}
            </div>
          ) : shown ? (
            <iframe
              title="Invoice preview"
              src={`${shown}#toolbar=0&navpanes=0&view=Fit`}
              className="size-full"
            />
          ) : (
            <SheetSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}

/** The first render, drawn as the page it is about to become. */
function SheetSkeleton() {
  const bar = "rounded-sm bg-well animate-pulse";
  return (
    <div className="flex h-full flex-col gap-6 p-[6.7%]" aria-label="Preparing the invoice">
      <div className="flex justify-between">
        <div className={`${bar} h-6 w-32`} />
        <div className={`${bar} h-6 w-24`} />
      </div>
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <div className={`${bar} h-3 w-40`} />
          <div className={`${bar} h-3 w-32`} />
          <div className={`${bar} h-3 w-36`} />
        </div>
        <div className="space-y-2">
          <div className={`${bar} h-3 w-40`} />
          <div className={`${bar} h-3 w-28`} />
        </div>
      </div>
      <div className="space-y-3 pt-4">
        <div className={`${bar} h-3 w-full`} />
        <div className={`${bar} h-3 w-full`} />
        <div className={`${bar} h-3 w-2/3`} />
      </div>
      <div className="mt-auto flex justify-end">
        <div className={`${bar} h-10 w-48`} />
      </div>
    </div>
  );
}
