"use client";

/**
 * Line items, as a list you read rather than a grid of boxes you parse.
 *
 * Each item collapses to one row that says what it is and what it comes to:
 * the description, "2 × ₹1,10,000.00 · GST 18%", and the amount. That row is
 * the whole story for an item you are not editing, so a four-line invoice fits
 * on screen at a glance. Click a row and it opens in place with every field;
 * only one is open at a time, and a newly added item opens itself.
 *
 * The computed amount stays visible in both states. It is the fastest way to
 * catch a misplaced decimal without looking across at the preview.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Plus, Trash2 } from "lucide-react";
import type { Invoice, LineItem } from "@/lib/invoice-types";
import { computeTotals } from "@/lib/invoice-math";
import { currencyOf, formatMoney } from "@/lib/currency";
import { GST_RATES, emptyItem, newId } from "@/lib/defaults";
import { MoneyInput, NumberInput } from "./money-input";
import { Button, Label, Select, inputClass } from "./controls";

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Number(q.toFixed(3)));
}

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

  // A lone blank item is an invitation to fill it in, so it starts open.
  const first = invoice.items[0];
  const [openId, setOpenId] = useState<string | null>(
    invoice.items.length === 1 && first && !first.description.trim() ? first.id : null,
  );

  const patch = (id: string, changes: Partial<LineItem>) =>
    onChange(invoice.items.map((i) => (i.id === id ? { ...i, ...changes } : i)));

  const add = () => {
    const item = emptyItem(isGst ? 18 : 0);
    onChange([...invoice.items, item]);
    setOpenId(item.id);
  };

  const remove = (id: string) => {
    const next = invoice.items.filter((i) => i.id !== id);
    // Never leave the list empty: there would be nothing to preview and no
    // obvious way back to a first item.
    if (next.length === 0) {
      const item = emptyItem(isGst ? 18 : 0);
      onChange([item]);
      setOpenId(item.id);
      return;
    }
    onChange(next);
    setOpenId(null);
  };

  const duplicate = (item: LineItem) => {
    const at = invoice.items.findIndex((i) => i.id === item.id);
    const copy = { ...item, id: newId() };
    onChange([...invoice.items.slice(0, at + 1), copy, ...invoice.items.slice(at + 1)]);
    setOpenId(copy.id);
  };

  return (
    <div>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-field shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <AnimatePresence initial={false}>
          {invoice.items.map((item, idx) => {
            const line = totals.lines[idx];
            const open = openId === item.id;
            const amount = invoice.taxMode === "inclusive" ? line.totalMinor : line.taxableMinor;
            const title = item.description.split("\n")[0].trim();
            const meta = [
              `${formatQty(item.quantity)} × ${formatMoney(item.unitPriceMinor, c)}`,
              item.discountPercent > 0 ? `${item.discountPercent}% off` : null,
              isGst ? `GST ${item.taxRatePercent}%` : null,
              isGst && item.hsn.trim() ? `HSN ${item.hsn.trim()}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={open ? "bg-well/60" : undefined}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-well"
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] ${title ? "text-ink" : "text-ink-3"}`}>
                      {title || "New item"}
                    </span>
                    <span className="tnum mt-0.5 block truncate text-[12px] text-ink-3">{meta}</span>
                  </span>
                  <span className="tnum shrink-0 pt-px text-[13px] font-medium text-ink">
                    {formatMoney(amount, c)}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-3 px-3.5 pb-3.5"
                    >
                      <div>
                        <Label htmlFor={`desc-${item.id}`}>Description</Label>
                        <textarea
                          id={`desc-${item.id}`}
                          rows={2}
                          autoFocus={!item.description}
                          value={item.description}
                          placeholder="What are you billing for?"
                          onChange={(e) => patch(item.id, { description: e.target.value })}
                          className={`${inputClass} resize-y py-1.5 leading-relaxed`}
                        />
                      </div>

                      <div className="grid grid-cols-[1fr_1.6fr_1fr] gap-2.5">
                        <div>
                          <Label>Quantity</Label>
                          <NumberInput
                            ariaLabel={`Quantity for item ${idx + 1}`}
                            value={item.quantity}
                            onChange={(quantity) => patch(item.id, { quantity })}
                            step={0.5}
                          />
                        </div>
                        <div>
                          <Label>Unit price</Label>
                          <MoneyInput
                            ariaLabel={`Unit price for item ${idx + 1}`}
                            valueMinor={item.unitPriceMinor}
                            currency={c}
                            onChange={(unitPriceMinor) => patch(item.id, { unitPriceMinor })}
                          />
                        </div>
                        <div>
                          <Label>Discount</Label>
                          <NumberInput
                            ariaLabel={`Discount for item ${idx + 1}`}
                            value={item.discountPercent}
                            onChange={(discountPercent) => patch(item.id, { discountPercent })}
                            suffix="%"
                            max={100}
                          />
                        </div>
                      </div>

                      {isGst && (
                        <div className="grid grid-cols-2 gap-2.5">
                          <Select
                            label="GST rate"
                            value={item.taxRatePercent}
                            onChange={(v) => patch(item.id, { taxRatePercent: Number(v) })}
                            options={GST_RATES.map((r) => ({ value: r, label: `${r}%` }))}
                          />
                          <div>
                            <Label htmlFor={`hsn-${item.id}`}>HSN / SAC</Label>
                            <input
                              id={`hsn-${item.id}`}
                              value={item.hsn}
                              placeholder="998314"
                              onChange={(e) => patch(item.id, { hsn: e.target.value })}
                              className={`${inputClass} tnum h-8 pointer-coarse:h-10`}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1 pt-0.5">
                        <Button variant="ghost" size="sm" onClick={() => duplicate(item)}>
                          <Copy size={13} />
                          Duplicate
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(item.id)}>
                          <Trash2 size={13} />
                          Remove
                        </Button>
                        <span className="ml-auto">
                          <Button size="sm" onClick={() => setOpenId(null)}>
                            Done
                          </Button>
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="mt-2.5">
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus size={14} />
          Add item
        </Button>
      </div>
    </div>
  );
}
