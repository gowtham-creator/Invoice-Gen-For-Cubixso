/**
 * Downloads the Inter TTFs the PDF renderer needs into public/fonts.
 *
 * @react-pdf/renderer embeds a real font file into every PDF it writes, and the
 * standard PDF base fonts (Helvetica et al.) are Latin-1 only — they cannot
 * encode U+20B9, the rupee sign. An Indian tax invoice that falls back to "Rs."
 * is not acceptable, so a Unicode font gets bundled.
 *
 * Inter is used because DESIGN.md names it as the open-source stand-in for
 * SF Pro, which is what the Cubixso brand is set in.
 *
 * The source is deliberately the upstream GitHub release rather than the
 * Fontsource CDN or the npm package: Google-Fonts-style *subsets* drop U+20B9
 * (the `latin` range stops at U+20AC, the euro), so a subset build renders every
 * rupee amount as a blank box. Only the unsubsetted upstream TTF carries it.
 * The script verifies the glyph is really there before accepting a file.
 *
 * Run once: `node scripts/get-fonts.mjs`. The TTFs are committed, so a clean
 * checkout builds with no network access.
 */

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const OUT = join(process.cwd(), "public", "fonts");
const ZIP_URL = "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip";

// Weights matched to the type scale: 400 body, 500 labels, 600 subheads,
// 700 the invoice total.
const WANTED = {
  "Inter-Regular.ttf": "Regular",
  "Inter-Medium.ttf": "Medium",
  "Inter-SemiBold.ttf": "SemiBold",
  "Inter-Bold.ttf": "Bold",
};

/**
 * Walks the TTF's cmap to confirm a codepoint is mapped.
 *
 * Worth the parsing: a subsetted font is byte-for-byte valid and loads fine,
 * it just silently renders ₹ as nothing. Checking the glyph is the only way to
 * tell the two apart, and catching it here beats discovering it on a sent
 * invoice.
 */
function hasCodepoint(buf, cp) {
  const numTables = buf.readUInt16BE(4);
  let cmapOff = 0;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString("ascii", rec, rec + 4) === "cmap") {
      cmapOff = buf.readUInt32BE(rec + 8);
      break;
    }
  }
  if (!cmapOff) return false;

  const nSub = buf.readUInt16BE(cmapOff + 2);
  for (let i = 0; i < nSub; i++) {
    const sub = cmapOff + 4 + i * 8;
    const off = cmapOff + buf.readUInt32BE(sub + 4);
    const format = buf.readUInt16BE(off);

    if (format === 4) {
      const segX2 = buf.readUInt16BE(off + 6);
      const ends = off + 14;
      const starts = ends + segX2 + 2;
      for (let s = 0; s < segX2; s += 2) {
        if (cp <= buf.readUInt16BE(ends + s) && cp >= buf.readUInt16BE(starts + s)) return true;
      }
    } else if (format === 12) {
      const nGroups = buf.readUInt32BE(off + 12);
      for (let g = 0; g < nGroups; g++) {
        const rec = off + 16 + g * 12;
        if (cp >= buf.readUInt32BE(rec) && cp <= buf.readUInt32BE(rec + 4)) return true;
      }
    }
  }
  return false;
}

async function allPresent() {
  for (const name of Object.keys(WANTED)) {
    try {
      const p = join(OUT, name);
      if ((await stat(p)).size < 1000) return false;
      if (!hasCodepoint(await readFile(p), 0x20b9)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

await mkdir(OUT, { recursive: true });

if (await allPresent()) {
  console.log("fonts present and carry U+20B9 — nothing to do");
  process.exit(0);
}

console.log(`downloading ${ZIP_URL}`);
const res = await globalThis.fetch(ZIP_URL, { redirect: "follow" });
if (!res.ok) throw new Error(`download failed: ${res.status}`);

const zipPath = join(tmpdir(), "inter-src.zip");
await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));

const listing = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).split("\n");

for (const [local, weight] of Object.entries(WANTED)) {
  // The release ships several families; take the plain `Inter-<Weight>.ttf`
  // static, not InterDisplay or the variable build.
  const match = listing.find((f) => f.endsWith(`/Inter-${weight}.ttf`) || f === `Inter-${weight}.ttf`);
  if (!match) {
    console.error(`FAIL ${local}: not found in archive`);
    process.exitCode = 1;
    continue;
  }
  const buf = execFileSync("unzip", ["-p", zipPath, match], { maxBuffer: 64 * 1024 * 1024 });
  if (!hasCodepoint(buf, 0x20b9)) {
    console.error(`FAIL ${local}: ${match} has no U+20B9`);
    process.exitCode = 1;
    continue;
  }
  await writeFile(join(OUT, local), buf);
  console.log(`got  ${local} <- ${match} (${(buf.length / 1024).toFixed(0)} KB, ₹ ok)`);
}
