/**
 * Verification: confirm running headers/footers are stripped from the
 * deterministic parse, without dropping any genuine question.
 *
 *   npx tsx scripts/check-headers.mts
 *
 * Checks both IB Biology papers:
 *   - Q22 stem and Q30 option D come out clean (no "8825 6007" page code).
 *   - All 40 questions parse (40 kept, 0 skipped).
 *   - No question stem/option/explanation contains the paper code (8825 / 6007).
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { extractPdf } from "../lib/importers/pdf/extract";
import { parseExtracted } from "../lib/importers/pdf/parser/index";

const PAPERS = [
  "/Users/weihaofu/Desktop/Biology_paper_1A_TZ1_HL.pdf",
  "/Users/weihaofu/Desktop/Biology_paper_1A_TZ3_HL.pdf",
];

// Furniture that must never leak into question content:
//  - the paper code (8825 / 6007 [TZ1] / 6019 [TZ3]); every running header is
//    "– NN – <code>", so the code's absence also proves the page number is gone.
//  - the "Turn over" footer (capitalized two-word phrase, so the biology term
//    "turnover" is NOT flagged).
// (A bare "– NN –" content scan was tried and removed: it false-matches genuine
// dashed numbers — DOIs like "s00114-009-0604-z", data ranges — not furniture.)
const CONTAM_RES: Array<[string, RegExp]> = [
  ["paper-code", /8825|6007|6019/],
  ["turn-over-footer", /\bTurn\s+over\b/],
];

let anyFail = false;

for (const path of PAPERS) {
  const filename = basename(path);
  const data = new Uint8Array(await readFile(path));
  const doc = await extractPdf(data);
  const quiz = parseExtracted(doc, { type: "pdf", filename });
  const qs = quiz.questions;
  const skipped = quiz.skipped ?? [];

  console.log(`\n================ ${filename} ================`);
  console.log(`pages=${doc.pages} lines=${doc.lines.length} kept=${qs.length} skipped=${skipped.length}`);

  // Contamination scan across ALL question content.
  const contaminated: string[] = [];
  for (const q of qs) {
    const blob = [q.stem, ...q.options.map((o) => o.text), q.explanation ?? "", q.answerText ?? ""].join(" ");
    const hits = CONTAM_RES.filter(([, re]) => re.test(blob)).map(([name]) => name);
    if (hits.length) contaminated.push(`Q${q.number} [${hits.join(",")}]: ${blob.slice(0, 120)}`);
  }

  const find = (n: number) => qs.find((q) => q.number === n);
  const q22 = find(22);
  const q30 = find(30);
  console.log(`\n-- Q22 --`);
  console.log(`  stem: ${JSON.stringify(q22?.stem)}`);
  q22?.options.forEach((o) => console.log(`   ${o.label}) ${JSON.stringify(o.text)}`));
  console.log(`-- Q30 --`);
  console.log(`  stem: ${JSON.stringify(q30?.stem)}`);
  q30?.options.forEach((o) => console.log(`   ${o.label}) ${JSON.stringify(o.text)}`));

  if (contaminated.length) {
    anyFail = true;
    console.log(`\n  !! CONTAMINATED (${contaminated.length}):`);
    for (const c of contaminated) console.log(`     ${c}`);
  } else {
    console.log(`\n  OK: no paper-code contamination in any question.`);
  }

  if (qs.length !== 40 || skipped.length !== 0) {
    anyFail = true;
    console.log(`  !! EXPECTED 40 kept / 0 skipped, got ${qs.length} kept / ${skipped.length} skipped`);
    for (const s of skipped) console.log(`     skipped Q${s.number}: ${s.reason} :: ${s.stem.slice(0, 80)}`);
  } else {
    console.log(`  OK: 40 kept / 0 skipped.`);
  }
}

console.log(anyFail ? "\nRESULT: FAIL" : "\nRESULT: PASS");
process.exit(anyFail ? 1 : 0);
