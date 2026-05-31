/**
 * Deep inspection of a real PDF: dump lines to a file, search for answer-key
 * encodings, and analyze per-option fonts (to see if the correct answer is
 * distinguishable by a bold/alternate font WITHIN this document).
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { getDocumentProxy } from "unpdf";

const path = process.argv[2] ?? "/Users/weihaofu/Desktop/Practice_Final_2_answ.pdf";
const data = new Uint8Array(await readFile(path));
const pdf = await getDocumentProxy(data);

type W = { str: string; x: number; y: number; font: string; h: number };
const perPage: { page: number; words: W[] }[] = [];

for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);
  const vh = page.getViewport({ scale: 1 }).height;
  const content = await page.getTextContent();
  const words: W[] = [];
  for (const it of content.items as Array<Record<string, unknown>>) {
    const str = (it.str as string) ?? "";
    if (!str.trim()) continue;
    const tr = it.transform as number[];
    words.push({ str, x: tr[4], y: vh - tr[5], font: (it.fontName as string) ?? "?", h: Math.abs(tr[3]) || 10 });
  }
  perPage.push({ page: p, words });
}

// Group words into lines (simple y-tolerance) per page, preserving font of each word.
type Line = { page: number; y: number; text: string; fonts: string[] };
const lines: Line[] = [];
for (const { page, words } of perPage) {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  let cur: W[] = [];
  let refY: number | null = null;
  const flush = () => {
    if (!cur.length) return;
    const s = [...cur].sort((a, b) => a.x - b.x);
    lines.push({ page, y: s[0].y, text: s.map((w) => w.str).join(" ").replace(/\s+/g, " ").trim(), fonts: s.map((w) => w.font) });
    cur = [];
  };
  for (const w of sorted) {
    const tol = Math.max(2, w.h * 0.6);
    if (refY == null || Math.abs(w.y - refY) <= tol) { cur.push(w); refY = refY == null ? w.y : (refY + w.y) / 2; }
    else { flush(); cur = [w]; refY = w.y; }
  }
  flush();
}

// Dump to file.
const dump = lines.map((l, i) => `${String(i).padStart(3)} [p${l.page}] {${[...new Set(l.fonts)].join(",")}} :: ${JSON.stringify(l.text)}`).join("\n");
await writeFile("/tmp/doc-lines.txt", dump);
console.log("wrote /tmp/doc-lines.txt  (", lines.length, "lines )");

// Global font histogram.
const fontHist: Record<string, number> = {};
for (const l of lines) for (const f of l.fonts) fontHist[f] = (fontHist[f] ?? 0) + 1;
console.log("\nfont word-counts:", JSON.stringify(fontHist, null, 0));

// Option lines: "a. ..." / "A) ..." — dominant font per option.
const optRe = /^\s*(?:\(([A-Ha-h])\)|([A-Ha-h])[.)])\s+/;
const optDomFont: Record<string, number> = {};
const optByFont: Record<string, number> = {};
for (const l of lines) {
  if (!optRe.test(l.text)) continue;
  const counts: Record<string, number> = {};
  for (const f of l.fonts) counts[f] = (counts[f] ?? 0) + 1;
  const dom = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "?";
  optDomFont[dom] = (optDomFont[dom] ?? 0) + 1;
  optByFont[dom] = (optByFont[dom] ?? 0) + 1;
}
console.log("\nper-option DOMINANT font histogram:", JSON.stringify(optDomFont));

// Lines mentioning answers/keys/solutions.
console.log("\n--- lines matching answer/key/solution/correct ---");
lines.forEach((l, i) => {
  if (/\b(answer|answers|ans|key|solution|correct)\b/i.test(l.text)) console.log(i, `[p${l.page}]`, JSON.stringify(l.text.slice(0, 90)));
});

// Show a sample question's option fonts so we can eyeball bold detection.
console.log("\n--- option lines with their per-word fonts (first 14) ---");
let shown = 0;
for (const l of lines) {
  if (!optRe.test(l.text)) continue;
  console.log(`[p${l.page}] {${[...new Set(l.fonts)].join(",")}} ${JSON.stringify(l.text.slice(0, 70))}`);
  if (++shown >= 14) break;
}
