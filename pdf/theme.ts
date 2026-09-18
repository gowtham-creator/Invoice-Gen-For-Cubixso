/**
 * Document tokens for the PDF.
 *
 * Taken from the Cubixso design system (DESIGN.md) rather than invented here:
 * near-black ink instead of pure black so the page reads photographic rather
 * than printed, one Action Blue carrying every accent, and hairlines that work
 * as rules rather than borders. The accent is a parameter because the user can
 * recolour a document, but everything else is fixed — a billing document should
 * look the same every time it lands in a client's inbox.
 */

export const INK = "#1d1d1f";
/** Secondary copy: addresses, table headers, captions. */
export const MUTED = "#6e6e73";
/** Fine print only — legal lines, footer. */
export const FAINT = "#8e8e93";
export const RULE = "#e0e0e0";
/** Barely-there rule for inside the totals ladder. */
export const RULE_SOFT = "#f0f0f0";
export const PARCHMENT = "#f5f5f7";
export const PAPER = "#ffffff";

/** A4 in PostScript points, which is the unit react-pdf lays out in. */
export const PAGE_MARGIN = 44;

export const FONT = "Inter";

/**
 * Apple's display sizes carry negative tracking; body text does not. Applying
 * it uniformly is the single most common way a type scale starts to look
 * generic, so the values are held here per-step instead.
 */
export const TRACK_DISPLAY = -0.6;
export const TRACK_TIGHT = -0.3;
/** Uppercase eyebrow labels need the opposite treatment — open, not tight. */
export const TRACK_EYEBROW = 0.9;
