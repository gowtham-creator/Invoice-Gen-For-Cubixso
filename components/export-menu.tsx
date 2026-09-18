"use client";

/**
 * Export, as a split button: one click downloads the PDF, which is what goes
 * out nearly every time; the chevron opens the other formats. Hiding the PDF
 * behind a menu would add a click to the common case for the sake of the rare
 * one.
 */

import { useState } from "react";
import { ChevronDown, Code2, FileText, FileType2, Loader2 } from "lucide-react";
import type { Invoice } from "@/lib/invoice-types";
import type { ExportFormat } from "@/lib/export/shared";
import { exportInvoice } from "@/lib/export/browser";
import { Menu } from "./menu";
import { useToast } from "./toast";

const NAMES: Record<ExportFormat, string> = { pdf: "PDF", docx: "Word document", html: "HTML page" };

export function ExportMenu({
  invoice,
  onExported,
}: {
  invoice: Invoice;
  /** Called after a file has been built and handed to the browser. */
  onExported?: (format: ExportFormat) => void;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const toast = useToast();

  const run = async (format: ExportFormat) => {
    if (busy) return;
    setBusy(format);
    try {
      await exportInvoice(invoice, format);
      onExported?.(format);
      toast({ tone: "success", message: `Invoice ${invoice.number} downloaded as ${NAMES[format]}` });
    } catch (e) {
      toast({ tone: "error", message: `Could not export: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const base =
    "inline-flex h-8 items-center gap-1.5 bg-accent text-[13px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:translate-y-px disabled:cursor-wait disabled:bg-accent/60";

  return (
    <div className="flex shadow-[0_1px_2px_rgba(16,24,40,0.15)] rounded-md">
      <button type="button" onClick={() => run("pdf")} disabled={!!busy} className={`${base} rounded-l-md px-3`}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        {busy ? "Preparing…" : "Download PDF"}
      </button>
      <Menu
        label="Export as"
        items={[
          { label: "PDF", hint: ".pdf", icon: <FileText size={15} />, onSelect: () => run("pdf") },
          { label: "Word document", hint: ".docx", icon: <FileType2 size={15} />, onSelect: () => run("docx") },
          { label: "HTML page", hint: ".html", icon: <Code2 size={15} />, onSelect: () => run("html") },
        ]}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            disabled={!!busy}
            aria-label="More export formats"
            className={`${base} rounded-r-md border-l border-white/20 px-2`}
          >
            <ChevronDown size={15} />
          </button>
        )}
      />
    </div>
  );
}
