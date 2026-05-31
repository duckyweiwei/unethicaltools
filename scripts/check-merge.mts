// Proof/guard for the multi-PDF merge path: standalone answer-key extraction
// (extractAnswerKeyPairs) and mergeQuizzes (fill-by-number, no-override,
// re-score, renumber across docs, source tagging). Run alongside the others:
//   npx tsx scripts/check-merge.mts
import type { ExtractedDoc, Line } from "../lib/importers/pdf/extract";
import { extractAnswerKeyPairs, parseExtracted } from "../lib/importers/pdf/parser";
import { mergeQuizzes } from "../lib/importers/merge";
import type { Question, Quiz, SkippedItem } from "../lib/domain/types";

let failures = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond && detail) console.log(`   ${detail}`);
}

// --- builders ---
function line(text: string): Line {
  return { page: 1, column: 0, x: 0, y: 0, text, words: [] };
}
function doc(...texts: string[]): ExtractedDoc {
  const lines = texts.map(line);
  return { pages: 1, lines, text: lines.map((l) => l.text).join("\n") };
}
function q(partial: Partial<Question>): Question {
  return {
    id: "seed",
    number: null,
    type: "mcq",
    stem: "Stem?",
    options: [
      { label: "A", text: "a" },
      { label: "B", text: "b" },
      { label: "C", text: "c" },
      { label: "D", text: "d" },
    ],
    correct: null,
    explanation: null,
    confidence: 0,
    flags: ["No correct answer detected"], // what the parser would have left
    ...partial,
  };
}
function quiz(questions: Question[], title = "Doc"): Quiz {
  return { id: "qz", title, source: { type: "pdf" }, questions, createdAt: "" };
}

// --- extractAnswerKeyPairs: pulls pairs from a standalone key PDF ---
const pairs = extractAnswerKeyPairs(doc("Answer Key", "1. B 2. A 3. D", "4) C  5) E"));
ok("key: count", pairs.length === 5, JSON.stringify(pairs));
ok(
  "key: values",
  pairs.map((p) => `${p.number}${p.label}`).join(",") === "1B,2A,3D,4C,5E",
  JSON.stringify(pairs),
);

// --- extractAnswerKeyPairs: prose must NOT yield pairs ---
ok("key: ignores prose", extractAnswerKeyPairs(doc("The cell is the unit of life.")).length === 0);
ok(
  "key: ignores question-looking line",
  extractAnswerKeyPairs(doc("1. A patient presents with chest pain and dyspnea.")).length === 0,
);

// --- parseExtracted: un-importable blocks surface as `skipped` (never dropped) ---
const sk1 = parseExtracted(
  doc("Section B: Short Answer", "1. Explain photosynthesis in detail."),
  { type: "pdf" },
);
ok("skip: non-MCQ section yields no questions", sk1.questions.length === 0);
ok("skip: non-MCQ block captured once", (sk1.skipped?.length ?? 0) === 1, JSON.stringify(sk1.skipped));
ok(
  "skip: non-MCQ reason + stem preserved",
  sk1.skipped?.[0]?.reason === "Under a non-multiple-choice section" &&
    sk1.skipped?.[0]?.stem === "Explain photosynthesis in detail.",
  JSON.stringify(sk1.skipped),
);

const sk2 = parseExtracted(
  doc(
    "1. What is 2 plus 2?",
    "A) 3",
    "B) 4",
    "2. Name the capital of France.",
    "A) Paris",
    "3. Define entropy.",
  ),
  { type: "pdf" },
);
ok(
  "skip: clean MCQ still kept",
  sk2.questions.length === 1 && sk2.questions[0].stem === "What is 2 plus 2?",
  JSON.stringify(sk2.questions.map((x) => x.stem)),
);
ok("skip: two under-formed blocks captured", (sk2.skipped?.length ?? 0) === 2, JSON.stringify(sk2.skipped));
ok(
  "skip: one-option reason + carries the option",
  sk2.skipped?.[0]?.reason === "Only one answer option was detected" &&
    sk2.skipped?.[0]?.options.length === 1 &&
    sk2.skipped?.[0]?.options[0]?.text === "Paris",
  JSON.stringify(sk2.skipped),
);
ok(
  "skip: zero-option reason",
  sk2.skipped?.[1]?.reason === "No answer options were detected",
  JSON.stringify(sk2.skipped),
);

// --- merge: fill missing answers by number (single doc keeps numbers) ---
const m1 = mergeQuizzes({
  questionDocs: [{ fileName: "Questions.pdf", quiz: quiz([q({ number: 1 }), q({ number: 2 })]) }],
  answerKeys: [
    { number: 1, label: "B" },
    { number: 2, label: "C" },
  ],
});
ok("merge: filled #1", m1.questions[0].correct === "B");
ok("merge: filled #2", m1.questions[1].correct === "C");
ok("merge: single-doc keeps numbers", m1.questions[0].number === 1 && m1.questions[1].number === 2);
ok("merge: source tagged", m1.questions[0].sourceLabel === "Questions.pdf");
ok(
  "merge: stale 'no answer' flag cleared",
  !m1.questions[0].flags.includes("No correct answer detected"),
  JSON.stringify(m1.questions[0].flags),
);
ok("merge: re-scored to full confidence", m1.questions[0].confidence === 1, String(m1.questions[0].confidence));
ok("merge: no skipped stays undefined", m1.skipped === undefined);

// --- merge: never override an answer the parser already found ---
const m2 = mergeQuizzes({
  questionDocs: [{ fileName: "Q", quiz: quiz([q({ number: 1, correct: "A", flags: [] })]) }],
  answerKeys: [{ number: 1, label: "B" }],
});
ok("merge: no override of existing answer", m2.questions[0].correct === "A");

// --- merge: ignore a key label that isn't one of the options ---
const m3 = mergeQuizzes({
  questionDocs: [{ fileName: "Q", quiz: quiz([q({ number: 1 })]) }],
  answerKeys: [{ number: 1, label: "Z" }],
});
ok("merge: bogus key label ignored", m3.questions[0].correct === null);
ok(
  "merge: still flagged unanswered",
  m3.questions[0].flags.includes("No correct answer detected"),
  JSON.stringify(m3.questions[0].flags),
);

// --- merge: multiple question docs concat, renumber, tag per source, unique ids ---
const m4 = mergeQuizzes({
  questionDocs: [
    { fileName: "A.pdf", quiz: quiz([q({ number: 1, correct: "A", flags: [] }), q({ number: 2, correct: "B", flags: [] })]) },
    { fileName: "B.pdf", quiz: quiz([q({ number: 1, correct: "C", flags: [] })]) },
  ],
  answerKeys: [],
});
ok("merge: concatenated count", m4.questions.length === 3);
ok("merge: renumbered 1..N", m4.questions.map((x) => x.number).join(",") === "1,2,3");
ok(
  "merge: per-doc source labels",
  m4.questions.map((x) => x.sourceLabel).join(",") === "A.pdf,A.pdf,B.pdf",
);
ok("merge: unique ids", new Set(m4.questions.map((x) => x.id)).size === 3);

// --- merge: multi-doc key matching uses each question's ORIGINAL number ---
const m5 = mergeQuizzes({
  questionDocs: [
    { fileName: "A", quiz: quiz([q({ number: 1 })]) },
    { fileName: "B", quiz: quiz([q({ number: 1 })]) },
  ],
  answerKeys: [{ number: 1, label: "B" }],
});
ok(
  "merge: by-number fills both original #1s",
  m5.questions[0].correct === "B" && m5.questions[1].correct === "B",
);
ok("merge: display renumbered to 1,2", m5.questions.map((x) => x.number).join(",") === "1,2");

// --- merge: skipped blocks are pooled across all question docs, in order ---
const skItem = (stem: string, reason: string): SkippedItem => ({
  number: null,
  stem,
  options: [],
  reason,
});
const m6 = mergeQuizzes({
  questionDocs: [
    {
      fileName: "A.pdf",
      quiz: {
        ...quiz([q({ number: 1, correct: "A", flags: [] })]),
        skipped: [skItem("Essay one", "Under a non-multiple-choice section")],
      },
    },
    {
      fileName: "B.pdf",
      quiz: {
        ...quiz([q({ number: 1, correct: "B", flags: [] })]),
        skipped: [skItem("Essay two", "No answer options were detected")],
      },
    },
  ],
  answerKeys: [],
});
ok("merge: pools skipped from every doc", (m6.skipped?.length ?? 0) === 2, JSON.stringify(m6.skipped));
ok(
  "merge: skipped order preserved across docs",
  m6.skipped?.map((s) => s.stem).join(",") === "Essay one,Essay two",
  JSON.stringify(m6.skipped),
);

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
