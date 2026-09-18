"use client";

/**
 * The line-item editor.
 *
 * Laid out as a stack of blocks rather than a spreadsheet row per item. A row
 * would need seven columns inside a 520px panel, which means every field ends
 * up too narrow to read the number it holds. Giving the description its own
 * full-width line and demoting the numeric fields to a second row underneath
 * costs vertical space and buys legibility — the right trade when a typical
 * invoice has three or four lines, not fifty.
 *
 * The computed line amount is shown per item, read-only. It is the fastest way
 * to catch a misplaced decimal without scanning down to the total.
 */

import { AnimatePresence, motion } from "motion/react";
import { Plus, X, Copy } from "lucide-react";
import type { Invoice, LineItem } from "@/lib/invoice-types";
import { computeTotals } from "@/lib/invoice-math";
import { currencyOf, formatMoney } from "@/lib/currency";
import { GST_RATES, emptyItem, newId } from "@/lib/defaults";
import { MoneyInput, NumberInput } from "./money-input";
import { Button, Label } from "./controls";

export function LineItemsEditor({
  invoice,
  onChange,
}: {
  invoice: Invoice;
  onChange: (items: LineItem[]) => void;
}) {
  const c = currencyOf(invoice.currencyCode);
  const totals = computeTotals(invoice);
  const isGst = invoice.kind === "gst";

  const patch = (id: string, changes: Partial<LineItem>) =>
    onChange(invoice.items.map((i) => (i.id === id ? { ...i, ...changes } : i)));

  const remove = (id: string) => {
    const next = invoice.items.filter((i) => i.id !== id);
    // Never leave the table empty: an invoice with no lines has nothing to
    // preview, and the user would have to hunt for "add" to recover.
    onChange(next.length ? next : [emptyItem(isGst ? 18 : 0)]);
  };

  const duplicate = (item: LineItem) => {
    const at = invoice.items.findIndex((i) => i.id === item.id);
    const copy = { ...item, id: newId() };
    onChange([...invoice.items.slice(0, at + 1), copy, ...invoice.items.slice(at + 1)]);
  };

  return (
    <div>
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {invoice.items.map((item, idx) => {
            const line = totals.lines[idx];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-hairline bg-panel/60 p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <span className="tnum mt-2 w-5 shrink-0 text-[11px] text-faint">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <textarea
                      rows={2}
                      value={item.description}
                      placeholder="What are you billing for?"
                      onChange={(e) => patch(item.id, { description: e.target.value })}
                      className="w-full resize-y rounded-md border border-hairline bg-input px-2.5 py-1.5 text-[13px] leading-relaxed text-ink placeholder:text-faint transition-colors hover:border-hairline-bright focus:border-action focus:outline-none"
                    />
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        title="Duplicate line"
                        onClick={() => duplicate(item)}
                        className="rounded p-1 text-faint transition-colors hover:bg-raised hover:text-ink"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        title="Remove line"
                        onClick={() => remove(item.id)}
                        className="rounded p-1 text-faint transition-colors hover:bg-raised hover:text-alert"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="ml-7 grid grid-cols-12 gap-2">
                    {isGst && (
                      <div className="col-span-3">
                        <Label>HSN/SAC</Label>
                        <input
                          value={item.hsn}
                          placeholder="9983"
                          onChange={(e) => patch(item.id, { hsn: e.target.value })}
                          className="tnum w-full rounded-md border border-hairline bg-input px-2 py-1.5 text-[13px] text-ink placeholder:text-faint transition-colors hover:border-hairline-bright focus:border-action focus:outline-none"
                        />
                      </div>
                    )}
                    <div className={isGst ? "col-span-2" : "col-span-3"}>
                      <Label>Qty</Label>
                      <NumberInput
                        ariaLabel={`Quantity for line ${idx + 1}`}
                        value={item.quantity}
                        onChange={(quantity) => patch(item.id, { quantity })}
                        step={0.5}
                      />
                    </div>
                    <div className={isGst ? "col-span-4" : "col-span-5"}>
                      <Label>Unit price</Label>
                      <MoneyInput
                        ariaLabel={`Unit price for line ${idx + 1}`}
                        valueMinor={item.unitPriceMinor}
                        currency={c}
                        onChange={(unitPriceMinor) => patch(item.id, { unitPriceMinor })}
                      />
                    </div>
                    <div className={isGst ? "col-span-3" : "col-span-4"}>
                      <Label>Discount</Label>
                      <NumberInput
                        ariaLabel={`Discount percent for line ${idx + 1}`}
                        value={item.discountPercent}
                        onChange={(discountPercent) => patch(item.id, { discountPercent })}
                        suffix="%"
                        max={100}
                      />
                    </div>

                    {isGst && (
                      <div className="col-span-5">
                        <Label>GST rate</Label>
                        <select
                          aria-label={`GST rate for line ${idx + 1}`}
                          value={item.taxRatePercent}
                          onChange={(e) =>
                            patch(item.id, { taxRatePercent: Number(e.target.value) })
                          }
                          className="tnum w-full cursor-pointer appearance-none rounded-md border border-hairline bg-input px-2 py-1.5 text-[13px] text-ink transition-colors hover:border-hairline-bright focus:border-action focus:outline-none"
                        >
                          {GST_RATES.map((r) => (
                            <option key={r} value={r} className="bg-panel">
                              {r}%
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className={isGst ? "col-span-7" : "col-span-12"}>
                      <Label>Line amount</Label>
                      <div className="tnum flex h-[33px] items-center justify-end rounded-md border border-transparent px-2 text-[13px] font-medium text-ink">
                        {formatMoney(
                          invoice.taxMode === "inclusive" ? line.totalMinor : line.taxableMinor,
                          c,
                        )}
                        {isGst && line.taxMinor > 0 ? (
                          <span className="ml-1.5 text-[11px] font-normal text-faint">
                            + {formatMoney(line.taxMinor, c)} tax
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-3">
        <Button onClick={() => onChange([...invoice.items, emptyItem(isGst ? 18 : 0)])}>
          <Plus size={13} />
          Add line
        </Button>
      </div>
    </div>
  );
}
