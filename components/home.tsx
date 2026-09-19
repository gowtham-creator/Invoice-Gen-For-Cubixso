"use client";

/**
 * The invoice list: the home screen.
 *
 * A list rather than a grid of cards, because invoices are compared down a
 * column: which client, which date, sent or not, how much. Each row opens its
 * invoice; the "⋯" menu carries everything else you do to one (preview,
 * export, duplicate, delete) so the row itself stays quiet.
 *
 * Totals are summed only across rupee invoices. Adding dollars to rupees would
 * produce a number that means nothing, and a wrong total is worse than none.
 */

import { useMemo, useState } from "react";
import {
  ChevronDown, Code2, Copy, Eye, FilePlus2, FileText, FileType2, MoreHorizontal, PencilLine, Search, Trash2,
} from "lucide-react";
import { computeTotals } from "@/lib/invoice-math";
import { currencyOf, formatMoney } from "@/lib/currency";
import {
  createInvoice, deleteInvoice, duplicateInvoice, listInvoices, markExported, restoreInvoice, type InvoiceRecord,
} from "@/lib/storage";
import { exportInvoice } from "@/lib/export/browser";
import { fmtDate, type ExportFormat } from "@/lib/export/shared";
import type { Invoice } from "@/lib/invoice-types";
import { Menu } from "./menu";
import type { Route } from "./router";
import { SignOutButton } from "./session";
import { ThemeToggle } from "./theme";
import { useToast } from "./toast";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function Home({ go }: { go: (r: Route) => void }) {
  const [records, setRecords] = useState<InvoiceRecord[]>(() => listInvoices());
  const [query, setQuery] = useState("");
  const toast = useToast();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) => r.invoice.buyer.name.toLowerCase().includes(q) || r.invoice.number.toLowerCase().includes(q),
    );
  }, [records, query]);

  const inrBilled = useMemo(
    () =>
      records
        .filter((r) => r.invoice.currencyCode === "INR")
        .reduce((sum, r) => sum + computeTotals(r.invoice).grandTotalMinor, 0),
    [records],
  );

  const start = (kind: Invoice["kind"]) => go({ name: "invoice", id: createInvoice(kind).id });

  const exportRow = async (r: InvoiceRecord, format: ExportFormat) => {
    try {
      await exportInvoice(r.invoice, format);
      setRecords(markExported(r.id));
      toast({ tone: "success", message: `Invoice ${r.invoice.number} downloaded` });
    } catch (e) {
      toast({ tone: "error", message: `Could not export: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  const remove = (r: InvoiceRecord) => {
    setRecords(deleteInvoice(r.id));
    toast({
      tone: "success",
      message: `Invoice ${r.invoice.number} deleted`,
      action: { label: "Undo", onClick: () => setRecords(restoreInvoice(r)) },
    });
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-canvas px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cubixso-logo.png" alt="Cubixso" width={22} height={22} className="shrink-0 dark:invert" />
        <span className="text-[13px] font-semibold text-ink">Invoices</span>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <SignOutButton />
          <NewInvoice onStart={start} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Invoices</h1>
            <p className="tnum mt-1 text-[13px] text-ink-3">
              {records.length === 0
                ? "Nothing yet"
                : `${records.length} ${records.length === 1 ? "invoice" : "invoices"}${
                    inrBilled > 0 ? ` · ${formatMoney(inrBilled, currencyOf("INR"))} billed` : ""
                  }`}
            </p>
          </div>
          {records.length > 0 && (
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search invoices</span>
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by client or number"
                className="h-8 pointer-coarse:h-10 w-full rounded-md border border-edge bg-field pr-2.5 pl-8 text-[13px] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-edge-strong focus:border-accent focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
              />
            </label>
          )}
        </div>

        {records.length === 0 ? (
          <EmptyState onStart={start} />
        ) : (
          <div className="overflow-visible rounded-lg border border-line bg-field shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="hidden grid-cols-[56px_1fr_100px_124px_116px_40px] gap-3 lg:grid-cols-[72px_1fr_120px_150px_140px_40px] border-b border-line px-4 py-2.5 text-[12px] font-medium text-ink-3 sm:grid">
              <span>No.</span>
              <span>Client</span>
              <span>Date</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-ink-3">No invoices match “{query}”.</p>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((r) => (
                  <Row
                    key={r.id}
                    record={r}
                    onOpen={() => go({ name: "invoice", id: r.id })}
                    onPreview={() => go({ name: "preview", id: r.id })}
                    onExport={(f) => exportRow(r, f)}
                    onDuplicate={() => {
                      const copy = duplicateInvoice(r.id);
                      if (copy) go({ name: "invoice", id: copy.id });
                    }}
                    onDelete={() => remove(r)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Row({
  record,
  onOpen,
  onPreview,
  onExport,
  onDuplicate,
  onDelete,
}: {
  record: InvoiceRecord;
  onOpen: () => void;
  onPreview: () => void;
  onExport: (f: ExportFormat) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const inv = record.invoice;
  const total = formatMoney(computeTotals(inv).grandTotalMinor, currencyOf(inv.currencyCode));
  const status = record.exportedAt ? `Exported ${shortDate(record.exportedAt)}` : "Draft";

  return (
    <li className="group relative grid grid-cols-[1fr_auto_40px] items-center gap-3 px-4 py-3 transition-colors duration-100 hover:bg-well sm:grid-cols-[56px_1fr_100px_124px_116px_40px] lg:grid-cols-[72px_1fr_120px_150px_140px_40px]">
      {/* The whole row opens the invoice; the menu sits above this layer. */}
      <button type="button" onClick={onOpen} className="absolute inset-0 rounded-none" aria-label={`Open invoice ${inv.number}`} />
      <span className="tnum pointer-events-none hidden text-[13px] text-ink-2 sm:block">{inv.number}</span>
      <span className="pointer-events-none min-w-0">
        <span className="flex items-center gap-2">
          <span className={`truncate text-[13px] font-medium ${inv.buyer.name ? "text-ink" : "text-ink-3"}`}>
            {inv.buyer.name || "No client yet"}
          </span>
          {inv.kind === "non-gst" ? (
            <span className="shrink-0 rounded bg-well px-1.5 py-px text-[11px] text-ink-2 ring-1 ring-line ring-inset">No GST</span>
          ) : null}
        </span>
        <span className="tnum mt-0.5 block truncate text-[12px] text-ink-3 sm:hidden">
          No. {inv.number} · {fmtDate(inv.issueDate)} · {status}
        </span>
      </span>
      <span className="tnum pointer-events-none hidden text-[13px] text-ink-2 sm:block">{fmtDate(inv.issueDate)}</span>
      <span className={`pointer-events-none hidden text-[13px] sm:block ${record.exportedAt ? "text-ink-2" : "text-ink-3"}`}>
        {status}
      </span>
      <span className="tnum pointer-events-none text-right text-[13px] font-medium text-ink">{total}</span>
      <div className="relative z-10 justify-self-end">
        <Menu
          label={`Invoice ${inv.number}`}
          items={[
            { label: "Open", icon: <PencilLine size={15} />, onSelect: onOpen },
            { label: "Preview", icon: <Eye size={15} />, onSelect: onPreview },
            "separator",
            { label: "Download PDF", hint: ".pdf", icon: <FileText size={15} />, onSelect: () => onExport("pdf") },
            { label: "Word document", hint: ".docx", icon: <FileType2 size={15} />, onSelect: () => onExport("docx") },
            { label: "HTML page", hint: ".html", icon: <Code2 size={15} />, onSelect: () => onExport("html") },
            "separator",
            { label: "Duplicate", icon: <Copy size={15} />, onSelect: onDuplicate },
            { label: "Delete", icon: <Trash2 size={15} />, danger: true, onSelect: onDelete },
          ]}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={`Actions for invoice ${inv.number}`}
              className="grid size-8 pointer-coarse:size-10 place-items-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-line hover:text-ink aria-expanded:bg-line aria-expanded:text-ink"
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        />
      </div>
    </li>
  );
}

function NewInvoice({ onStart }: { onStart: (kind: Invoice["kind"]) => void }) {
  const base =
    "inline-flex h-8 pointer-coarse:h-10 items-center gap-1.5 bg-accent text-[13px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:translate-y-px";
  return (
    <div className="flex rounded-md shadow-[0_1px_2px_rgba(16,24,40,0.15)]">
      <button type="button" onClick={() => onStart("gst")} className={`${base} rounded-l-md px-3`}>
        <FilePlus2 size={15} />
        New invoice
      </button>
      <Menu
        label="New invoice"
        items={[
          { label: "Tax invoice", hint: "GST", icon: <FileText size={15} />, onSelect: () => onStart("gst") },
          { label: "Invoice, no GST", hint: "0%", icon: <FileText size={15} />, onSelect: () => onStart("non-gst") },
        ]}
        trigger={(props) => (
          <button type="button" {...props} aria-label="Choose the kind of invoice" className={`${base} rounded-r-md border-l border-white/20 px-2`}>
            <ChevronDown size={15} />
          </button>
        )}
      />
    </div>
  );
}

/** The first run: says what is already done for you, and starts. */
function EmptyState({ onStart }: { onStart: (kind: Invoice["kind"]) => void }) {
  return (
    <div className="rounded-lg border border-dashed border-edge px-6 py-16 text-center">
      <FileText size={24} className="mx-auto text-ink-3" />
      <h2 className="mt-4 text-[15px] font-semibold text-ink">No invoices yet</h2>
      <p className="mx-auto mt-1.5 max-w-[360px] text-[13px] leading-relaxed text-ink-2">
        CUBIXSO’s details, bank account, signature and seal are already filled in. Add a client and what you’re billing for.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => onStart("gst")}
          className="inline-flex h-8 pointer-coarse:h-10 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.15)] transition-colors hover:bg-accent-strong"
        >
          <FilePlus2 size={15} />
          New tax invoice
        </button>
        <button
          type="button"
          onClick={() => onStart("non-gst")}
          className="inline-flex h-8 pointer-coarse:h-10 items-center gap-1.5 rounded-md border border-edge bg-field px-3 text-[13px] font-medium text-ink transition-colors hover:border-edge-strong hover:bg-well"
        >
          Invoice without GST
        </button>
      </div>
    </div>
  );
}
