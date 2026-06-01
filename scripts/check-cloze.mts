// Proof/guard for fill-in-the-blank ("cloze") emission in the PDF parser
// (lib/importers/pdf/parser) and the shared cloze helpers (lib/study/cloze). A
// stem carrying a blank ("… is the ______.") paired with a reference answer —
// inline ("Answer: mitochondria") or a free-text key ("1. mitochondria") — is
// imported as a `cloze` question: the SAME self-graded machinery as short-answer
// ("open"), but the stem keeps its blank so the player can reveal the answer IN
// the blank (a natural completed-sentence read), not in a detached box.
//
// Invariants proved here over the REAL parser (hand-built ExtractedDocs):
//   1. blank + inline answer  → cloze; stem keeps the blank; 0 options; no correct
//   2. NO blank + answer       → open (not misread as cloze) — regression guard
//   3. blank + free-text key ("1. mitochondria") → cloze
//   4. blank but NO answer      → skipped (nothing to grade) — unchanged
//   5. cloze is clean: confidence 1, no flags, answerText set, correct null
//   6. mid-sentence blank still cloze, and fillBlank splits around the FIRST gap
//   7. long underscore run + bracketed "[blank]" both detected; "__" (2) is not
//   8. MCQ, True/False, short-answer, and cloze interleave in document order
// Run:  npx tsx scripts/check-cloze.mts
import type { ExtractedDoc } from "../lib/importers/pdf/extract";
import type { Quiz, QuizSource } from "../lib/domain/types";
import { parseExtracted } from "../lib/importers/pdf/parser/index";
import { hasBlank, fillBlank } from "../lib/study/cloze";

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

// 1 — blank + inline answer.
{
  const quiz = parse([
    "1. The powerhouse of the cell is the __________.",
    "Answer: mitochondria",
  ]);
  eq("1: one question", quiz.questions.length, 1);
  eq("1: type cloze", quiz.questions[0]?.type, "cloze");
  eq("1: answerText captured", quiz.questions[0]?.answerText ?? null, "mitochondria");
  eq("1: no options", quiz.questions[0]?.options.length ?? -1, 0);
  eq("1: no labelled correct", quiz.questions[0]?.correct ?? null, null);
  ok("1: stem keeps the blank", /_{3,}/.test(quiz.questions[0]?.stem ?? ""), quiz.questions[0]?.stem);
}

// 2 — a short-answer with NO blank stays `open` (not misclassified as cloze).
{
  const quiz = parse(["1. Define photosynthesis.", "Answer: converting light to energy"]);
  eq("2: type open (no blank)", quiz.questions[0]?.type, "open");
}

// 3 — blank + free-text answer key.
{
  const quiz = parse([
    "1. Water is made of hydrogen and __________.",
    "Answers",
    "1. oxygen",
  ]);
  eq("3: type cloze", quiz.questions[0]?.type, "cloze");
  eq("3: answerText from key", quiz.questions[0]?.answerText ?? null, "oxygen");
}

// 4 — blank but NO answer stays skipped (nothing to grade against).
{
  const quiz = parse(["1. The capital of France is __________."]);
  eq("4: no questions imported", quiz.questions.length, 0);
  eq("4: surfaced as skipped", quiz.skipped?.length ?? 0, 1);
}

// 5 — cloze is structurally clean and fully confident.
{
  const quiz = parse(["1. DNA is composed of nucleotide __________.", "Answer: bases"]);
  const q = quiz.questions[0];
  eq("5: full confidence", q?.confidence ?? -1, 1);
  eq("5: no flags", q?.flags.length ?? -1, 0);
  eq("5: answerText set", q?.answerText ?? null, "bases");
  eq("5: correct null", q?.correct ?? null, null);
}

// 6 — a mid-sentence blank is still cloze, and fillBlank splits around it.
{
  const quiz = parse([
    "1. The __________ is the control center of the cell.",
    "Answer: nucleus",
  ]);
  const q = quiz.questions[0];
  eq("6: type cloze", q?.type, "cloze");
  const filled = fillBlank(q?.stem ?? "", q?.answerText ?? "");
  ok("6: fillBlank returns segments", filled != null);
  eq("6: before the blank", filled?.before, "The ");
  eq("6: answer in the gap", filled?.answer, "nucleus");
  eq("6: after the blank", filled?.after, " is the control center of the cell.");
}

// 7 — hasBlank detection boundaries (helper unit).
{
  ok("7: 3+ underscores is a blank", hasBlank("ends with ___"));
  ok("7: long underscore run is a blank", hasBlank("a __________ b"));
  ok("7: bracketed [blank] is a blank", hasBlank("the [blank] orbits"));
  ok("7: bracketed empty [ ] is a blank", hasBlank("the [ ] orbits"));
  ok("7: two underscores is NOT a blank", !hasBlank("snake__case word"));
  ok("7: plain prose is NOT a blank", !hasBlank("an ordinary sentence"));
  ok("7: fillBlank returns null without a blank", fillBlank("no gap here", "x") === null);
}

// 8 — MCQ, True/False, short-answer, and cloze interleave in document order.
{
  const quiz = parse([
    "1. What is 2 + 2?",
    "A) 3",
    "B) 4",
    "2. True or False: The Earth is round.",
    "3. Define osmosis.",
    "4. The chemical symbol for gold is __________.",
    "Answer Key",
    "1. B",
    "2. True",
    "3. Water moving across a membrane.",
    "4. Au",
  ]);
  eq(
    "8: four questions in order",
    quiz.questions.map((q) => q.type).join(","),
    "mcq,true_false,open,cloze",
  );
  eq("8: cloze answer captured", quiz.questions[3]?.answerText ?? null, "Au");
  ok("8: cloze stem keeps blank", /_{3,}/.test(quiz.questions[3]?.stem ?? ""));
}

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
