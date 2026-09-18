"use client";

/**
 * The live invoice beside the editor: the real PDF, on the desk.
 *
 * It renders the actual PDF rather than an HTML lookalike, so what you check
 * is what the renderer produces. Regeneration is debounced and the previous
 * page stays up while the next renders, so typing never blanks the sheet.
 *
 * It follows the theme. On a dark screen it shows the template's dark variant
 * of the invoice, so a bright white page does not glare out of a dark
 * interface. This sheet is for editing only: downloads, exports and the
 * preview screen always render the light document, which is what a client
 * receives.
 */

import { useEffect, useState } from "react";
import { usePDF } from "@react-pdf/renderer";
import type { Invoice } from "@/lib/invoice-types";
import { isCustomSignature } from "@/lib/defaults";
import { redrawImage } from "@/lib/export/browser";
import { InvoiceDocument } from "@/pdf/invoice-document";
import { PALETTES } from "@/pdf/theme";
import { useTheme } from "./theme";

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

/**
 * An uploaded signature redrawn in the dark palette's ink. The built-in one
 * has a pre-made twin; an upload cannot be known ahead of time.
 */
function useDarkSignature(invoice: Invoice, active: boolean): string | undefined {
  const [out, setOut] = useState<{ src: string; dark: string } | null>(null);
  const src = active && isCustomSignature(invoice) ? (invoice.signatureImage as string) : null;
  useEffect(() => {
    if (!src || out?.src === src) return;
    let live = true;
    redrawImage(src, [245, 245, 245])
      .then((r) => live && setOut({ src, dark: r.dataUrl }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [src, out?.src]);
  return src && out?.src === src ? out.dark : undefined;
}

export function Preview({ invoice }: { invoice: Invoice }) {
  const { resolved } = useTheme();
  const variant = resolved;
  const settled = useDebounced(invoice, DEBOUNCE_MS);
  const darkSignature = useDarkSignature(settled, variant === "dark");
  const doc = <InvoiceDocument invoice={settled} variant={variant} darkSignature={darkSignature} />;
  const [instance, update] = usePDF({ document: doc });

  useEffect(() => {
    update(<InvoiceDocument invoice={settled} variant={variant} darkSignature={darkSignature} />);
    // `update` is recreated each render by usePDF; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, variant, darkSignature]);

  // Hold the last good URL so the sheet never blanks between renders. Kept in
  // state and updated during render, React's pattern for remembering a value
  // from a previous render.
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  if (instance.url && instance.url !== lastUrl) setLastUrl(instance.url);
  const shown = instance.url ?? lastUrl;

  const busy = instance.loading || settled !== invoice;
  const paper = PALETTES[variant].paper;

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
          className="aspect-[210/297] w-full overflow-hidden rounded-[3px] transition-colors duration-300"
          /* The one real shadow in the interface: a sheet resting on a desk. */
          style={{
            background: paper,
            boxShadow:
              variant === "dark"
                ? "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px -8px rgba(0,0,0,0.6)"
                : "0 1px 2px rgba(16,24,40,0.06), 0 12px 32px -8px rgba(16,24,40,0.18)",
          }}
        >
          {instance.error ? (
            <div className="flex h-full items-center justify-center p-10 text-center text-[13px] text-ink-2">
              The invoice could not be drawn: {String(instance.error)}
            </div>
          ) : shown ? (
            <iframe title="Invoice" src={`${shown}#toolbar=0&navpanes=0&view=Fit`} className="size-full" />
          ) : (
            <SheetSkeleton dark={variant === "dark"} />
          )}
        </div>
      </div>
    </div>
  );
}

/** The first render, drawn as the page it is about to become. */
function SheetSkeleton({ dark }: { dark: boolean }) {
  const bar = `rounded-sm animate-pulse ${dark ? "bg-[#1f1f1f]" : "bg-[#eef0f3]"}`;
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
