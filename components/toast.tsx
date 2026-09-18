"use client";

/**
 * Brief confirmations at the foot of the screen, with an optional action.
 *
 * Deleting an invoice uses the action as Undo rather than asking first: the
 * delete is immediate and reversible for a few seconds, which is faster for the
 * usual case and still safe for the mistaken one.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
  action?: { label: string; onClick: () => void };
}

const ToastCtx = createContext<((t: Omit<Toast, "id">) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);

  const show = useCallback((t: Omit<Toast, "id">) => {
    seq.current += 1;
    setToast({ ...t, id: seq.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-4 text-[12.5px] font-medium text-canvas shadow-[0_8px_24px_-8px_rgba(16,24,40,0.4)]"
            >
              {toast.tone === "error" ? (
                <AlertCircle size={14} className="shrink-0 text-[oklch(0.8_0.14_25)]" />
              ) : (
                <Check size={14} className="shrink-0 text-[oklch(0.82_0.13_155)]" />
              )}
              <span>{toast.message}</span>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    setToast(null);
                  }}
                  className="rounded-full px-3 py-1 text-[12px] font-semibold text-canvas underline-offset-2 transition-colors hover:bg-canvas/15"
                >
                  {toast.action.label}
                </button>
              ) : (
                <span className="w-2" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
