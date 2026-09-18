"use client";

/**
 * Renders an invoice to a PDF blob, in a Web Worker where the browser allows
 * it and on the main thread where it does not.
 *
 * One worker serves the whole session: starting a worker loads the renderer
 * and fonts, which is worth doing once rather than per render.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { Invoice } from "../lib/invoice-types";
import type { RenderRequest, RenderResponse } from "./render-protocol";
import type { Variant } from "./theme";

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<RenderResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if ("blob" in e.data) p.resolve(e.data.blob);
      else p.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      // A worker that cannot start (or crashes) hands everything in flight,
      // and everything after, to the main thread rather than failing.
      workerBroken = true;
      worker?.terminate();
      worker = null;
      for (const [, p] of pending) p.reject(new Error("worker unavailable"));
      pending.clear();
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

async function renderOnMainThread(invoice: Invoice, variant: Variant, darkSignature?: string): Promise<Blob> {
  const [{ pdf }, { InvoiceDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./invoice-document")]);
  const doc = createElement(InvoiceDocument, { invoice, variant, darkSignature });
  return pdf(doc as unknown as ReactElement<DocumentProps>).toBlob();
}

export async function renderInvoicePdf(invoice: Invoice, variant: Variant, darkSignature?: string): Promise<Blob> {
  const w = getWorker();
  if (!w) return renderOnMainThread(invoice, variant, darkSignature);
  const id = ++seq;
  try {
    return await new Promise<Blob>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ id, invoice, variant, darkSignature } satisfies RenderRequest);
    });
  } catch (e) {
    if (workerBroken) return renderOnMainThread(invoice, variant, darkSignature);
    throw e;
  }
}
