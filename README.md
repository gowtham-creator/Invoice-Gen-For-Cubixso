# CUBIXSO Invoices

CUBIXSO Solutions Private Limited's own invoicing tool: GST and non-GST
invoices, in any of twelve currencies, as print-ready PDFs, Word files or web
pages.

**Live:** [invoice.cubixso.com](https://invoice.cubixso.com), signed-in owner only.

---

## Business view

### What it is for

Raising the invoices CUBIXSO sends its clients, in the company's own format,
with its registered particulars, bank details, authorised signature and seal
already on every page. Raising an invoice is filling in a client and what is
being billed; everything that should not change from one invoice to the next
does not have to be typed again.

It is an internal tool with one user. There is no sign-up, no client portal and
no per-seat pricing, because there is one seat.

### What it does

| Area | Capability |
|---|---|
| **Invoice kinds** | **Tax invoice (GST)**: both GSTINs, place of supply, HSN/SAC per line, and either CGST + SGST or IGST. **Invoice without GST**: 0% on every line, no tax breakdown. |
| **Tax** | Intra- or inter-state is worked out from the place of supply against the seller's state (Telangana), never picked from a menu. Prices can be exclusive of GST (added on top) or inclusive (backed out). Optional round-off to the nearest rupee. |
| **Currencies** | 12, each with its own grouping and decimals. Amounts in words in lakh/crore for Indian currencies and million/billion for the rest. |
| **Content** | Line items with quantity, rate, discount and per-line GST rate; free-text notes; payment terms; two bank profiles (Axis company current, SBI proprietor savings). |
| **Identity on the page** | Real logo, authorised signature and company seal on every invoice, plus a copyright line in the footer. |
| **Output** | Download as **PDF**, **Word (.docx)** or **HTML**. A full-screen preview shows the invoice exactly as the client will receive it. |
| **Records** | A home screen of past invoices: search by client or number, duplicate, delete with undo, and whether each one has been sent (downloaded) yet. Numbering carries on from the last invoice. |
| **Working comfort** | Light, dark and system themes; laid out for desktop, iPad and tablets; the invoice redraws beside the editor as you type. |

### Where the data lives, and what that means

Invoices are stored **in the browser on the device that created them**
(`localStorage`). Nothing is uploaded to a server or a database. Client names,
account numbers and GSTINs therefore never leave the machine, and no third
party holds a copy.

The consequences to plan around:

- **One device, one list.** Invoices made on the laptop are not on the iPad.
- **Clearing browser data deletes them.** So does a browser's private mode.
  The durable record of an invoice is the PDF you sent; keep those.
- **No shared access.** Only the owner signs in, by design.

If multi-device access or sharing ever matters more than keeping the data
local, the storage layer (`lib/storage.ts`) is the one place to change.

### Access and hosting

- **Sign-in:** a single Netlify Identity account holding the `owner` role.
  Netlify's CDN checks that role before it serves any page, so the invoicer
  never reaches a browser that has not signed in.
- **Hosting:** Netlify, built from the GitHub repository on every push.
- **Domain:** `invoice.cubixso.com`, DNS on Cloudflare.
- **Source:** `cubixso-organisation/Invoice-Gen-For-Cubixso` (private), mirrored
  at `gowtham-creator/Invoice-Gen-For-Cubixso`.

---

## Technical view

### Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), exported as a **static site** (`output: "export"`) |
| UI | React 19, TypeScript, Tailwind CSS v4, `motion` for animation, `lucide-react` icons |
| PDF | `@react-pdf/renderer` to produce, `pdfjs-dist` to draw the preview |
| Word | `docx` |
| Auth | Netlify Identity (`@netlify/identity`), CDN role-based redirects, one Identity event function |
| Tests | Node's test runner via `tsx` |

### How it fits together

```
 editor (React) ──400 ms debounce──▶ localStorage          (autosave)
       │
       └──debounced invoice──▶ Web Worker ──▶ PDF blob ──▶ pdf.js ──▶ canvas
                               (@react-pdf)                (preview beside the editor)

 Download ──▶ same worker, light theme ──▶ PDF   │  docx ──▶ .docx   │  html ──▶ .html

 request ──▶ Netlify CDN ── nf_jwt has role "owner"? ── yes ──▶ app
                                                    └─ no ───▶ /login/
```

### Design decisions

- **Money is integers.** Every amount is held in the currency's minor unit
  (paise, cents, whole yen). Floats never hold money: `0.1 + 0.2` on a line is
  how an invoice ends up a rupee off. Rounding happens once per line and once on
  the optional round-off. Derived parts come from the whole: CGST and SGST are
  `floor(tax/2)` and `tax - floor(tax/2)`, so they always sum back to the tax.
- **The preview is the real PDF**, made by the same component as the download,
  not an HTML lookalike that would eventually disagree with the file sent.
- **PDFs render in a Web Worker** (`pdf/render.worker.ts`), so typing never
  waits on layout and font subsetting. Measured while typing: 4 main-thread
  freezes (432 ms) before, none after; heap 98 MB before, 48 MB after.
- **The preview is drawn with pdf.js, not embedded.** A browser's PDF viewer
  frames the page in a backdrop that follows the browser, not the app's theme,
  and iPad Safari shows only page one of an embedded PDF. Drawn on a canvas, the
  sheet is themed and every page scrolls, everywhere.
- **Dark mode is a colour filter, not a second render.** Only the light PDF is
  ever produced; dark is `invert(0.961) hue-rotate(180deg)` on the GPU, which
  lands white paper exactly on `#0a0a0a`. A theme switch starts in the next
  frame instead of waiting ~250 ms for a new PDF. Downloads are always light.
- **Inter is embedded** because the standard PDF fonts cannot encode `₹`
  (U+20B9). `scripts/get-fonts.mjs` checks the glyph is in the font before
  accepting it.
- **Hash routing** (`#/`, `#/invoice/<id>`, `#/invoice/<id>/preview`), because a
  static export has no server to answer deep links.
- **Stored records are versioned.** `lib/storage.ts` migrates older saved
  invoices forward and repairs retired defaults (an old phone number, a missing
  signature) rather than leaving stale data on the page.

### Authentication

- `netlify.toml` serves every path only to a session whose signed `nf_jwt` holds
  the `owner` role, and sends everyone else to `/login/`. The sign-in page, the
  compiled code and the invoice artwork stay public; invoices are never on the
  server to protect.
- `netlify/functions/identity.mts` refuses sign-ups from any address but the
  owner's and grants that account the `owner` role automatically. Set
  `OWNER_EMAIL` on the site to change the address without a deploy.
- The sign-in page (`app/login/`) handles sign-in, invite acceptance and
  password reset, and follows the device's light or dark setting only.

### Project layout

```
app/                  shell, design tokens, the sign-in route
components/           editor, invoice list, preview, theme, sign-in
components/ui/        pasted design components (auth form, gradient bars, glass)
lib/                  money, GST engine, amounts in words, storage, auth rules
lib/export/           PDF, Word and HTML exporters and their shared data
pdf/                  the invoice document, its palette, the render workers
netlify/functions/    Identity event handler
public/               logo, signature, seal, Inter fonts
scripts/              font fetch and verification
```

Company particulars (registered office, CIN, GSTIN, bank profiles, signatory)
live in `lib/defaults.ts`. Every field is editable per invoice; these are
starting points.

### Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 36 tests
npm run typecheck
npm run lint
npm run build        # static site in out/
```

Locally there is no sign-in gate: the CDN rules only exist on Netlify, so the
app opens directly. Netlify Identity does not run locally; test sign-in on a
deploy.

### Tests

`npm test` covers the parts that must not drift:

- **Money** (`lib/invoice-math.test.ts`), checked against a real past invoice,
  #003 for Coltec, two panels at ₹1,10,000 with 18% GST, so the code fails the
  moment it disagrees with a document a client has already paid.
- **Storage** (`lib/storage.test.ts`): migration of older saved invoices,
  repair of retired defaults, numbering, duplication and deletion.
- **Defaults** (`lib/defaults.test.ts`): the signature cannot silently vanish.
- **Exports** (`lib/export/export.test.ts`): HTML and Word carry the same
  figures, the notes field is escaped against script injection, the Word file
  embeds its fonts and images, and every footer carries the copyright line.

### Deployment

Netlify builds on every push to `main`:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `out` |
| Node | 22 |
| `NETLIFY_NEXT_PLUGIN_SKIP` | `true` (static export, not a server build) |

DNS: a `CNAME` for `invoice` pointing at the Netlify site, set to **DNS only**
in Cloudflare so Netlify can renew its HTTPS certificate.
