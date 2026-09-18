"use client";

/**
 * The editor column.
 *
 * Ordered the way an invoice is actually filled in — what kind of document,
 * who it is for, what is being billed, how to pay — rather than grouped by data
 * type. The fields the user changes every time sit at the top; the ones that
 * are right by default (seller details, bank, appearance) sit below, present
 * but out of the way.
 */

import { useRef } from "react";
import { Upload, RotateCcw, PenLine } from "lucide-react";
import type { BankDetails, Invoice, Party } from "@/lib/invoice-types";
import { CURRENCIES, currencyOf } from "@/lib/currency";
import { computeTotals, effectivePlaceOfSupply } from "@/lib/invoice-math";
import {
  BANK_PROFILES, BUILTIN_SEAL, CUBIXSO_SELLER, CUBIXSO_THUB_ADDRESS, INDIAN_STATES,
  formatPlaceOfSupply, signatureSrc,
} from "@/lib/defaults";
import { Button, Field, Label, Row, Section, Segmented, Select, TextArea, Toggle } from "./controls";
import { LineItemsEditor } from "./line-items";

const ACCENTS = [
  { name: "Action Blue", hex: "#0066cc" },
  { name: "Ink", hex: "#1d1d1f" },
  { name: "Deep Teal", hex: "#0a7a6f" },
  { name: "Oxblood", hex: "#8c2f39" },
  { name: "Slate", hex: "#4a5568" },
];

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
  // Only an upload counts as a replacement; see signatureSrc.
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
    { value: "", label: "Select state…" },
    ...INDIAN_STATES.map((s) => ({ value: s.name, label: `${s.name} (${s.code})` })),
  ];

  return (
    <div className="pb-24">
      <Section title="Document">
        <div className="space-y-4">
          <Segmented
            value={invoice.kind}
            onChange={(kind) =>
              set({
                kind,
                // Switching to a non-GST document must actually zero the rates,
                // not just hide them, or the totals would still carry tax the
                // printed document does not show.
                items: invoice.items.map((i) => ({
                  ...i,
                  taxRatePercent: kind === "non-gst" ? 0 : i.taxRatePercent || 18,
                })),
              })
            }
            options={[
              { value: "gst", label: "GST Invoice" },
              { value: "non-gst", label: "Non-GST (0%)" },
            ]}
            hint={
              isGst
                ? "Prints a tax invoice: both GSTINs, place of supply, and a CGST/SGST or IGST breakdown."
                : "Prints a plain invoice at 0% GST, with no tax breakdown and no GSTIN required."
            }
          />

          <Row>
            <Field label="Invoice number" value={invoice.number} onChange={(number) => set({ number })} mono />
            <Select
              label="Currency"
              value={invoice.currencyCode}
              onChange={(currencyCode) => set({ currencyCode })}
              options={CURRENCIES.map((x) => ({ value: x.code, label: `${x.symbol}  ${x.code} — ${x.name}` }))}
            />
          </Row>

          {isGst && c.code !== "INR" ? (
            <p className="rounded-md border border-hairline bg-raised/50 px-3 py-2 text-[11px] leading-relaxed text-muted">
              Billing in {c.code} on a GST invoice. Exports of services are normally zero-rated —
              if this is an export, switch to Non-GST or set every line to 0%.
            </p>
          ) : null}

          <Row>
            <Field label="Issue date" type="date" value={invoice.issueDate} onChange={(issueDate) => set({ issueDate })} />
            <Field label="Due date" type="date" value={invoice.dueDate} onChange={(dueDate) => set({ dueDate })} />
          </Row>

          {isGst && (
            <Segmented
              label="Prices are"
              value={invoice.taxMode}
              onChange={(taxMode) => set({ taxMode })}
              options={[
                { value: "exclusive", label: "Exclusive of GST" },
                { value: "inclusive", label: "Inclusive of GST" },
              ]}
              hint={
                invoice.taxMode === "exclusive"
                  ? "GST is added on top of the unit price."
                  : "GST is already inside the unit price and is backed out of it."
              }
            />
          )}

          <Toggle
            label={`Round the total to the nearest ${c.symbol}1`}
            checked={invoice.roundOff}
            onChange={(roundOff) => set({ roundOff })}
          />
        </div>
      </Section>

      <Section title="Billed to">
        <div className="space-y-3">
          <Field label="Client name" value={invoice.buyer.name} onChange={(name) => setParty("buyer", { name })} placeholder="Acme Private Limited" />
          <TextArea
            label="Address"
            rows={3}
            value={invoice.buyer.address}
            onChange={(address) => setParty("buyer", { address })}
            placeholder={"Street, Area\nCity, State PIN\nCountry"}
          />
          <Row>
            <Select
              label="State"
              value={invoice.buyer.state}
              onChange={(state) => setParty("buyer", { state })}
              options={stateOptions}
            />
            {isGst ? (
              <Field label="Client GSTIN" value={invoice.buyer.gstin} onChange={(gstin) => setParty("buyer", { gstin })} mono placeholder="36AAAAA0000A1Z5" />
            ) : (
              <Field label="Client PAN" value={invoice.buyer.pan} onChange={(pan) => setParty("buyer", { pan })} mono />
            )}
          </Row>
          <Row>
            <Field label="Email" value={invoice.buyer.email} onChange={(email) => setParty("buyer", { email })} />
            <Field label="Phone" value={invoice.buyer.phone} onChange={(phone) => setParty("buyer", { phone })} />
          </Row>

          {isGst && (
            <Field
              label="Place of supply"
              value={invoice.placeOfSupply}
              onChange={(placeOfSupply) => set({ placeOfSupply })}
              placeholder={invoice.buyer.state || "Defaults to the client's state"}
              hint={
                totals.intraState
                  ? `Intra-state supply to ${formatPlaceOfSupply(effectivePlaceOfSupply(invoice)) || "Telangana"} — CGST + SGST.`
                  : `Inter-state supply to ${formatPlaceOfSupply(effectivePlaceOfSupply(invoice))} — IGST.`
              }
            />
          )}
        </div>
      </Section>

      <Section title="Line items">
        <LineItemsEditor invoice={invoice} onChange={(items) => set({ items })} />
      </Section>

      <Section title="Notes">
        <TextArea
          label="Anything the client should read"
          rows={5}
          value={invoice.notes}
          onChange={(notes) => set({ notes })}
          placeholder={"Milestone 2 of 3 — backend integration and QA sign-off.\nScope agreed on the call of 12 Sep.\nThanks for the work."}
          hint="Free text. Printed under the totals, exactly as typed."
        />
      </Section>

      <Section title="Payment details" aside={
        <div className="flex gap-1">
          {BANK_PROFILES.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => set({ bank: { ...p } })}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                invoice.bank.accountNumber === p.accountNumber
                  ? "bg-action text-white"
                  : "text-faint hover:bg-raised hover:text-ink"
              }`}
            >
              {p.bankName.split(" ")[0]}
            </button>
          ))}
        </div>
      }>
        <div className="space-y-3">
          <Toggle label="Show payment details on the invoice" checked={invoice.showBank} onChange={(showBank) => set({ showBank })} />
          {invoice.showBank && (
            <>
              <Field label="Payee name" value={invoice.bank.payeeName} onChange={(payeeName) => setBank({ payeeName })} />
              <Row>
                <Field label="Account number" value={invoice.bank.accountNumber} onChange={(accountNumber) => setBank({ accountNumber })} mono />
                <Field label="Account type" value={invoice.bank.accountType} onChange={(accountType) => setBank({ accountType })} />
              </Row>
              <Row>
                <Field label="Bank" value={invoice.bank.bankName} onChange={(bankName) => setBank({ bankName })} />
                <Field label="IFSC" value={invoice.bank.ifsc} onChange={(ifsc) => setBank({ ifsc })} mono />
              </Row>
              <Field label="Branch" value={invoice.bank.branch} onChange={(branch) => setBank({ branch })} />
              <Row>
                <Field label="SWIFT" value={invoice.bank.swift} onChange={(swift) => setBank({ swift })} mono hint="For inbound foreign payments." />
                <Field label="UPI ID" value={invoice.bank.upi} onChange={(upi) => setBank({ upi })} mono />
              </Row>
            </>
          )}
        </div>
      </Section>

      <Section title="Terms">
        <TextArea label="Terms and conditions" rows={4} value={invoice.terms} onChange={(terms) => set({ terms })} />
      </Section>

      <Section title="From" aside={
        <Button variant="quiet" onClick={() => set({ seller: { ...CUBIXSO_SELLER } })} title="Restore Cubixso defaults">
          <RotateCcw size={11} />
          Reset
        </Button>
      }>
        <div className="space-y-3">
          <Field label="Your company" value={invoice.seller.name} onChange={(name) => setParty("seller", { name })} />
          <TextArea label="Address" rows={3} value={invoice.seller.address} onChange={(address) => setParty("seller", { address })} />
          <div className="flex gap-1.5">
            <Button onClick={() => setParty("seller", { address: CUBIXSO_SELLER.address })}>WeWork RMZ Spire</Button>
            <Button onClick={() => setParty("seller", { address: CUBIXSO_THUB_ADDRESS })}>T-Hub Phase 2</Button>
          </div>
          <Row>
            <Field label="Your GSTIN" value={invoice.seller.gstin} onChange={(gstin) => setParty("seller", { gstin })} mono />
            <Field label="Your PAN" value={invoice.seller.pan} onChange={(pan) => setParty("seller", { pan })} mono />
          </Row>
          <Row>
            <Field label="Email" value={invoice.seller.email} onChange={(email) => setParty("seller", { email })} />
            <Field label="Phone" value={invoice.seller.phone} onChange={(phone) => setParty("seller", { phone })} />
          </Row>
          <Select
            label="Your state"
            value={invoice.seller.state}
            onChange={(state) => setParty("seller", { state })}
            options={stateOptions}
            hint="Supplies inside this state are CGST + SGST; anywhere else is IGST."
          />
        </div>
      </Section>

      <Section title="Signature">
        <div className="space-y-3">
          <Toggle label="Show signature block" checked={invoice.showSignature} onChange={(showSignature) => set({ showSignature })} />
          {invoice.showSignature && (
            <>
              <Toggle label="Show company seal" checked={invoice.showStamp} onChange={(showStamp) => set({ showStamp })} />
              <Field label="Signatory" value={invoice.signatoryName} onChange={(signatoryName) => set({ signatoryName })} />

              {/* Exactly what prints: the same resolver the PDF uses. */}
              <div className="flex items-center gap-3 rounded-md border border-hairline bg-paper p-3">
                {invoice.showStamp ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={BUILTIN_SEAL} alt="Company seal" className="h-14 w-14 shrink-0 object-contain" />
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureSrc(invoice)}
                  alt="Signature"
                  className="h-10 min-w-0 flex-1 object-contain object-right"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
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
                <Button onClick={() => fileRef.current?.click()}>
                  <Upload size={12} />
                  Use a different signature
                </Button>
                {customSignature ? (
                  <Button variant="quiet" onClick={() => set({ signatureImage: null })}>
                    <PenLine size={12} />
                    Back to my signature
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title="Appearance">
        <div className="space-y-4">
          <div>
            <Label>Accent colour</Label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.hex}
                  type="button"
                  title={a.name}
                  onClick={() => set({ accent: a.hex })}
                  className={`h-7 w-7 rounded-full transition-transform duration-200 hover:scale-110 ${
                    invoice.accent === a.hex ? "ring-2 ring-ink ring-offset-2 ring-offset-panel" : ""
                  }`}
                  style={{ background: a.hex, transitionTimingFunction: "var(--ease-out-quart)" }}
                />
              ))}
              <input
                type="color"
                aria-label="Custom accent colour"
                value={invoice.accent}
                onChange={(e) => set({ accent: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-hairline bg-input"
              />
            </div>
          </div>
          <div className="space-y-0.5">
            <Toggle label="Show logo and wordmark" checked={invoice.showLogo} onChange={(showLogo) => set({ showLogo })} />
            <Toggle label="Show amount in words" checked={invoice.showAmountInWords} onChange={(showAmountInWords) => set({ showAmountInWords })} />
          </div>
        </div>
      </Section>
    </div>
  );
}
