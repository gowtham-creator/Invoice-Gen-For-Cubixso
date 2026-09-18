"use client";

/**
 * One dropdown menu, used everywhere a button opens a list of actions: the
 * export formats, the kinds of new invoice, the actions on an invoice row.
 * One implementation, so every menu opens, moves and closes the same way.
 *
 * Keyboard: Enter or Space opens and focuses the first item; the arrow keys,
 * Home and End move; Escape closes and returns focus to the button; Tab closes.
 * A click outside closes it too.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export type MenuItem =
  | { label: string; icon?: ReactNode; hint?: string; danger?: boolean; onSelect: () => void }
  | "separator";

export function Menu({
  trigger,
  items,
  align = "end",
  label,
}: {
  /** Renders the button; spread the props onto it. */
  trigger: (props: {
    id: string;
    onClick: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
  }) => ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  // The trigger is found by id rather than a ref: handing a ref-writing
  // callback into trigger() during render is something React cannot prove safe.
  const triggerId = useId();
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const actionable = items.map((it, i) => (it === "separator" ? -1 : i)).filter((i) => i >= 0);
  const focusItem = (i: number) => itemRefs.current[i]?.focus();

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) document.getElementById(triggerId)?.focus();
  }, [triggerId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    // Focus the first item once the panel is in the DOM.
    const t = requestAnimationFrame(() => focusItem(actionable[0]));
    return () => {
      document.removeEventListener("mousedown", onDown);
      cancelAnimationFrame(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onItemKey = (e: React.KeyboardEvent, i: number) => {
    const at = actionable.indexOf(i);
    if (e.key === "ArrowDown") { e.preventDefault(); focusItem(actionable[(at + 1) % actionable.length]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusItem(actionable[(at - 1 + actionable.length) % actionable.length]); }
    else if (e.key === "Home") { e.preventDefault(); focusItem(actionable[0]); }
    else if (e.key === "End") { e.preventDefault(); focusItem(actionable[actionable.length - 1]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
  };

  return (
    <div ref={wrap} className="relative">
      {trigger({
        id: triggerId,
        onClick: () => setOpen((v) => !v),
        onKeyDown: (e) => {
          if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); }
          if (e.key === "Escape" && open) { e.preventDefault(); close(); }
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": id,
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            className={`absolute top-full z-50 mt-1.5 min-w-[216px] rounded-lg border border-line bg-canvas p-1 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.22),0_2px_6px_rgba(16,24,40,0.06)] ${
              align === "end" ? "right-0" : "left-0"
            }`}
          >
            {items.map((it, i) =>
              it === "separator" ? (
                <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={it.label}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  type="button"
                  role="menuitem"
                  onKeyDown={(e) => onItemKey(e, i)}
                  onClick={() => {
                    close(false);
                    it.onSelect();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none transition-colors duration-100 focus-visible:outline-none ${
                    it.danger ? "text-danger hover:bg-danger/10 focus:bg-danger/10" : "text-ink hover:bg-well focus:bg-well"
                  }`}
                >
                  {it.icon ? <span className="flex size-4 shrink-0 items-center justify-center text-ink-3">{it.icon}</span> : null}
                  <span className="flex-1">{it.label}</span>
                  {it.hint ? <span className="text-[11px] text-ink-3">{it.hint}</span> : null}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
