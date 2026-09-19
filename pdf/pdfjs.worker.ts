/**
 * pdf.js's parsing worker, used to draw invoices on tablets and phones (see
 * components/pdf-sheet.tsx). Imported through this entry so the bundler emits
 * and fingerprints it the same way it does pdf/render.worker.ts. The legacy
 * build runs on the older Safari an iPad may be stuck on.
 */
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
