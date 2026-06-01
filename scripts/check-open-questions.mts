// Proof/guard for short-answer ("open") question emission in the PDF parser
// (lib/importers/pdf/parser). A non-MCQ prompt paired with a reference answer —
// inline ("Answer: …") or via a short-answer key ("1. Mitochondria") — is now
// imported as a self-gradable `open` question instead of being skipped.
//
// Invariants proved here over the REAL parser (hand-built ExtractedDocs):
//   1. short-answer + free-text key  → open question carrying the answer
//   2. short-answer + inline answer  → open question carrying the answer
//   3. a free-text answer starting A–H ("Carbon dioxide") is NOT misread as a
//      letter key ("C") — the KEY_PAIR_RE word-boundary fix
//   4. ordinary MCQ + letter key still parses as MCQ (no regression)
//   5. MCQ and short-answer interleave in document order
//   6. a short-answer with NO answer stays skipped (nothing to self-grade)
//   7. open questions are clean: empty options, null correct, no MCQ flags
// Run:  npx tsx scripts/check-open-questions.mts
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

// 1 — short-answer questions paired with a free-text answer key.
{
  const quiz = parse([
    "1. What organelle is the powerhouse of the cell?",
    "2. What process do plants use to make food?",
    "Answer Key",
    "1. Mitochondria",
    "2. Photosynthesis",
  ]);
  eq("1: two questions imported", quiz.questions.length, 2);
  eq("1: first is open", quiz.questions[0]?.type, "open");
  eq("1: first answer text", quiz.questions[0]?.answerText ?? null, "Mitochondria");
  eq("1: second answer text", quiz.questions[1]?.answerText ?? null, "Photosynthesis");
  eq("1: nothing skipped", quiz.skipped?.length ?? 0, 0);
}

// 2 — inline free-text answer.
{
  const quiz = parse([
    "1. Define osmosis.",
    "Answer: The diffusion of water across a selectively permeable membrane.",
  ]);
  eq("2: one open question", quiz.questions.length, 1);
  eq("2: type open", quiz.questions[0]?.type, "open");
  eq(
    "2: answer captured verbatim",
    quiz.questions[0]?.answerText ?? null,
    "The diffusion of water across a selectively permeable membrane.",
  );
}

// 3 — free-text answers that begin with an A–H letter must NOT be read as a
// letter key (this is the KEY_PAIR_RE word-boundary fix).
{
  const quiz = parse([
    "1. What gas do plants absorb during photosynthesis?",
    "2. What is asexual cell division in bacteria called?",
    "Answers",
    "1. Carbon dioxide",
    "2. Binary fission",
  ]);
  eq("3: two open questions", quiz.questions.length, 2);
  eq("3: 'Carbon dioxide' kept whole (not 'C')", quiz.questions[0]?.answerText ?? null, "Carbon dioxide");
  eq("3: 'Binary fission' kept whole (not 'B')", quiz.questions[1]?.answerText ?? null, "Binary fission");
}

// 4 — a normal MCQ with a letter key is unchanged (regression guard).
{
  const quiz = parse([
    "1. What is 2 + 2?",
    "A) 3",
    "B) 4",
    "Answer Key",
    "1. B",
  ]);
  eq("4: one MCQ", quiz.questions.length, 1);
  eq("4: type mcq", quiz.questions[0]?.type, "mcq");
  eq("4: letter answer still read", quiz.questions[0]?.correct ?? null, "B");
  eq("4: not turned into an open question", quiz.questions[0]?.answerText ?? null, null);
}

// 5 — MCQ and short-answer interleave in document order.
{
  const quiz = parse([
    "1. What is 2 + 2?",
    "A) 3",
    "B) 4",
    "2. Name the powerhouse of the cell.",
    "Answer Key",
    "1. B",
    "2. Mitochondrion",
  ]);
  eq("5: two questions, order preserved", quiz.questions.map((q) => q.type).join(","), "mcq,open");
  eq("5: MCQ answer", quiz.questions[0]?.correct ?? null, "B");
  eq("5: open answer", quiz.questions[1]?.answerText ?? null, "Mitochondrion");
}

// 6 — short-answer with NO answer found stays skipped (unchanged behavior).
{
  const quiz = parse(["1. Define photosynthesis.", "2. Explain mitosis."]);
  eq("6: no questions imported", quiz.questions.length, 0);
  eq("6: both surfaced as skipped", quiz.skipped?.length ?? 0, 2);
}

// 7 — open questions are structurally clean and not penalized as malformed MCQs.
{
  const quiz = parse([
    "1. What organelle is the powerhouse of the cell?",
    "Answer: Mitochondria",
  ]);
  const q = quiz.questions[0];
  eq("7: no options", q?.options.length ?? -1, 0);
  eq("7: no labelled correct", q?.correct ?? null, null);
  eq("7: full confidence", q?.confidence ?? -1, 1);
  eq("7: no MCQ flags", q?.flags.length ?? -1, 0);
}

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
