"use client";

/**
 * The live invoice beside the editor: the real PDF, on the desk.
 *
 * It renders the actual PDF rather than an HTML lookalike, so what you check
 * is what the renderer produces. Regeneration is debounced and the previous
 * page stays up while the next renders, so typing never blanks the sheet.
 *
 * It follows the theme. On a dark screen the page is shown dark, so a bright
 * white sheet does not glare out of a dark interface. The dark page is the
 * light one through a colour filter rather than a second render: rendering a
 * dark PDF on every switch left the invoice 250-300 ms behind the interface,
 * showing the wrong theme meanwhile, where the filter is applied by the GPU
 * in the same frame. The filter is tuned so white paper lands exactly on the
 * dark palette's #0a0a0a. This sheet is for editing only: downloads, exports
 * and the preview screen always render the light document, which is what a
 * client receives.
 */

import { useEffect, useRef, useState } from "react";
import type { Invoice } from "@/lib/invoice-types";
import { renderInvoicePdf } from "@/pdf/render";
import { PALETTES } from "@/pdf/theme";
import { useTheme } from "./theme";
import { PdfSheet } from "./pdf-sheet";

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
 * Light paper (#ffffff) onto the dark palette's paper (#0a0a0a): invert(p)
 * maps white to 1 - p, and 10/255 = 0.039. The hue turn puts colours back on
 * their own hue after the inversion, so the accent stays blue.
 */
const DARK_FILTER = "invert(0.961) hue-rotate(180deg)";

export function Preview({ invoice }: { invoice: Invoice }) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const settled = useDebounced(invoice, DEBOUNCE_MS);
  const [shown, setShown] = useState<{ key: Invoice; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    // Rendered in a Web Worker (see pdf/render.ts), so typing never waits on it.
    // Always the light page: the theme is a filter over it, never a re-render.
    renderInvoicePdf(settled, "light")
      .then((blob) => {
        // A newer edit superseded this render: drop it rather than show stale work.
        if (!live) return;
        const url = URL.createObjectURL(blob);
        const previous = current.current;
        current.current = url;
        setShown({ key: settled, url });
        setError(null);
        // Every render is a ~330 KB file. Free the last one once the new one has
        // had time to load, or memory grows for as long as the invoice is edited.
        if (previous) setTimeout(() => URL.revokeObjectURL(previous), 3000);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [settled]);

  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  const busy = !shown || shown.key !== settled || settled !== invoice;

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
          className="aspect-[210/297] w-full overflow-hidden rounded-[3px] transition-shadow duration-200"
          /* The one real shadow in the interface: a sheet resting on a desk.
             It sits outside the filter, which would otherwise invert it into
             a glow. */
          style={{
            boxShadow: dark
              ? "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px -8px rgba(0,0,0,0.6)"
              : "0 1px 2px rgba(16,24,40,0.06), 0 12px 32px -8px rgba(16,24,40,0.18)",
          }}
        >
          <div
            className="size-full transition-[filter] duration-200 ease-out"
            style={{ background: PALETTES.light.paper, filter: dark ? DARK_FILTER : "none" }}
          >
            {error && !shown ? (
              <div className="flex h-full items-center justify-center p-10 text-center text-[13px] text-[#494949]">
                The invoice could not be drawn: {error}
              </div>
            ) : shown ? (
              <PdfSheet url={shown.url} title="Invoice" />
            ) : (
              <SheetSkeleton />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The first render, drawn as the page it is about to become. */
function SheetSkeleton() {
  // Drawn light, like the page; the sheet's filter darkens it with the theme.
  const bar = "rounded-sm animate-pulse bg-[#eef0f3]";
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
