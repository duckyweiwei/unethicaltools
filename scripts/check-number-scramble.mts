// Proof/guard for the one-time "fresh numbers" study transform
// (lib/study/number-scramble). The central invariant: whatever random numbers
// it picks, the regenerated stem must still evaluate to the value of its
// labelled-correct option. We verify that INDEPENDENTLY here (re-parsing the
// output ourselves), fuzzed across operators and seeds, plus the safety gates
// that must leave a question untouched. Run:
//   npx tsx scripts/check-number-scramble.mts
import type { Question } from "../lib/domain/types";
import { canScrambleNumbers, tryScrambleNumbers } from "../lib/study/number-scramble";

let failures = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond && detail) console.log(`   ${detail}`);
}

// --- deterministic PRNG so assertions are stable ---
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- independent evaluator (NOT the module's) to verify its output ---
const OPS: Record<string, (a: number, b: number) => number> = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "−": (a, b) => a - b,
  "–": (a, b) => a - b,
  "—": (a, b) => a - b,
  "*": (a, b) => a * b,
  "×": (a, b) => a * b,
  x: (a, b) => a * b,
  X: (a, b) => a * b,
  "·": (a, b) => a * b,
  "/": (a, b) => a / b,
  "÷": (a, b) => a / b,
};
function evalStem(stem: string): number | null {
  const m = /(-?\d+)\s*([+\-−–—*×xX·/÷])\s*(-?\d+)/.exec(stem);
  if (!m) return null;
  const fn = OPS[m[2]];
  return fn ? fn(Number(m[1]), Number(m[3])) : null;
}
const optVal = (o: { text: string }) => Number(/-?\d+/.exec(o.text)![0]);
function correctVal(q: Question): number {
  return optVal(q.options.find((x) => x.label === q.correct)!);
}

// --- builder ---
function q(partial: Partial<Question>): Question {
  return {
    id: "seed",
    number: 1,
    type: "mcq",
    stem: "What is 2 + 2?",
    options: [
      { label: "A", text: "3" },
      { label: "B", text: "4" },
      { label: "C", text: "5" },
    ],
    correct: "B",
    explanation: null,
    confidence: 1,
    flags: [],
    ...partial,
  };
}

// --- eligibility ---
ok("detects a plain arithmetic MCQ", canScrambleNumbers(q({})));

// --- the core invariant, fuzzed across operators & seeds ---
const cases: { name: string; q: Question }[] = [
  { name: "+", q: q({ stem: "What is 2 + 2?", options: [{ label: "A", text: "3" }, { label: "B", text: "4" }, { label: "C", text: "5" }], correct: "B" }) },
  { name: "-", q: q({ stem: "Compute 12 - 5.", options: [{ label: "A", text: "6" }, { label: "B", text: "7" }, { label: "C", text: "8" }], correct: "B" }) },
  { name: "×", q: q({ stem: "What is 3 × 4?", options: [{ label: "A", text: "10" }, { label: "B", text: "12" }, { label: "C", text: "14" }], correct: "B" }) },
  { name: "÷", q: q({ stem: "What is 12 ÷ 3?", options: [{ label: "A", text: "3" }, { label: "B", text: "4" }, { label: "C", text: "6" }], correct: "B" }) },
];

for (const c of cases) {
  let allConsistent = true;
  let allDistinct = true;
  let labelsKept = true;
  let nonNegative = true;
  let divExact = true;
  const stems = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const out = tryScrambleNumbers(c.q, mulberry32(seed));
    if (!out) {
      allConsistent = false;
      break;
    }
    stems.add(out.stem);
    // keystone: recomputed stem === labelled answer
    if (evalStem(out.stem) !== correctVal(out)) allConsistent = false;
    // structure preserved
    if (out.options.length !== c.q.options.length) allDistinct = false;
    const vals = out.options.map(optVal);
    if (new Set(vals).size !== vals.length) allDistinct = false;
    if (out.options.map((o) => o.label).join("") !== "ABC") labelsKept = false;
    if (out.id !== c.q.id || out.number !== c.q.number || out.correct !== c.q.correct) labelsKept = false;
    if (vals.some((v) => v < 0)) nonNegative = false;
    // division must stay a whole-number relationship
    const mm = /(-?\d+)\s*[÷/]\s*(-?\d+)/.exec(out.stem);
    if (c.name === "÷" && (!mm || Number(mm[1]) % Number(mm[2]) !== 0)) divExact = false;
  }
  ok(`${c.name}: stem always recomputes to the correct option (200 seeds)`, allConsistent);
  ok(`${c.name}: option set stays same-size & distinct`, allDistinct);
  ok(`${c.name}: labels / id / number / correct preserved`, labelsKept);
  ok(`${c.name}: results never go negative`, nonNegative);
  if (c.name === "÷") ok("÷: regenerated division stays exact", divExact);
  ok(`${c.name}: actually varies the numbers across seeds`, stems.size > 3, `${stems.size} distinct`);
}

// --- distractor offsets are preserved (author's "shape" of wrong answers) ---
{
  let offsetsKept = true;
  for (let seed = 1; seed <= 100; seed++) {
    const out = tryScrambleNumbers(q({}), mulberry32(seed))!; // [3,4,5] correct 4
    const ans = correctVal(out);
    const offs = out.options
      .filter((o) => o.label !== out.correct)
      .map((o) => optVal(o) - ans)
      .sort((a, b) => a - b);
    if (offs.join(",") !== "-1,1") offsetsKept = false;
  }
  ok("distractor offsets (-1, +1) preserved around the new answer", offsetsKept);
}

// --- surrounding text / units in option text are preserved ---
{
  const out = tryScrambleNumbers(
    q({
      stem: "A basket has 2 + 2 apples. How many?",
      options: [
        { label: "A", text: "$3" },
        { label: "B", text: "4 apples" },
        { label: "C", text: "= 5" },
      ],
      correct: "B",
    }),
    mulberry32(7),
  )!;
  ok("keeps '$' prefix on an option", /^\$\d+$/.test(out.options[0].text), out.options[0].text);
  ok("keeps ' apples' suffix on an option", /^\d+ apples$/.test(out.options[1].text), out.options[1].text);
  ok("keeps '= ' prefix on an option", /^= \d+$/.test(out.options[2].text), out.options[2].text);
  ok("stem recomputes with units present", evalStem(out.stem) === correctVal(out));
}

// --- non-destructive: the input question is never mutated ---
{
  const original = q({});
  const snapshot = JSON.stringify(original);
  tryScrambleNumbers(original, mulberry32(3));
  ok("does not mutate the input question", JSON.stringify(original) === snapshot);
}

// --- safety gates: anything we can't verify is left untouched (returns null) ---
ok("gate: prose stem", tryScrambleNumbers(q({ stem: "Capital of France?", options: [{ label: "A", text: "1" }, { label: "B", text: "2" }], correct: "A" })) === null);
ok(
  "gate: a non-numeric option",
  tryScrambleNumbers(q({ stem: "What is 2 + 2?", options: [{ label: "A", text: "Paris" }, { label: "B", text: "4" }], correct: "B" })) === null,
);
ok(
  "gate: computed value disagrees with labelled answer",
  tryScrambleNumbers(q({ stem: "What is 2 + 2?", options: [{ label: "A", text: "3" }, { label: "B", text: "5" }], correct: "B" })) === null,
);
ok(
  "gate: ambiguous stem with two expressions",
  tryScrambleNumbers(q({ stem: "In 2024-2025, what is 3 + 4?", options: [{ label: "A", text: "6" }, { label: "B", text: "7" }], correct: "B" })) === null,
);
ok(
  "gate: division with a remainder",
  tryScrambleNumbers(q({ stem: "What is 7 ÷ 2?", options: [{ label: "A", text: "3" }, { label: "B", text: "4" }], correct: "A" })) === null,
);
ok("gate: no correct answer set", tryScrambleNumbers(q({ correct: null, flags: ["No correct answer detected"] })) === null);

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
