"use client";

/**
 * Shows a rendered invoice PDF inside the sheet.
 *
 * Desktop browsers embed a PDF natively, and the native viewer is the most
 * faithful and the cheapest (it draws off the main thread), so they keep the
 * iframe. Tablets and phones cannot be trusted with one: iPad and iPhone
 * Safari draw only the first page of an embedded PDF and ignore the fit
 * setting, and Android shows nothing at all. There the pages are drawn with
 * pdf.js onto canvases sized to the sheet, so the invoice fits the width of
 * the screen and every page can be scrolled.
 */

import { useEffect, useRef, useState } from "react";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/** iPadOS reports itself as a Mac; its touch points give it away. */
function canEmbedPdf(): boolean {
  const ua = navigator.userAgent;
  const apple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  return navigator.pdfViewerEnabled === true && !apple && !android;
}

let lib: Promise<PdfJs> | null = null;

/** pdf.js, loaded on first use only: desktop browsers never download it. */
function loadPdfJs(): Promise<PdfJs> {
  lib ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerPort = new Worker(new URL("../pdf/pdfjs.worker.ts", import.meta.url), { type: "module" });
    return m;
  });
  return lib;
}

export function PdfSheet({ url, title }: { url: string; title: string }) {
  const [native] = useState(canEmbedPdf);
  return native ? (
    <iframe title={title} src={`${url}#toolbar=0&navpanes=0&view=Fit`} className="size-full" />
  ) : (
    <CanvasPages url={url} title={title} />
  );
}

function CanvasPages({ url, title }: { url: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  // Redraw when the sheet changes width: a rotated iPad, or the split view.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let live = true;
    let task: ReturnType<PdfJs["getDocument"]> | null = null;
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        if (!live) return;
        task = pdfjs.getDocument({ url });
        const doc = await task.promise;
        // Drawn at the screen's pixel density, capped at 2x: a Retina iPad
        // stays sharp without a 3x canvas per page.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const drawn: HTMLCanvasElement[] = [];
        for (let n = 1; n <= doc.numPages && live; n++) {
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: (width * dpr) / page.getViewport({ scale: 1 }).width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.display = "block";
          await page.render({ canvas, viewport }).promise;
          drawn.push(canvas);
        }
        // Swapped in only once every page is drawn, so an update never
        // flashes a blank sheet.
        if (live && pages.current) {
          pages.current.replaceChildren(...drawn);
          setFailed(null);
        }
        // The canvases keep their pixels; free the parsed document.
        const done = task;
        task = null;
        await done.destroy();
      } catch (e) {
        if (live) setFailed(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      live = false;
      void task?.destroy();
    };
  }, [url, width]);

  return (
    <div ref={box} role="img" aria-label={title} className="size-full overflow-y-auto overscroll-contain">
      {failed && (
        <div className="flex h-full items-center justify-center p-10 text-center text-[13px] text-ink-2">
          The invoice could not be drawn: {failed}
        </div>
      )}
      <div ref={pages} className="divide-y divide-black/10" />
    </div>
  );
}
