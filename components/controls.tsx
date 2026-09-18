"use client";

/**
 * Form primitives for the editor chrome.
 *
 * Deliberately not cards. The editor is one long column of related settings,
 * and boxing each group would add ninety borders that mean nothing — the
 * grouping is carried by a hairline, a label and a change of rhythm instead.
 *
 * Every control here is uncontrolled-friendly: they take a value and an
 * onChange and hold no state, so the invoice object stays the single source of
 * truth and undo/reset never has to chase state hiding in a child.
 */

import { useId, type ReactNode } from "react";

const inputBase =
  "w-full rounded-md bg-input border border-hairline px-2.5 py-1.5 text-[13px] text-ink " +
  "placeholder:text-faint transition-colors duration-150 " +
  "hover:border-hairline-bright focus:border-action focus:outline-none " +
  "focus-visible:outline-2 focus-visible:outline-action-bright focus-visible:outline-offset-1";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] font-semibold uppercase tracking-[0.09em] text-faint mb-1.5"
    >
      {children}
    </label>
  );
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
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} ${mono ? "tnum" : ""}`}
      />
      {hint ? <p className="mt-1 text-[11px] leading-snug text-faint">{hint}</p> : null}
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
  hint?: string;
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
        className={`${inputBase} resize-y leading-relaxed`}
      />
      {hint ? <p className="mt-1 text-[11px] leading-snug text-faint">{hint}</p> : null}
    </div>
  );
}

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
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} cursor-pointer appearance-none bg-[length:10px] bg-[right_0.6rem_center] bg-no-repeat pr-7`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238a8a94' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value} className="bg-panel text-ink">
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-faint">{hint}</p> : null}
    </div>
  );
}

/**
 * Two-to-four mutually exclusive choices, shown all at once.
 *
 * Used instead of a dropdown wherever the options are the mode the user is
 * working in (GST vs non-GST, tax inclusive vs exclusive). A dropdown hides the
 * alternative and costs a click to discover; on a decision this consequential
 * the other option should be visible without asking.
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
  hint?: string;
}) {
  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      <div
        role="radiogroup"
        className="flex gap-0.5 rounded-lg bg-input border border-hairline p-0.5"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-[5px] px-2 py-1.5 text-[12px] font-medium transition-all duration-200 ${
                active
                  ? "bg-action text-white shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  : "text-muted hover:text-ink hover:bg-raised"
              }`}
              style={{ transitionTimingFunction: "var(--ease-out-quart)" }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-faint">{hint}</p> : null}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-3 py-1.5 text-left"
    >
      <span className="text-[13px] text-muted transition-colors group-hover:text-ink">{label}</span>
      <span
        className={`relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-action" : "bg-hairline-bright"
        }`}
        style={{ transitionTimingFunction: "var(--ease-out-quart)" }}
      >
        <span
          className="absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-white transition-transform duration-200"
          style={{
            transform: checked ? "translateX(12px)" : "translateX(0)",
            transitionTimingFunction: "var(--ease-out-expo)",
          }}
        />
      </span>
    </button>
  );
}

/** A titled run of controls, separated from its neighbours by a rule. */
export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="border-t border-hairline px-5 py-6 first:border-t-0">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">{title}</h2>
        {aside}
      </header>
      {children}
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

export function Button({
  children,
  onClick,
  variant = "ghost",
  title,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "quiet";
  title?: string;
  disabled?: boolean;
}) {
  const styles = {
    primary: "bg-action text-white hover:bg-action-bright disabled:bg-action-dim",
    ghost: "border border-hairline text-muted hover:text-ink hover:border-hairline-bright hover:bg-raised",
    quiet: "text-faint hover:text-ink",
  }[variant];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
      style={{ transitionTimingFunction: "var(--ease-out-quart)" }}
    >
      {children}
    </button>
  );
}
