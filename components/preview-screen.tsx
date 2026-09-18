"use client";

/**
 * The preview screen: the invoice exactly as it will be sent.
 *
 * Always the light document, whatever the interface theme, because that is
 * what the client receives, prints and files. It is built the way an export
 * is, fresh from the current invoice, so there is nothing between what you see
 * here and what you download.
 */

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Invoice } from "@/lib/invoice-types";
import type { ExportFormat } from "@/lib/export/shared";
import { lightPdfUrl } from "@/lib/export/browser";
import { ExportMenu } from "./export-menu";
import { ThemeToggle } from "./theme";

export function PreviewScreen({
  invoice,
  onClose,
  onExported,
}: {
  invoice: Invoice;
  onClose: () => void;
  onExported?: (format: ExportFormat) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    lightPdfUrl(invoice)
      .then((u) => {
        made = u;
        if (live) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [invoice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-desk" role="dialog" aria-modal="true" aria-label="Invoice preview">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-canvas px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:bg-well hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <div className="min-w-0 border-l border-line pl-3">
          <p className="text-[13px] font-semibold text-ink">Preview</p>
          <p className="truncate text-[11.5px] text-ink-3">
            Exactly as it will be sent · No. {invoice.number}
            {invoice.buyer.name ? ` · ${invoice.buyer.name}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <ExportMenu invoice={invoice} onExported={onExported} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 justify-center overflow-auto px-6 py-8">
        <div
          className="aspect-[210/297] w-full max-w-[820px] self-start overflow-hidden rounded-[3px] bg-white"
          style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.08), 0 20px 48px -12px rgba(16,24,40,0.28)" }}
        >
          {error ? (
            <div className="flex h-full items-center justify-center p-10 text-center text-[13px] text-[#494949]">
              The invoice could not be drawn: {error}
            </div>
          ) : url ? (
            <iframe title="Invoice preview" src={`${url}#toolbar=0&navpanes=0&view=Fit`} className="size-full" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 size={20} className="animate-spin text-[#9aa0a8]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
