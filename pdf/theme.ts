/**
 * Document tokens, taken from the Figma template the invoice is modelled on
 * (Free Invoice Template.fig, "Minimal - Light" and "Editorial - Light"), not
 * invented. The template states its own rule: "Everything is Inter and bound to
 * text styles." Every value below was read out of that file.
 *
 * Two things carry most of the look. The heaviest weight is Medium; there is
 * no bold anywhere, so hierarchy comes from size and tracking rather than
 * weight. And large figures are set Regular with negative tracking, which is
 * what makes the total read as confident rather than loud.
 */

/** Values, names, figures. */
export const INK = "#0a0a0a";
/** Secondary values: "Subtotal", "Payable by …". */
export const INK_SOFT = "#242424";
/** Labels, addresses, overlines, footer. */
export const MUTED = "#494949";
export const RULE = "#e2e2e2";
export const RULE_SOFT = "#eeeeee";

/** The template is a true A4 with 40pt margins: a 515pt content column. */
export const PAGE_MARGIN = 40;

export const FONT = "Inter";

/** Tracking in points from the template's percentages, which scale with size. */
const track = (size: number, percent: number) => (size * percent) / 100;

/**
 * The template's text styles, one entry per role. Sizes, weights, tracking
 * and colour are the template's own; the comment on each names the layer it
 * came from.
 */
export const TYPE = {
  /** Minimal masthead "INVOICE": Medium 11, +22%. */
  docTitle: { fontSize: 11, fontWeight: 500, letterSpacing: track(11, 22), color: MUTED, textTransform: "uppercase" },
  /** Editorial "No. INV-0042": Regular 10. */
  docNumber: { fontSize: 10, fontWeight: 400, color: INK },
  /** Editorial brand "STUDIO NOVA": Medium, +16%. */
  brand: { fontSize: 11, fontWeight: 500, letterSpacing: track(11, 16), color: INK, textTransform: "uppercase" },
  /** "BILLED TO", "INVOICE NO.", "PAYMENT DETAILS": Medium 7, +8%. */
  overline: { fontSize: 7, fontWeight: 500, letterSpacing: track(7, 8), color: MUTED, textTransform: "uppercase" },
  /** Table header "DESCRIPTION", "QTY": Medium 7.5, +8%. */
  tableHead: { fontSize: 7.5, fontWeight: 500, letterSpacing: track(7.5, 8), color: MUTED, textTransform: "uppercase" },
  /** "TOTAL DUE": Medium 7.5, +14%. */
  totalLabel: { fontSize: 7.5, fontWeight: 500, letterSpacing: track(7.5, 14), color: MUTED, textTransform: "uppercase" },
  /** Client name, line-item title: Medium 9.5. */
  name: { fontSize: 9.5, fontWeight: 500, color: INK },
  /** Quantities, rates, amounts: Regular 9.5. */
  figure: { fontSize: 9.5, fontWeight: 400, color: INK },
  /** Dates and other meta values: Regular 9. */
  value: { fontSize: 9, fontWeight: 400, color: INK },
  /** "Subtotal", "Payable by …": Regular 9. */
  subValue: { fontSize: 9, fontWeight: 400, color: INK_SOFT },
  /** Addresses, item detail, bank field names: Regular 8.5. */
  body: { fontSize: 8.5, fontWeight: 400, color: MUTED },
  /** Bank values: Regular 8.5 in ink. */
  bodyInk: { fontSize: 8.5, fontWeight: 400, color: INK },
  /** Footer: Regular 8. */
  caption: { fontSize: 8, fontWeight: 400, color: MUTED },
  /** Editorial grand total: Regular 44, −3%. */
  total: { fontSize: 44, fontWeight: 400, letterSpacing: track(44, -3), color: INK },
} as const;

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
