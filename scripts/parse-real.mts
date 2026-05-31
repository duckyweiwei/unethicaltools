/**
 * Diagnostic: run the real importer against a real-world PDF and report how the
 * deterministic parser did, so we can see gaps before wiring the upload UI.
 *
 *   npx tsx scripts/parse-real.mts "/path/to/file.pdf"
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { extractPdf } from "../lib/importers/pdf/extract";
import { parseExtracted } from "../lib/importers/pdf/parser/index";

const path =
  process.argv[2] ?? "/Users/weihaofu/Desktop/Practice_Final_2_answ.pdf";

const buf = await readFile(path);
const data = new Uint8Array(buf);
const filename = basename(path);

const doc = await extractPdf(data);
const quiz = parseExtracted(doc, { type: "pdf", filename });

const qs = quiz.questions;
const withCorrect = qs.filter((q) => q.correct != null).length;
const flagged = qs.filter((q) => q.flags.length > 0);
const buckets = { "1.0": 0, "0.8-0.99": 0, "0.6-0.79": 0, "<0.6": 0 };
for (const q of qs) {
  if (q.confidence >= 1) buckets["1.0"]++;
  else if (q.confidence >= 0.8) buckets["0.8-0.99"]++;
  else if (q.confidence >= 0.6) buckets["0.6-0.79"]++;
  else buckets["<0.6"]++;
}

console.log("================ REAL PDF PARSE REPORT ================");
console.log("file:        ", filename);
console.log("pages:       ", doc.pages, " lines:", doc.lines.length);
console.log("title:       ", JSON.stringify(quiz.title));
console.log("questions:   ", qs.length);
console.log("with answer: ", withCorrect, `/ ${qs.length}`);
console.log("flagged:     ", flagged.length);
console.log("confidence:  ", JSON.stringify(buckets));
console.log("option counts:", JSON.stringify(
  qs.reduce<Record<number, number>>((m, q) => {
    m[q.options.length] = (m[q.options.length] ?? 0) + 1;
    return m;
  }, {}),
));

console.log("\n---- first 3 questions ----");
for (const q of qs.slice(0, 3)) {
  console.log(`\nQ${q.number} (conf ${q.confidence}) correct=${q.correct}`);
  console.log("  stem:", q.stem);
  for (const o of q.options) console.log(`   ${o.label}) ${o.text}`);
  if (q.explanation) console.log("  exp:", q.explanation);
  if (q.flags.length) console.log("  flags:", q.flags.join(" | "));
}

console.log("\n---- flagged questions ----");
for (const q of flagged.slice(0, 20)) {
  console.log(
    `Q${q.number} conf=${q.confidence} correct=${q.correct} opts=${q.options.length} :: ${q.stem.slice(0, 70)}`,
  );
  console.log("    flags:", q.flags.join(" | "));
}

console.log("\n---- first 50 extracted lines (raw) ----");
doc.lines.slice(0, 50).forEach((l, i) => {
  console.log(String(i).padStart(3), `[p${l.page} c${l.column}]`, JSON.stringify(l.text));
});
