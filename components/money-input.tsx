"use client";

/**
 * A money field backed by integer minor units.
 *
 * The problem this solves: the invoice stores paise, but people type rupees,
 * and they type them one character at a time. Parsing on every keystroke and
 * writing the parsed value straight back turns "10." into "10" the instant the
 * dot is typed, so the decimal can never be entered. Typing "0.05" is worse —
 * each intermediate state rounds and fights the cursor.
 *
 * So the field keeps its own draft string while focused and only pushes parsed
 * values upward; when it loses focus the draft is dropped and the canonical
 * value is re-rendered. The invoice never holds a half-typed number, and the
 * user never has their keystrokes rewritten under them.
 */

import { useEffect, useRef, useState } from "react";
import { parseMoney, toMajorString, type Currency } from "@/lib/currency";

export function MoneyInput({
  valueMinor,
  currency,
  onChange,
  align = "right",
  placeholder,
  ariaLabel,
}: {
  valueMinor: number;
  currency: Currency;
  onChange: (minor: number) => void;
  align?: "left" | "right";
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = useRef(false);

  // When the currency changes underneath a focused field the draft would keep
  // showing digits parsed under the old decimal count. Drop it.
  useEffect(() => {
    if (!focused.current) setDraft(null);
  }, [currency.code, valueMinor]);

  const shown = draft ?? (valueMinor === 0 ? "" : toMajorString(valueMinor, currency));

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[11px] text-faint"
        aria-hidden
      >
        {currency.symbol}
      </span>
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        value={shown}
        placeholder={placeholder ?? "0"}
        onFocus={() => {
          focused.current = true;
          setDraft(valueMinor === 0 ? "" : toMajorString(valueMinor, currency));
        }}
        onBlur={() => {
          focused.current = false;
          setDraft(null);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseMoney(e.target.value, currency));
        }}
        className={`tnum w-full rounded-md border border-hairline bg-input py-1.5 pl-6 pr-2 text-[13px] text-ink placeholder:text-faint transition-colors duration-150 hover:border-hairline-bright focus:border-action focus:outline-none ${
          align === "right" ? "text-right" : ""
        }`}
      />
    </div>
  );
}

/**
 * A plain number field with the same draft behaviour, for quantities and
 * percentages. Same reasoning: "1." and "" are valid things to be holding
 * mid-edit and must not be normalised away.
 */
export function NumberInput({
  value,
  onChange,
  suffix,
  min = 0,
  max,
  step = 1,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(null);
  }, [value]);

  const shown = draft ?? String(value);

  const commit = (raw: string) => {
    setDraft(raw);
    const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n)) {
      onChange(min);
      return;
    }
    const clamped = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, n));
    onChange(clamped);
  };

  return (
    <div className="relative">
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        value={shown}
        step={step}
        onFocus={() => {
          focused.current = true;
          setDraft(String(value));
        }}
        onBlur={() => {
          focused.current = false;
          setDraft(null);
        }}
        onChange={(e) => commit(e.target.value)}
        className={`tnum w-full rounded-md border border-hairline bg-input py-1.5 pl-2 text-right text-[13px] text-ink transition-colors duration-150 hover:border-hairline-bright focus:border-action focus:outline-none ${
          suffix ? "pr-5" : "pr-2"
        }`}
      />
      {suffix ? (
        <span
          className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-faint"
          aria-hidden
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
