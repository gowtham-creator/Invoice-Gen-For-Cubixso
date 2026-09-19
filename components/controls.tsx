"use client";

/**
 * The editor's component kit.
 *
 * The bar is earned familiarity: someone who lives in Stripe, Linear or the
 * macOS settings panes should sit down and trust every control without having
 * to learn it. So these are the standard shapes, done carefully, rather than
 * inventions: labels in sentence case, inputs that stay quiet until touched, a
 * macOS segmented control, an iOS-style switch. Every control has its hover,
 * focus, active and disabled states.
 *
 * All of them are controlled: value in, onChange out, no document state held
 * inside. The invoice object in the page stays the only source of truth.
 */

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";

/** The one input surface, shared so every field reads as the same object. */
export const inputClass =
  "w-full rounded-md border border-edge bg-field px-2.5 text-[13px] text-ink " +
  "placeholder:text-ink-3 shadow-[0_1px_1px_rgba(16,24,40,0.03)] " +
  "transition-[border-color,box-shadow] duration-150 " +
  "hover:border-edge-strong " +
  "focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15 " +
  "disabled:cursor-not-allowed disabled:bg-well disabled:text-ink-3";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-ink-2">
      {children}
    </label>
  );
}

function Hint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[12px] leading-snug text-ink-3">{children}</p>;
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} h-8 pointer-coarse:h-10 ${mono ? "tnum" : ""}`}
      />
      <Hint>{hint}</Hint>
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} resize-y py-1.5 leading-relaxed`}
      />
      <Hint>{hint}</Hint>
    </div>
  );
}

/**
 * A native select, styled as a macOS pop-up button. Native because the
 * platform's own list is faster to use and more accessible than any custom
 * one, and a currency or state list is exactly what it is for.
 */
export function Select<T extends string | number>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label?: string;
  value: T;
  onChange: (v: string) => void;
  options: { value: T; label: string }[];
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} h-8 pointer-coarse:h-10 cursor-pointer appearance-none truncate pr-8`}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
      </div>
      <Hint>{hint}</Hint>
    </div>
  );
}

/**
 * The macOS segmented control: a recessed track with a raised white thumb that
 * slides to the selection. Used for choices that define the document (tax
 * invoice or not, prices with or without GST), where every option should be
 * visible without opening anything.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: ReactNode;
}) {
  const thumbId = useId();
  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      <div role="radiogroup" className="flex rounded-lg bg-well p-[3px] ring-1 ring-line ring-inset">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`relative h-7 pointer-coarse:h-9 flex-1 rounded-md px-2 text-[12.5px] font-medium transition-colors duration-150 ${
                active ? "text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {active && (
                <motion.span
                  layoutId={thumbId}
                  className="absolute inset-0 rounded-md bg-raised shadow-[0_1px_2px_rgba(16,24,40,0.12),0_0_0_0.5px_rgba(16,24,40,0.06)]"
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
      <Hint>{hint}</Hint>
    </div>
  );
}

export function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-4 py-1.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[13px] text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-[12px] text-ink-3">{description}</span> : null}
      </span>
      <span
        className={`relative h-5 w-[34px] shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-accent" : "bg-edge group-hover:bg-edge-strong"
        }`}
      >
        <span
          className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.2)] transition-transform duration-200"
          style={{ transform: checked ? "translateX(14px)" : "none", transitionTimingFunction: "var(--ease-out)" }}
        />
      </span>
    </button>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-[0_1px_2px_rgba(16,24,40,0.15)] hover:bg-accent-strong active:translate-y-px disabled:bg-accent/50",
  secondary:
    "border border-edge bg-field text-ink shadow-[0_1px_1px_rgba(16,24,40,0.04)] hover:border-edge-strong hover:bg-well active:translate-y-px disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-well hover:text-ink active:bg-line disabled:text-ink-3",
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  title,
  disabled,
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  title?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 disabled:cursor-not-allowed ${
        size === "sm" ? "h-7 pointer-coarse:h-9 px-2.5 text-[12px]" : "h-8 pointer-coarse:h-10 px-3 text-[13px]"
      } ${buttonStyles[variant]}`}
    >
      {children}
    </button>
  );
}

/** An always-open group: a title and its controls. */
export function Group({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line px-5 py-5 first:border-t-0">
      <header className="mb-3.5 flex min-h-7 items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/**
 * A group that is usually set once and left alone: collapsed to a one-line
 * summary of what it holds, opened when needed.
 *
 * Height is not animated. Content fades and settles in instead, the way a
 * macOS disclosure behaves, so nothing below has to be pushed by an animation.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-well"
      >
        <span className="shrink-0 text-[13px] font-semibold text-ink">{title}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[12px] text-ink-3">{open ? null : summary}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-ink-3 transition-transform duration-200 group-hover:text-ink-2 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="px-5 pt-1 pb-5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}
