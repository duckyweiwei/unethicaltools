// Proof/guard for True/False question emission in the PDF parser
// (lib/importers/pdf/parser). A "True or False: …" prompt paired with a verdict —
// inline ("Answer: T"), a letter key ("1. F"), or a free-text key ("1. True") —
// is imported as a two-option `true_false` question (A = True, B = False) so it
// plays, edits, and grades through the existing MCQ machinery with no extra
// type-specific plumbing.
//
// Invariants proved here over the REAL parser (hand-built ExtractedDocs):
//   1. T/F + inline word answer ("Answer: True")  → true_false, correct A
//   2. T/F + inline letter answer ("Answer: F")    → true_false, correct B
//   3. T/F + answer key mixing letter ("1. F") and word ("2. T") rows
//   4. T/F + free-text key ("1. False") — NOT misread as the option letter "F"
//   5. lead-in variants: "True/False —", "T/F:" both detected
//   6. T/F with NO verdict stays skipped (nothing to grade — unchanged)
//   7. a 6-option MCQ whose answer is option "F" is NOT misread as True/False
//   8. "…is true or false…" mid-sentence is NOT a T/F lead-in
//   9. an explicit "A) True / B) False" item still parses as an MCQ (no regress)
//  10. true_false questions are clean: 2 options, correct set, confidence 1
//  11. MCQ, True/False, and short-answer interleave in document order
// Run:  npx tsx scripts/check-true-false.mts
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
function doc(lines: string[]): ExtractedDoc {
  return {
    pages: 1,
    text: lines.join("\n"),
    lines: lines.map((text, i) => ({ page: 1, column: 0, x: 0, y: i * 10, text, words: [] })),
  };
}
const parse = (lines: string[]): Quiz => parseExtracted(doc(lines), SRC);

// 1 — inline word answer.
{
  const quiz = parse([
    "1. True or False: The mitochondria is the powerhouse of the cell.",
    "Answer: True",
  ]);
  eq("1: one question", quiz.questions.length, 1);
  eq("1: type true_false", quiz.questions[0]?.type, "true_false");
  eq("1: correct is A (True)", quiz.questions[0]?.correct ?? null, "A");
  eq("1: two options", quiz.questions[0]?.options.length ?? -1, 2);
  eq("1: option A text", quiz.questions[0]?.options[0]?.text ?? null, "True");
  eq("1: option B text", quiz.questions[0]?.options[1]?.text ?? null, "False");
  eq(
    "1: lead-in stripped from stem",
    quiz.questions[0]?.stem,
    "The mitochondria is the powerhouse of the cell.",
  );
}

// 2 — inline letter answer ("F" → False).
{
  const quiz = parse(["1. True or False: Water boils at 50 degrees Celsius.", "Answer: F"]);
  eq("2: type true_false", quiz.questions[0]?.type, "true_false");
  eq("2: correct is B (False)", quiz.questions[0]?.correct ?? null, "B");
}

// 3 — answer key with mixed letter ("1. F") and word ("2. T") verdict rows.
{
  const quiz = parse([
    "1. True or False: The Earth is flat.",
    "2. True or False: The Earth orbits the Sun.",
    "Answer Key",
    "1. F",
    "2. T",
  ]);
  eq("3: two questions", quiz.questions.length, 2);
  eq("3: both true_false", quiz.questions.map((q) => q.type).join(","), "true_false,true_false");
  eq("3: Q1 correct B (False, from letter key)", quiz.questions[0]?.correct ?? null, "B");
  eq("3: Q2 correct A (True, from word key)", quiz.questions[1]?.correct ?? null, "A");
}

// 4 — free-text "False" key must NOT be read as the option letter "F".
{
  const quiz = parse([
    "1. True or False: Sound travels faster than light.",
    "Answers",
    "1. False",
  ]);
  eq("4: type true_false", quiz.questions[0]?.type, "true_false");
  eq("4: correct B (False kept whole, not letter 'F')", quiz.questions[0]?.correct ?? null, "B");
}

// 5 — lead-in variants: em-dash "True/False —" and "T/F:".
{
  const quiz = parse([
    "1. True/False — Paris is the capital of France.",
    "Answer: True",
    "2. T/F: The sun is a star.",
    "Answer: T",
  ]);
  eq("5: two questions", quiz.questions.length, 2);
  eq("5: both true_false", quiz.questions.map((q) => q.type).join(","), "true_false,true_false");
  eq("5: Q1 stem stripped", quiz.questions[0]?.stem, "Paris is the capital of France.");
  eq("5: Q2 stem stripped", quiz.questions[1]?.stem, "The sun is a star.");
  eq("5: Q1 correct A", quiz.questions[0]?.correct ?? null, "A");
  eq("5: Q2 correct A", quiz.questions[1]?.correct ?? null, "A");
}

// 6 — T/F prompt with no verdict found stays skipped (unchanged behavior).
{
  const quiz = parse(["1. True or False: The moon is made of cheese."]);
  eq("6: no questions imported", quiz.questions.length, 0);
  eq("6: surfaced as skipped", quiz.skipped?.length ?? 0, 1);
}

// 7 — a 6-option MCQ whose key answer is option "F" is NOT a True/False.
{
  const quiz = parse([
    "1. Which vitamin is produced when skin is exposed to sunlight?",
    "A) Vitamin A",
    "B) Vitamin B",
    "C) Vitamin C",
    "D) Vitamin D",
    "E) Vitamin E",
    "F) Vitamin D3",
    "Answer: F",
  ]);
  eq("7: type mcq", quiz.questions[0]?.type, "mcq");
  eq("7: six options", quiz.questions[0]?.options.length ?? -1, 6);
  eq("7: correct stays option F", quiz.questions[0]?.correct ?? null, "F");
}

// 8 — "…true or false…" mid-sentence is not a lead-in (anchored at start only).
{
  const quiz = parse([
    "1. Determine whether each statement is true or false and explain.",
    "Answer: It depends on the statement.",
  ]);
  eq("8: not true_false", quiz.questions[0]?.type, "open");
}

// 9 — an explicit "A) True / B) False" item still parses as a plain MCQ.
{
  const quiz = parse([
    "1. The sky appears blue due to Rayleigh scattering.",
    "A) True",
    "B) False",
    "Answer: A",
  ]);
  eq("9: type mcq (options present → unchanged)", quiz.questions[0]?.type, "mcq");
  eq("9: two options", quiz.questions[0]?.options.length ?? -1, 2);
  eq("9: correct A", quiz.questions[0]?.correct ?? null, "A");
}

// 10 — true_false questions are structurally clean and fully confident.
{
  const quiz = parse(["1. True or False: DNA carries genetic information.", "Answer: True"]);
  const q = quiz.questions[0];
  eq("10: full confidence", q?.confidence ?? -1, 1);
  eq("10: no flags", q?.flags.length ?? -1, 0);
  eq("10: correct is among options", q?.options.some((o) => o.label === q?.correct) ?? false, true);
  eq("10: no reference answerText", q?.answerText ?? null, null);
}

// 11 — MCQ, True/False, and short-answer interleave in document order.
{
  const quiz = parse([
    "1. What is 2 + 2?",
    "A) 3",
    "B) 4",
    "2. True or False: The Earth is round.",
    "3. Define photosynthesis.",
    "Answer Key",
    "1. B",
    "2. True",
    "3. The process plants use to convert light into energy.",
  ]);
  eq("11: three questions in order", quiz.questions.map((q) => q.type).join(","), "mcq,true_false,open");
  eq("11: MCQ answer", quiz.questions[0]?.correct ?? null, "B");
  eq("11: T/F answer A (True)", quiz.questions[1]?.correct ?? null, "A");
  eq(
    "11: open answer captured",
    quiz.questions[2]?.answerText ?? null,
    "The process plants use to convert light into energy.",
  );
}

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
