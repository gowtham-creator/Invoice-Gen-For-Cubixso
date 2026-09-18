import type { Invoice } from "../lib/invoice-types";
import type { Variant } from "./theme";

/** A request to the PDF worker, and its answer, matched up by id. */
export interface RenderRequest {
  id: number;
  invoice: Invoice;
  variant: Variant;
  darkSignature?: string;
}

export type RenderResponse = { id: number; blob: Blob } | { id: number; error: string };
