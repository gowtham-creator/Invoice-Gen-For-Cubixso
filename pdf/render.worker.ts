/// <reference lib="webworker" />

/**
 * Builds invoice PDFs off the main thread.
 *
 * Laying out and subsetting fonts for a PDF is one long synchronous task. On
 * the main thread it froze typing for about 100 ms at every pause, and longer
 * on slower machines or longer invoices. Here it runs beside the page instead,
 * and the editor never waits for it.
 */

import { createElement, type ReactElement } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { InvoiceDocument } from "./invoice-document";
import type { RenderRequest, RenderResponse } from "./render-protocol";

self.onmessage = async (e: MessageEvent<RenderRequest>) => {
  const { id, invoice, variant, darkSignature } = e.data;
  try {
    const doc = createElement(InvoiceDocument, { invoice, variant, darkSignature });
    const blob = await pdf(doc as unknown as ReactElement<DocumentProps>).toBlob();
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, blob } satisfies RenderResponse);
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies RenderResponse);
  }
};
