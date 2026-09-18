"use client";

/**
 * One invoice, open for editing: the editor on the left, the invoice on the
 * right, sitting on the desk as the sheet of paper it will become.
 *
 * Every change is written to the invoice's record as it happens, so there is
 * no save step and the list on the home screen is never out of date. Opening
 * an invoice is not a change: it does not bump the invoice to the top of the
 * list.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight, Eye, Loader2 } from "lucide-react";
import type { Invoice } from "@/lib/invoice-types";
import { computeTotals } from "@/lib/invoice-math";
import { currencyOf, formatMoney } from "@/lib/currency";
import { getInvoice, markExported, saveInvoiceContent } from "@/lib/storage";
import { Editor } from "./editor";
import { Button, Segmented } from "./controls";
import { ExportMenu } from "./export-menu";
import { PreviewScreen } from "./preview-screen";
import { hrefFor, type Route } from "./router";
import { ThemeToggle } from "./theme";

/**
 * The PDF engine is browser-only and heavy; loading it lazily keeps it out of
 * the first paint, so the editor is usable before the renderer arrives.
 */
const Preview = dynamic(() => import("./preview").then((m) => m.Preview), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 size={18} className="animate-spin text-ink-3" />
    </div>
  ),
});

type Pane = "edit" | "preview";

export function EditorScreen({
  id,
  previewing,
  go,
  back,
}: {
  id: string;
  previewing: boolean;
  go: (r: Route) => void;
  back: () => void;
}) {
  const [record] = useState(() => getInvoice(id));
  if (!record) return <NotFound />;
  return <Loaded key={id} id={id} initial={record.invoice} previewing={previewing} go={go} back={back} />;
}

function Loaded({
  id,
  initial,
  previewing,
  go,
  back,
}: {
  id: string;
  initial: Invoice;
  previewing: boolean;
  go: (r: Route) => void;
  back: () => void;
}) {
  const [invoice, setInvoice] = useState<Invoice>(initial);
  const [pane, setPane] = useState<Pane>("edit");
  const opened = useRef(initial);
  const latest = useRef(initial);
  const dirty = useRef(false);

  // Saved after a pause in typing, not on every keystroke: a save rewrites the
  // whole invoice list in storage, synchronously. Opening is not an edit, so
  // the invoice as loaded is never written.
  useEffect(() => {
    latest.current = invoice;
    if (invoice === opened.current) return;
    dirty.current = true;
    const t = setTimeout(() => {
      saveInvoiceContent(id, latest.current);
      dirty.current = false;
    }, 400);
    return () => clearTimeout(t);
  }, [id, invoice]);

  // Leaving the invoice or closing the tab saves at once, so the pause can
  // never lose the last edit.
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      saveInvoiceContent(id, latest.current);
      dirty.current = false;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [id]);

  const set = useCallback((patch: Partial<Invoice>) => {
    setInvoice((prev) => ({ ...prev, ...patch }));
  }, []);

  const onExported = useCallback(() => {
    markExported(id);
  }, [id]);

  const totals = useMemo(() => computeTotals(invoice), [invoice]);
  const currency = currencyOf(invoice.currencyCode);
  const isGst = invoice.kind === "gst";

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-canvas px-4">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cubixso-logo.png" alt="" width={22} height={22} className="mr-1 shrink-0 dark:invert" />
          <a
            href={hrefFor({ name: "home" })}
            className="rounded px-1 text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-well hover:text-ink"
          >
            Invoices
          </a>
          <ChevronRight size={14} className="shrink-0 text-ink-3" aria-hidden />
          <span className="truncate text-[13px] text-ink" aria-current="page">
            <span className="tnum">No. {invoice.number || "—"}</span>
            {invoice.buyer.name ? <span className="hidden text-ink-2 sm:inline"> · {invoice.buyer.name}</span> : null}
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button onClick={() => go({ name: "preview", id })} title="See it exactly as it will be sent">
            <Eye size={15} />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <ExportMenu invoice={invoice} onExported={onExported} />
        </div>
      </header>

      {/* Pane switch, narrow screens only. */}
      <div className="shrink-0 border-b border-line bg-canvas px-4 py-2 lg:hidden">
        <Segmented
          value={pane}
          onChange={setPane}
          options={[
            { value: "edit", label: "Edit" },
            { value: "preview", label: "Invoice" },
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
          <Preview invoice={invoice} />
        </section>
      </div>

      {previewing && <PreviewScreen invoice={invoice} onClose={back} onExported={onExported} />}
    </main>
  );
}

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[15px] font-semibold text-ink">This invoice isn’t here</p>
      <p className="max-w-[340px] text-[13px] text-ink-2">
        It may have been deleted, or made in a different browser. Invoices are kept in the browser that made them.
      </p>
      <a
        href={hrefFor({ name: "home" })}
        className="mt-2 inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent-strong"
      >
        Back to invoices
      </a>
    </main>
  );
}
