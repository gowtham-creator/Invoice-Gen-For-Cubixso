"use client";

/**
 * Exporting from the browser: gather the artwork and fonts, build the file in
 * the requested format, and hand it to the user as a download.
 *
 * Every export is built fresh from the invoice at the moment of the click, and
 * always as the light document. The on-screen preview may be showing the dark
 * variant, or be a keystroke behind; neither must ever reach a client.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { Invoice } from "../invoice-types";
import { BUILTIN_SEAL, BUILTIN_SIGNATURE, isCustomSignature } from "../defaults";
import { exportFileName, type ExportFormat } from "./shared";

const LOGO = "/cubixso-logo.png";

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.blob();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

/**
 * Redraws an image through a canvas as PNG, optionally recoloured.
 *
 * Used for uploaded signatures: Word cannot take WebP, so every upload is
 * normalised to PNG; and the dark on-screen invoice needs the signature in
 * light ink. Ink is derived from darkness, so a dark signature on a white or
 * transparent background comes out as light ink on transparent.
 */
export async function redrawImage(
  src: string,
  ink?: [number, number, number],
  maxSide = Number.POSITIVE_INFINITY,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (ink) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      const lum = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
      p[i + 3] = Math.round(p[i + 3] * (1 - lum / 255));
      p[i] = ink[0];
      p[i + 1] = ink[1];
      p[i + 2] = ink[2];
    }
    ctx.putImageData(data, 0, 0);
  }
  return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

const dataUrlBytes = (dataUrl: string) => {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Artwork for the light document, as PNG data URLs with their sizes. */
async function lightArtwork(invoice: Invoice) {
  const signature = isCustomSignature(invoice) ? (invoice.signatureImage as string) : BUILTIN_SIGNATURE;
  // Capped near print resolution: the logo prints at 28pt, and embedding the
  // 1584px original tripled the size of every HTML and Word export for nothing.
  const [logo, sig, seal] = await Promise.all([
    redrawImage(LOGO, undefined, 256),
    redrawImage(signature, undefined, 1000),
    redrawImage(BUILTIN_SEAL, undefined, 400),
  ]);
  return { logo, signature: sig, seal };
}

async function buildBlob(invoice: Invoice, format: ExportFormat): Promise<Blob> {
  if (format === "pdf") {
    const [{ pdf }, { InvoiceDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/pdf/invoice-document"),
    ]);
    const doc = createElement(InvoiceDocument, { invoice, variant: "light" });
    return pdf(doc as unknown as ReactElement<DocumentProps>).toBlob();
  }

  const art = await lightArtwork(invoice);

  if (format === "html") {
    const { invoiceToHtml } = await import("./html");
    const html = invoiceToHtml(invoice, { logo: art.logo.dataUrl, signature: art.signature.dataUrl, seal: art.seal.dataUrl });
    return new Blob([html], { type: "text/html;charset=utf-8" });
  }

  const [{ Packer }, { buildInvoiceDocx }, regular, medium] = await Promise.all([
    import("docx"),
    import("./docx"),
    fetchBlob("/fonts/Inter-Regular.ttf").then((b) => b.arrayBuffer()),
    fetchBlob("/fonts/Inter-Medium.ttf").then((b) => b.arrayBuffer()),
  ]);
  const image = (a: { dataUrl: string; width: number; height: number }) => ({
    data: dataUrlBytes(a.dataUrl),
    type: "png" as const,
    width: a.width,
    height: a.height,
  });
  const doc = buildInvoiceDocx(
    invoice,
    { logo: image(art.logo), signature: image(art.signature), seal: image(art.seal) },
    { regular: new Uint8Array(regular), medium: new Uint8Array(medium) },
  );
  return Packer.toBlob(doc);
}

/** Builds the invoice in the given format and downloads it. */
export async function exportInvoice(invoice: Invoice, format: ExportFormat): Promise<void> {
  const blob = await buildBlob(invoice, format);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(invoice, format);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a moment to start before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The light PDF as an object URL, for the preview screen. */
export async function lightPdfUrl(invoice: Invoice): Promise<string> {
  return URL.createObjectURL(await buildBlob(invoice, "pdf"));
}

/** Reads a blob as a data URL; re-exported for callers holding a Blob. */
export { blobToDataUrl };
