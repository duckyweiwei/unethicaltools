// Proof: run the PDF importer end-to-end (pdf.js extraction -> deterministic
// parser) on the generated samples and assert it produces the expected domain
// model. This is the milestone-1 gate — the parser before any UI.
//
//   node scripts/gen-sample-pdfs.mjs && npx tsx scripts/parse-sample.mts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pdfImporter } from "../lib/importers/pdf/index";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "samples");

const expectations: Record<string, { count: number; corrects: (string | null)[] }> = {
  "standard.pdf": { count: 3, corrects: ["B", "C", "B"] },
  "asterisk.pdf": { count: 3, corrects: ["B", "A", "C"] },
  "inline.pdf": { count: 3, corrects: ["C", "B", "D"] },
  "answerkey.pdf": { count: 3, corrects: ["B", "D", "A"] },
  "twocolumn.pdf": { count: 4, corrects: ["B", "A", "A", "C"] },
};

let failures = 0;

for (const [file, exp] of Object.entries(expectations)) {
  const data = new Uint8Array(readFileSync(join(dir, file)));
  const quiz = await pdfImporter.parse({ data, filename: file });
  const got = quiz.questions.map((q) => q.correct);
  const ok =
    quiz.questions.length === exp.count && JSON.stringify(got) === JSON.stringify(exp.corrects);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${file.padEnd(15)} title="${quiz.title}"  q=${quiz.questions.length}/${exp.count}  correct=${JSON.stringify(got)} exp=${JSON.stringify(exp.corrects)}`,
  );
  if (!ok) {
    for (const q of quiz.questions) {
      console.log(
        `   #${q.number} conf=${q.confidence} correct=${q.correct} opts=[${q.options
          .map((o) => o.label)
          .join("")}] stem="${q.stem.slice(0, 64)}" flags=${JSON.stringify(q.flags)}`,
      );
    }
  }
}

// Print the full domain model for one file to show the produced shape.
const quiz = await pdfImporter.parse({
  data: new Uint8Array(readFileSync(join(dir, "standard.pdf"))),
  filename: "standard.pdf",
});
console.log("\n--- domain model (standard.pdf) ---");
console.log(JSON.stringify(quiz, null, 2));

if (failures) {
  console.error(`\n${failures} file(s) failed`);
  process.exit(1);
}
console.log("\nAll sample files parsed as expected.");
