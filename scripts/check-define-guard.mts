// Proof/guard for the monotonic-number guard in the PDF parser
// (lib/importers/pdf/parser/index.ts). The bug it fixes: a stem's numbered
// sub-enumeration ("Define the following: 1. … 2. … 3. …"), which PDF flattening
// drops onto separate lines, used to be torn into fake numbered questions.
//
// Central invariants proved here, by running the REAL parser over hand-built
// ExtractedDocs (no PDF needed):
//   1. a numbered sub-list under a prompt stays ONE block (not N fake items)
//   2. the main sequence resumes correctly afterward — even when the sub-list's
//      next index collides with the resumed question number (tie broken by the
//      resumed question carrying its own options)
//   3. a long sub-list that overflows past the prompt's own number is still held
//   4. ordinary sequential questions (with or without options) STILL split
//   5. numbering resets at section / answer-key boundaries
// Run:  npx tsx scripts/check-define-guard.mts
import type { ExtractedDoc } from "../lib/importers/pdf/extract";
import type { Quiz, QuizSource } from "../lib/domain/types";
import { parseExtracted } from "../lib/importers/pdf/parser/index";

let failures = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond && detail) console.log(`   ${detail}`);
}
function eq<T>(name: string, got: T, want: T) {
  ok(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const SRC: QuizSource = { type: "pdf", filename: "test.pdf" };

/** Build a minimal ExtractedDoc from plain text lines (one per array entry). */
function doc(lines: string[]): ExtractedDoc {
  return {
    pages: 1,
    text: lines.join("\n"),
    lines: lines.map((text, i) => ({ page: 1, column: 0, x: 0, y: i * 10, text, words: [] })),
  };
}
const parse = (lines: string[]): Quiz => parseExtracted(doc(lines), SRC);

// ---------------------------------------------------------------------------
// Case A — a "Define …" prompt mid-exam, its sub-items numbered 1/2/3, then a
// real MCQ resumes at 6. The prompt + sub-items stay one SKIPPED block; only
// the MCQ is imported.
// ---------------------------------------------------------------------------
{
  const quiz = parse([
    "5. Define each of the following terms:",
    "1. Mitosis",
    "2. Meiosis",
    "3. Osmosis",
    "6. Which organelle is the powerhouse of the cell?",
    "A) Nucleus",
    "B) Mitochondrion",
    "C) Ribosome",
    "Answer: B",
  ]);
  eq("A: exactly one MCQ imported", quiz.questions.length, 1);
  eq("A: the imported MCQ is the organelle question", quiz.questions[0]?.number ?? null, 6);
  eq("A: its answer is read", quiz.questions[0]?.correct ?? null, "B");
  eq("A: exactly one skipped block", quiz.skipped?.length ?? 0, 1);
  const sk = quiz.skipped?.[0];
  ok("A: skipped block keeps all three sub-items", !!sk && /Mitosis/.test(sk.stem) && /Meiosis/.test(sk.stem) && /Osmosis/.test(sk.stem), sk?.stem);
  ok("A: the MCQ did NOT leak into the skipped stem", !sk || !/powerhouse/i.test(sk.stem), sk?.stem);
}

// ---------------------------------------------------------------------------
// Case B — the TIE: sub-items reach index 3, so the next expected enum index is
// 4, and the resumed real question is ALSO numbered 4. The guard must still
// split it out because that line carries its own options.
// ---------------------------------------------------------------------------
{
  const quiz = parse([
    "5. Define each of the following terms:",
    "1. Mitosis",
    "2. Meiosis",
    "3. Osmosis",
    "4. Which organelle is the powerhouse of the cell?",
    "A) Nucleus",
    "B) Mitochondrion",
    "C) Ribosome",
    "Answer: B",
  ]);
  eq("B: exactly one MCQ imported (tie resolved by options)", quiz.questions.length, 1);
  eq("B: the imported MCQ is the organelle question", quiz.questions[0]?.number ?? null, 4);
  eq("B: it kept all three options", quiz.questions[0]?.options.length ?? 0, 3);
  eq("B: its answer is read", quiz.questions[0]?.correct ?? null, "B");
  const sk = quiz.skipped?.[0];
  ok("B: the MCQ did NOT merge into the define prompt", !sk || !/powerhouse/i.test(sk.stem), sk?.stem);
}

// Case B2 — same tie but the resumed line has NO options (a bare 4th sub-item),
// followed by the real resume at 6. The 4th item must be absorbed, not split.
{
  const quiz = parse([
    "5. Define each of the following terms:",
    "1. Mitosis",
    "2. Meiosis",
    "3. Osmosis",
    "4. Cytokinesis",
    "6. Which organelle is the powerhouse of the cell?",
    "A) Nucleus",
    "B) Mitochondrion",
    "Answer: B",
  ]);
  eq("B2: exactly one MCQ imported", quiz.questions.length, 1);
  eq("B2: it is the organelle question", quiz.questions[0]?.number ?? null, 6);
  const sk = quiz.skipped?.[0];
  ok("B2: the bare 4th sub-item was absorbed, not split", !!sk && /Cytokinesis/.test(sk.stem), sk?.stem);
  eq("B2: still just one skipped block", quiz.skipped?.length ?? 0, 1);
}

// ---------------------------------------------------------------------------
// Case C — a long sub-list whose indices OVERFLOW past the prompt's own number
// (prompt is #2, sub-list runs 1..5). All five stay held; the main sequence
// resumes at #3.
// ---------------------------------------------------------------------------
{
  const quiz = parse([
    "2. List five organelles found in a eukaryotic cell:",
    "1. Nucleus",
    "2. Mitochondrion",
    "3. Ribosome",
    "4. Endoplasmic reticulum",
    "5. Golgi apparatus",
    "3. Which process produces ATP?",
    "A) Glycolysis",
    "B) Cellular respiration",
    "C) Osmosis",
    "Answer: B",
  ]);
  eq("C: exactly one MCQ imported", quiz.questions.length, 1);
  eq("C: the imported MCQ is the ATP question", quiz.questions[0]?.number ?? null, 3);
  eq("C: exactly one skipped block", quiz.skipped?.length ?? 0, 1);
  const sk = quiz.skipped?.[0];
  ok("C: the overflow sub-list stays one block (first..last item)", !!sk && /Nucleus/.test(sk.stem) && /Golgi apparatus/.test(sk.stem), sk?.stem);
}

// ---------------------------------------------------------------------------
// Case D — ordinary sequential MCQs must STILL split into separate questions.
// ---------------------------------------------------------------------------
{
  const quiz = parse([
    "1. What is 2 + 2?",
    "A) 3",
    "B) 4",
    "2. What is the capital of France?",
    "A) Paris",
    "B) London",
    "3. Which is the largest planet?",
    "A) Earth",
    "B) Jupiter",
  ]);
  eq("D: three MCQs split out", quiz.questions.length, 3);
  eq("D: numbers preserved in order", quiz.questions.map((q) => q.number).join(","), "1,2,3");
}

// ---------------------------------------------------------------------------
// Case E — sequential SHORT-ANSWER prompts (no options) must stay SEPARATE:
// the guard absorbs only on a numbering RESET, never on a forward advance.
// ---------------------------------------------------------------------------
{
  const quiz = parse([
    "1. Define photosynthesis.",
    "2. Explain mitosis.",
    "3. Describe osmosis.",
  ]);
  eq("E: no MCQs (all short-answer)", quiz.questions.length, 0);
  eq("E: three separate skipped blocks (not merged)", quiz.skipped?.length ?? 0, 3);
  eq("E: numbers preserved", (quiz.skipped ?? []).map((s) => s.number).join(","), "1,2,3");
}

// ---------------------------------------------------------------------------
// Case F — numbering resets at a SECTION header: a second "1." in a new section
// must start a fresh question, not be misread as a sub-item of section A.
// ---------------------------------------------------------------------------
{
  const quiz = parse([
    "Section A: Multiple Choice",
    "1. What is 2 + 2?",
    "A) 3",
    "B) 4",
    "Section B: Multiple Choice",
    "1. What is the capital of France?",
    "A) Paris",
    "B) London",
  ]);
  eq("F: both sections' question #1 imported", quiz.questions.length, 2);
}

// ---------------------------------------------------------------------------
// Case G — an answer-key footer must not corrupt the sequence; keys still merge.
// ---------------------------------------------------------------------------
{
  const quiz = parse([
    "1. What is 2 + 2?",
    "A) 3",
    "B) 4",
    "2. What is the capital of France?",
    "A) Paris",
    "B) London",
    "Answer Key",
    "1. B",
    "2. A",
  ]);
  eq("G: exactly two MCQs (key rows not treated as questions)", quiz.questions.length, 2);
  eq("G: key merged onto Q1", quiz.questions[0]?.correct ?? null, "B");
  eq("G: key merged onto Q2", quiz.questions[1]?.correct ?? null, "A");
}

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
