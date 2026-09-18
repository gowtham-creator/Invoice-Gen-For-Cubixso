/**
 * The signature is permanent.
 *
 * Pins a real regression: drafts saved before the signature existed held
 * `signatureImage: null`, and because a saved draft overrides defaults, that
 * null kept the signature off the invoice after it shipped. It is now resolved
 * at render time, so these values must all still produce the real signature.
 *
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILTIN_SIGNATURE, signatureSrc } from "./defaults.ts";

test("a draft saved before the signature existed still prints it", () => {
  assert.equal(signatureSrc({ signatureImage: null }), BUILTIN_SIGNATURE);
});

test("file paths older drafts stored fall back to the signature", () => {
  // Earlier builds wrote paths here, including the stamp from the old
  // one-image slot. The seal is now its own element.
  assert.equal(signatureSrc({ signatureImage: "/signature.png" }), BUILTIN_SIGNATURE);
  assert.equal(signatureSrc({ signatureImage: "/cubixso-stamp.png" }), BUILTIN_SIGNATURE);
  assert.equal(signatureSrc({ signatureImage: "" }), BUILTIN_SIGNATURE);
});

test("only an uploaded image replaces the signature", () => {
  const upload = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(signatureSrc({ signatureImage: upload }), upload);
});
