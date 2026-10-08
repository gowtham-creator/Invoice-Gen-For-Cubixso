"use client";

/**
 * The editor's groups for a payment receipt: what was received, how, and
 * against which invoice. The rest of a receipt (who paid, notes, your details,
 * signature, appearance) is the invoice editor's own groups, reused.
 *
 * There is no switch between a receipt and an invoice. They are numbered in
 * separate series, so converting one into the other would either leave a gap
 * in the invoice series or put a receipt number on an invoice.
 */

import type { Invoice, PaymentMode, ReceiptDetails } from "@/lib/invoice-types";
import { CURRENCIES, currencyOf, formatMoney } from "@/lib/currency";
import { receiptBalance } from "@/lib/invoice-math";
import { PAYMENT_MODES, nonNegative, receiptOf, retypeAgainstInvoice } from "@/lib/defaults";
import { getInvoice } from "@/lib/storage";
import { Field, Group, Label, Row, Select } from "./controls";
import { MoneyInput } from "./money-input";

type Props = { invoice: Invoice; set: (patch: Partial<Invoice>) => void };

function receiptState({ invoice, set }: Props) {
  const r = receiptOf(invoice);
  // Amounts are held at zero or more as they are typed: a minus sign would
  // print a negative sum, and "Minus …" in words, on a receipt.
  const setReceipt = (patch: Partial<ReceiptDetails>) => {
    const next = { ...r, ...patch };
    set({
      receipt: {
        ...next,
        amountMinor: nonNegative(next.amountMinor),
        receivedEarlierMinor: nonNegative(next.receivedEarlierMinor),
        invoiceTotalMinor: next.invoiceTotalMinor !== null && next.invoiceTotalMinor > 0 ? next.invoiceTotalMinor : null,
      },
    });
  };
  // Retyping the invoice number of a receipt issued from an invoice keeps the
  // link only while the number still names that invoice.
  const setAgainstInvoice = (againstInvoice: string) => {
    const linked = r.againstInvoiceId ? (getInvoice(r.againstInvoiceId)?.invoice.number ?? null) : null;
    setReceipt(retypeAgainstInvoice(r, againstInvoice, linked));
  };
  return { r, setReceipt, setAgainstInvoice, c: currencyOf(invoice.currencyCode) };
}

export function ReceiptGroup(props: Props) {
  const { invoice, set } = props;
  const { r, setReceipt, c } = receiptState(props);
  return (
    <Group title="Receipt">
      <div className="space-y-3">
        <Row cols={3}>
          <Field label="Receipt no." value={invoice.number} onChange={(number) => set({ number })} mono />
          <Field label="Date received" type="date" value={invoice.issueDate} onChange={(issueDate) => set({ issueDate })} />
          <Select
            label="Currency"
            value={invoice.currencyCode}
            onChange={(currencyCode) => set({ currencyCode })}
            options={CURRENCIES.map((x) => ({ value: x.code, label: x.code }))}
          />
        </Row>
        <Row>
          <div className="min-w-0">
            <Label>Amount received</Label>
            <MoneyInput
              ariaLabel="Amount received"
              valueMinor={r.amountMinor}
              currency={c}
              onChange={(amountMinor) => setReceipt({ amountMinor })}
            />
          </div>
          <Select
            label="Payment mode"
            value={r.mode}
            onChange={(mode) => setReceipt({ mode: mode as PaymentMode })}
            options={PAYMENT_MODES}
          />
        </Row>
        <Field
          label="Reference"
          value={r.reference}
          onChange={(reference) => setReceipt({ reference })}
          mono
          placeholder="UTR, transaction ID or cheque no."
        />
        <Field
          label="Towards"
          value={r.purpose}
          onChange={(purpose) => setReceipt({ purpose })}
          placeholder="Milestone 2 of 3: backend integration"
          hint="Completes “towards …” on the receipt. Leave empty to leave it out."
        />
      </div>
    </Group>
  );
}

export function AgainstInvoiceGroup(props: Props) {
  const { r, setReceipt, setAgainstInvoice, c } = receiptState(props);
  const b = receiptBalance(r);
  const standing =
    !r.againstInvoice.trim() || b.balanceMinor === null
      ? "Add the invoice number and total to print the balance."
      : b.excessMinor > 0
        ? `Received in excess: ${formatMoney(b.excessMinor, c)}.`
        : b.balanceMinor === 0
          ? "Paid in full."
          : `Balance due after this receipt: ${formatMoney(b.balanceMinor, c)}.`;
  return (
    <Group title="Against invoice">
      <div className="space-y-3">
        <Field
          label="Invoice no."
          value={r.againstInvoice}
          onChange={setAgainstInvoice}
          mono
          placeholder="Empty for an advance"
        />
        <Row>
          <div className="min-w-0">
            <Label>Invoice total</Label>
            {/* Optional: no total, no balance. Zero reads as "not given". */}
            <MoneyInput
              ariaLabel="Invoice total"
              valueMinor={r.invoiceTotalMinor ?? 0}
              currency={c}
              placeholder="Optional"
              onChange={(m) => setReceipt({ invoiceTotalMinor: m > 0 ? m : null })}
            />
          </div>
          <div className="min-w-0">
            <Label>Received earlier</Label>
            <MoneyInput
              ariaLabel="Received earlier"
              valueMinor={r.receivedEarlierMinor}
              currency={c}
              onChange={(receivedEarlierMinor) => setReceipt({ receivedEarlierMinor })}
            />
          </div>
        </Row>
        <p className="tnum text-[12px] leading-snug text-ink-3">{standing}</p>
      </div>
    </Group>
  );
}
