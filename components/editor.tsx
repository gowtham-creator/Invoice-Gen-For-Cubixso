"use client";

/**
 * The editor column.
 *
 * Ordered by how an invoice is filled in, and weighted by how often each part
 * changes. What is different on every invoice (the document, the client, the
 * items, the notes) stays open. What is set once and left alone (payment,
 * terms, your own details, signature, appearance) collapses to a one-line
 * summary of what it holds, so it is visible and checkable at a glance without
 * costing a screen of fields every time.
 */

import { useRef } from "react";
import { PenLine, RotateCcw, Upload } from "lucide-react";
import type { BankDetails, Invoice, Party } from "@/lib/invoice-types";
import { CURRENCIES, currencyOf } from "@/lib/currency";
import { computeTotals, effectivePlaceOfSupply } from "@/lib/invoice-math";
import {
  BANK_PROFILES, BUILTIN_SEAL, CUBIXSO_SELLER, CUBIXSO_THUB_ADDRESS, INDIAN_STATES,
  formatPlaceOfSupply, signatureSrc,
} from "@/lib/defaults";
import {
  Button, Disclosure, Field, Group, Label, Row, Segmented, Select, Switch, TextArea,
} from "./controls";
import { LineItemsEditor } from "./line-items";

const ACCENTS = [
  { name: "Cubixso blue", hex: "#0066cc" },
  { name: "Ink", hex: "#0a0a0a" },
  { name: "Teal", hex: "#0a7a6f" },
  { name: "Oxblood", hex: "#8c2f39" },
  { name: "Slate", hex: "#4a5568" },
];

/** Last four digits, the way an account is referred to in passing. */
function lastFour(acct: string): string {
  const d = acct.replace(/\s/g, "");
  return d.length > 4 ? `··${d.slice(-4)}` : d;
}

export function Editor({
  invoice,
  set,
}: {
  invoice: Invoice;
  set: (patch: Partial<Invoice>) => void;
}) {
  const isGst = invoice.kind === "gst";
  const c = currencyOf(invoice.currencyCode);
  const totals = computeTotals(invoice);
  const fileRef = useRef<HTMLInputElement>(null);
  // Only an upload counts as a replacement signature; see signatureSrc.
  const customSignature = invoice.signatureImage?.startsWith("data:") ?? false;

  const setParty = (which: "seller" | "buyer", patch: Partial<Party>) =>
    set({ [which]: { ...invoice[which], ...patch } } as Partial<Invoice>);
  const setBank = (patch: Partial<BankDetails>) => set({ bank: { ...invoice.bank, ...patch } });

  const readSignature = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => set({ signatureImage: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const stateOptions = [
    { value: "", label: "Select a state" },
    ...INDIAN_STATES.map((s) => ({ value: s.name, label: `${s.name} (${s.code})` })),
  ];

  // Which saved account the bank details match, if any. Editing a field makes
  // it "custom" rather than silently rewriting a saved account.
  const profileIndex = BANK_PROFILES.findIndex(
    (p) => p.accountNumber === invoice.bank.accountNumber && p.ifsc === invoice.bank.ifsc,
  );

  const pos = formatPlaceOfSupply(effectivePlaceOfSupply(invoice));

  return (
    <div>
      <Group title="Invoice">
        <div className="space-y-4">
          <Segmented
            value={invoice.kind}
            onChange={(kind) =>
              set({
                kind,
                // Switching to a non-GST invoice must actually zero the rates,
                // not just hide them, or the totals would still carry tax the
                // printed invoice does not show.
                items: invoice.items.map((i) => ({
                  ...i,
                  taxRatePercent: kind === "non-gst" ? 0 : i.taxRatePercent || 18,
                })),
              })
            }
            options={[
              { value: "gst", label: "Tax invoice" },
              { value: "non-gst", label: "Invoice, no GST" },
            ]}
            hint={
              isGst
                ? "Both GSTINs, place of supply, and CGST + SGST or IGST."
                : "GST at 0%. No tax breakdown and no GSTIN needed."
            }
          />

          <Row cols={3}>
            <Field label="Invoice no." value={invoice.number} onChange={(number) => set({ number })} mono />
            <Field label="Issue date" type="date" value={invoice.issueDate} onChange={(issueDate) => set({ issueDate })} />
            <Field label="Due date" type="date" value={invoice.dueDate} onChange={(dueDate) => set({ dueDate })} />
          </Row>

          <Row cols={isGst ? 2 : 1}>
            <Select
              label="Currency"
              value={invoice.currencyCode}
              onChange={(currencyCode) => set({ currencyCode })}
              options={CURRENCIES.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))}
            />
            {isGst && (
              <Segmented
                label="Prices"
                value={invoice.taxMode}
                onChange={(taxMode) => set({ taxMode })}
                options={[
                  { value: "exclusive", label: "Excl. GST" },
                  { value: "inclusive", label: "Incl. GST" },
                ]}
              />
            )}
          </Row>

          {isGst && c.code !== "INR" ? (
            <p className="rounded-md bg-accent-soft px-3 py-2 text-[12px] leading-relaxed text-ink-2">
              Billing in {c.code} on a tax invoice. Exports of services are normally zero-rated;
              if this is an export, switch to <span className="font-medium text-ink">Invoice, no GST</span>.
            </p>
          ) : null}

          <Switch
            label={`Round the total to the nearest ${c.symbol}1`}
            checked={invoice.roundOff}
            onChange={(roundOff) => set({ roundOff })}
          />
        </div>
      </Group>

      <Group title="Bill to">
        <div className="space-y-3">
          <Field label="Client" value={invoice.buyer.name} onChange={(name) => setParty("buyer", { name })} placeholder="Acme Private Limited" />
          <TextArea
            label="Address"
            rows={3}
            value={invoice.buyer.address}
            onChange={(address) => setParty("buyer", { address })}
            placeholder={"Street, area\nCity, state PIN\nCountry"}
          />
          <Row>
            <Select label="State" value={invoice.buyer.state} onChange={(state) => setParty("buyer", { state })} options={stateOptions} />
            {isGst ? (
              <Field label="GSTIN" value={invoice.buyer.gstin} onChange={(gstin) => setParty("buyer", { gstin })} mono placeholder="36AAAAA0000A1Z5" />
            ) : (
              <Field label="PAN" value={invoice.buyer.pan} onChange={(pan) => setParty("buyer", { pan })} mono />
            )}
          </Row>
          <Row>
            <Field label="Email" type="email" value={invoice.buyer.email} onChange={(email) => setParty("buyer", { email })} />
            <Field label="Phone" type="tel" value={invoice.buyer.phone} onChange={(phone) => setParty("buyer", { phone })} />
          </Row>
          {isGst && (
            <Field
              label="Place of supply"
              value={invoice.placeOfSupply}
              onChange={(placeOfSupply) => set({ placeOfSupply })}
              placeholder={invoice.buyer.state || "The client's state"}
              hint={
                totals.intraState
                  ? `Within ${pos || invoice.seller.state}: CGST + SGST.`
                  : `Outside ${invoice.seller.state}, to ${pos}: IGST.`
              }
            />
          )}
        </div>
      </Group>

      <Group title="Items">
        <LineItemsEditor invoice={invoice} onChange={(items) => set({ items })} />
      </Group>

      <Group title="Notes">
        <TextArea
          label="Printed under the totals, exactly as typed"
          rows={4}
          value={invoice.notes}
          onChange={(notes) => set({ notes })}
          placeholder={"Milestone 2 of 3: backend integration and QA sign-off.\nScope agreed on the call of 12 Sep."}
        />
      </Group>

      <Disclosure
        title="Payment"
        summary={invoice.showBank ? `${invoice.bank.bankName} ${lastFour(invoice.bank.accountNumber)}` : "Hidden"}
      >
        <div className="space-y-3">
          <Switch label="Show payment details" checked={invoice.showBank} onChange={(showBank) => set({ showBank })} />
          {invoice.showBank && (
            <>
              <Select
                label="Account"
                value={profileIndex >= 0 ? String(profileIndex) : "custom"}
                onChange={(v) => {
                  if (v !== "custom") set({ bank: { ...BANK_PROFILES[Number(v)] } });
                }}
                options={[
                  ...BANK_PROFILES.map((p, i) => ({ value: String(i), label: p.label })),
                  ...(profileIndex < 0 ? [{ value: "custom", label: "Custom (edited below)" }] : []),
                ]}
              />
              <Field label="Payee" value={invoice.bank.payeeName} onChange={(payeeName) => setBank({ payeeName })} />
              <Row>
                <Field label="Account no." value={invoice.bank.accountNumber} onChange={(accountNumber) => setBank({ accountNumber })} mono />
                <Field label="Account type" value={invoice.bank.accountType} onChange={(accountType) => setBank({ accountType })} />
              </Row>
              <Row>
                <Field label="Bank" value={invoice.bank.bankName} onChange={(bankName) => setBank({ bankName })} />
                <Field label="IFSC" value={invoice.bank.ifsc} onChange={(ifsc) => setBank({ ifsc })} mono />
              </Row>
              <Field label="Branch" value={invoice.bank.branch} onChange={(branch) => setBank({ branch })} />
              <Row>
                <Field label="SWIFT" value={invoice.bank.swift} onChange={(swift) => setBank({ swift })} mono hint="For payments from abroad." />
                <Field label="UPI ID" value={invoice.bank.upi} onChange={(upi) => setBank({ upi })} mono />
              </Row>
            </>
          )}
        </div>
      </Disclosure>

      <Disclosure title="Terms" summary={invoice.terms.split("\n")[0] || "None"}>
        <TextArea label="Terms and conditions" rows={4} value={invoice.terms} onChange={(terms) => set({ terms })} />
      </Disclosure>

      <Disclosure
        title="Your details"
        summary={isGst && invoice.seller.gstin ? `GSTIN ${invoice.seller.gstin}` : invoice.seller.name}
      >
        <div className="space-y-3">
          <Field label="Company" value={invoice.seller.name} onChange={(name) => setParty("seller", { name })} />
          <TextArea label="Address" rows={3} value={invoice.seller.address} onChange={(address) => setParty("seller", { address })} />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => setParty("seller", { address: CUBIXSO_SELLER.address })}>WeWork, RMZ Spire</Button>
            <Button size="sm" onClick={() => setParty("seller", { address: CUBIXSO_THUB_ADDRESS })}>T-Hub Phase 2</Button>
          </div>
          <Row>
            <Field label="GSTIN" value={invoice.seller.gstin} onChange={(gstin) => setParty("seller", { gstin })} mono />
            <Field label="PAN" value={invoice.seller.pan} onChange={(pan) => setParty("seller", { pan })} mono />
          </Row>
          <Row>
            <Field label="Email" type="email" value={invoice.seller.email} onChange={(email) => setParty("seller", { email })} />
            <Field label="Phone" type="tel" value={invoice.seller.phone} onChange={(phone) => setParty("seller", { phone })} />
          </Row>
          <Select
            label="State"
            value={invoice.seller.state}
            onChange={(state) => setParty("seller", { state })}
            options={stateOptions}
            hint="Supplies inside this state are CGST + SGST; anywhere else is IGST."
          />
          <Button variant="ghost" size="sm" onClick={() => set({ seller: { ...CUBIXSO_SELLER } })}>
            <RotateCcw size={13} />
            Restore CUBIXSO details
          </Button>
        </div>
      </Disclosure>

      <Disclosure
        title="Signature and seal"
        summary={invoice.showSignature ? `${invoice.signatoryName}${invoice.showStamp ? " · with seal" : ""}` : "Hidden"}
      >
        <div className="space-y-3">
          <Switch label="Show signature" checked={invoice.showSignature} onChange={(showSignature) => set({ showSignature })} />
          {invoice.showSignature && (
            <>
              <Switch label="Show company seal" checked={invoice.showStamp} onChange={(showStamp) => set({ showStamp })} />
              <Field label="Signatory" value={invoice.signatoryName} onChange={(signatoryName) => set({ signatoryName })} />

              {/* Exactly what prints, laid out as it prints: the same resolver
                  the PDF uses, with the seal beneath the signatory. */}
              <div className="flex flex-col items-end gap-2 rounded-lg border border-line bg-white px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signatureSrc(invoice)} alt="Signature" className="h-9 max-w-full object-contain" />
                <p className="w-full border-t border-line pt-1.5 text-right text-[12px] text-ink-2">
                  {invoice.signatoryName} · Authorised Signatory
                </p>
                {invoice.showStamp ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={BUILTIN_SEAL} alt="Company seal" className="size-20 self-center object-contain" />
                ) : null}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readSignature(f);
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} />
                  Use a different signature
                </Button>
                {customSignature ? (
                  <Button variant="ghost" size="sm" onClick={() => set({ signatureImage: null })}>
                    <PenLine size={13} />
                    Back to my signature
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </Disclosure>

      <Disclosure title="Appearance" summary={ACCENTS.find((a) => a.hex === invoice.accent)?.name ?? "Custom colour"}>
        <div className="space-y-4">
          <div>
            <Label>Accent colour</Label>
            <p className="-mt-1 mb-2.5 text-[12px] text-ink-3">Used for the “Tax invoice” title.</p>
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENTS.map((a) => {
                const active = invoice.accent === a.hex;
                return (
                  <button
                    key={a.hex}
                    type="button"
                    title={a.name}
                    aria-label={a.name}
                    aria-pressed={active}
                    onClick={() => set({ accent: a.hex })}
                    className={`size-6 rounded-full ring-offset-2 ring-offset-canvas transition-shadow duration-150 ${
                      active ? "ring-2 ring-ink" : "ring-1 ring-black/10 hover:ring-2 hover:ring-edge-strong"
                    }`}
                    style={{ background: a.hex }}
                  />
                );
              })}
              <label
                className="relative size-6 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/10 hover:ring-2 hover:ring-edge-strong"
                title="Custom colour"
              >
                <span
                  className="absolute inset-0"
                  style={{ background: "conic-gradient(#e11d48, #f59e0b, #10b981, #0ea5e9, #8b5cf6, #e11d48)" }}
                  aria-hidden
                />
                <input
                  type="color"
                  aria-label="Custom accent colour"
                  value={invoice.accent}
                  onChange={(e) => set({ accent: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>
          <div>
            <Switch label="Show logo" checked={invoice.showLogo} onChange={(showLogo) => set({ showLogo })} />
            <Switch label="Show amount in words" checked={invoice.showAmountInWords} onChange={(showAmountInWords) => set({ showAmountInWords })} />
          </div>
        </div>
      </Disclosure>
    </div>
  );
}
