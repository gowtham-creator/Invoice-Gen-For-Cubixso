/**
 * Document tokens, taken from the Figma template the invoice is modelled on
 * (Free Invoice Template.fig), not invented. The template states its own rule:
 * "Everything is Inter and bound to text styles." Every value below was read
 * out of that file, including both colour modes: it ships "Minimal - Light"
 * and "Minimal - Dark" as the same layout under two palettes.
 *
 * Two things carry most of the look. The heaviest weight is Medium; there is
 * no bold anywhere, so hierarchy comes from size and tracking rather than
 * weight. And large figures are set Regular with negative tracking, which is
 * what makes the total read as confident rather than loud.
 *
 * The dark variant is for looking at the invoice on a dark screen. What gets
 * sent (downloads, exports, the preview screen) is always light: that is the
 * document the client files and prints.
 */

export type Variant = "light" | "dark";

export interface Palette {
  paper: string;
  /** Values, names, figures. */
  ink: string;
  /** Secondary values: "Subtotal", "Payable by …". */
  inkSoft: string;
  /** Labels, addresses, overlines, footer. */
  muted: string;
  /** Section dividers. */
  rule: string;
  /** Row dividers inside tables. */
  ruleSoft: string;
  /** The rule above the grand total. */
  ruleStrong: string;
  /** Artwork drawn for this paper: black marks vanish on a dark page. */
  logo: string;
  signature: string;
  seal: string;
}

export const PALETTES: Record<Variant, Palette> = {
  light: {
    paper: "#ffffff",
    ink: "#0a0a0a",
    inkSoft: "#242424",
    muted: "#494949",
    rule: "#e3e3e3",
    ruleSoft: "#eeeeee",
    ruleStrong: "#0a0a0a",
    logo: "/cubixso-logo.png",
    signature: "/signature.png",
    seal: "/seal.png",
  },
  dark: {
    paper: "#0a0a0a",
    ink: "#f5f5f5",
    inkSoft: "#cccccc",
    muted: "#949494",
    rule: "#292929",
    ruleSoft: "#1f1f1f",
    ruleStrong: "#f5f5f5",
    logo: "/cubixso-logo-light.png",
    signature: "/signature-light.png",
    seal: "/seal-light.png",
  },
};

/** The template is a true A4 with 40pt margins: a 515pt content column. */
export const PAGE_MARGIN = 40;

export const FONT = "Inter";

/** Tracking in points from the template's percentages, which scale with size. */
const track = (size: number, percent: number) => (size * percent) / 100;

/**
 * The template's text styles, one entry per role, coloured for a palette.
 * Sizes, weights and tracking are the template's own; the comment on each
 * names the layer it came from.
 */
export function typeFor(p: Palette) {
  return {
    /** Minimal masthead "INVOICE": Medium 11, +22%. */
    docTitle: { fontSize: 11, fontWeight: 500, letterSpacing: track(11, 22), color: p.muted, textTransform: "uppercase" },
    /** Editorial "No. INV-0042": Regular 10. */
    docNumber: { fontSize: 10, fontWeight: 400, color: p.ink },
    /** Editorial brand "STUDIO NOVA": Medium, +16%. */
    brand: { fontSize: 11, fontWeight: 500, letterSpacing: track(11, 16), color: p.ink, textTransform: "uppercase" },
    /** "BILLED TO", "INVOICE NO.", "PAYMENT DETAILS": Medium 7, +8%. */
    overline: { fontSize: 7, fontWeight: 500, letterSpacing: track(7, 8), color: p.muted, textTransform: "uppercase" },
    /** Table header "DESCRIPTION", "QTY": Medium 7.5, +8%. */
    tableHead: { fontSize: 7.5, fontWeight: 500, letterSpacing: track(7.5, 8), color: p.muted, textTransform: "uppercase" },
    /** "TOTAL DUE": Medium 7.5, +14%. */
    totalLabel: { fontSize: 7.5, fontWeight: 500, letterSpacing: track(7.5, 14), color: p.muted, textTransform: "uppercase" },
    /** Client name, line-item title: Medium 9.5. */
    name: { fontSize: 9.5, fontWeight: 500, color: p.ink },
    /** Quantities, rates, amounts: Regular 9.5. */
    figure: { fontSize: 9.5, fontWeight: 400, color: p.ink },
    /** Dates and other meta values: Regular 9. */
    value: { fontSize: 9, fontWeight: 400, color: p.ink },
    /** "Subtotal", "Payable by …": Regular 9. */
    subValue: { fontSize: 9, fontWeight: 400, color: p.inkSoft },
    /** Addresses, item detail, bank field names: Regular 8.5. */
    body: { fontSize: 8.5, fontWeight: 400, color: p.muted },
    /** Bank values: Regular 8.5 in ink. */
    bodyInk: { fontSize: 8.5, fontWeight: 400, color: p.ink },
    /** Footer: Regular 8. */
    caption: { fontSize: 8, fontWeight: 400, color: p.muted },
    /** Editorial grand total: Regular 44, −3%. */
    total: { fontSize: 44, fontWeight: 400, letterSpacing: track(44, -3), color: p.ink },
  } as const;
}

/**
 * Total figure size for a given amount.
 *
 * The template sets the total at 44pt for "$9,975.00". A crore-scale rupee
 * amount is five characters longer and would run out of the band at that size,
 * so long figures step down rather than overflow.
 */
export function totalSize(text: string): number {
  if (text.length <= 12) return 40;
  if (text.length <= 14) return 34;
  return 28;
}

/**
 * An accent that still reads on the dark page.
 *
 * Accents are chosen against white. On #0a0a0a the default Action Blue sinks
 * and "Ink" disappears outright, so the dark variant lifts the colour's
 * lightness to at least 62%, keeping its hue. DESIGN.md does the same for the
 * site: Action Blue on light, the brighter Sky Link Blue on dark.
 */
export function liftForDark(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  if (l >= 0.62) return hex;
  l = 0.62;
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
