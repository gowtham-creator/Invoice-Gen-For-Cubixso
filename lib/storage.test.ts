/**
 * Saved drafts must not pin stale defaults.
 *
 * A draft saved in the browser overrides defaults, so a value the user merely
 * inherited would otherwise stay wrong forever. Exercises the real load path
 * against a stubbed localStorage.
 *
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const DRAFT_KEY = "cubixso.invoice.draft.v1";

function stubStorage(seed: Record<string, unknown>) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    },
  };
}

test("a draft holding the old default phone number picks up the new one", async () => {
  stubStorage({ [DRAFT_KEY]: { seller: { name: "CUBIXSO Solutions Private Limited", phone: "+91 92469 01689" } } });
  const { loadDraft } = await import("./storage.ts");
  assert.equal(loadDraft()?.seller.phone, "+91 83745 63012");
});

test("a phone number the user typed themselves is kept", async () => {
  stubStorage({ [DRAFT_KEY]: { seller: { phone: "+91 99999 00000" } } });
  const { loadDraft } = await import("./storage.ts");
  assert.equal(loadDraft()?.seller.phone, "+91 99999 00000");
});

test("an old draft with no seal setting gets the seal", async () => {
  stubStorage({ [DRAFT_KEY]: { signatureImage: null } });
  const { loadDraft } = await import("./storage.ts");
  assert.equal(loadDraft()?.showStamp, true);
});
