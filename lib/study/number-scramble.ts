import type { Question, QuestionOption } from "../domain/types";
import { isMultiSelect } from "../domain/types";

/**
 * One-time "fresh numbers" study transform.
 *
 * Given a multiple-choice question whose stem is a self-contained integer
 * arithmetic expression (e.g. "What is 12 + 7?"), produce a NEW question with
 * regenerated operands and a recomputed answer — a different-but-equivalent
 * practice item. This is deliberately deterministic and model-free: we only
 * touch a question when we can PROVE we understood it, by checking that the
 * value we compute from the stem equals the value of its labelled-correct
 * option. Anything we can't verify (non-arithmetic prose, non-numeric options,
 * non-integer/division-with-remainder, or an ambiguous stem with several
 * expressions) is left exactly as-is.
 *
 * Pure and non-destructive: the input question is never mutated, and callers
 * apply this per test run (like option-order shuffling) so the stored quiz is
 * untouched.
 */

type Op = "+" | "-" | "*" | "/";

/** Map the assorted operator glyphs a PDF might use onto a canonical op. */
const OP_CANON: Record<string, Op> = {
  "+": "+",
  "-": "-",
  "−": "-", // − minus sign
  "–": "-", // – en dash
  "—": "-", // — em dash
  "*": "*",
  "×": "*", // × multiplication sign
  x: "*",
  X: "*",
  "·": "*", // · middle dot
  "/": "/",
  "÷": "/", // ÷ division sign
};

function apply(op: Op, a: number, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return a / b;
  }
}

const isInt = (n: number): boolean => Number.isInteger(n);

interface NumToken {
  value: number;
  index: number;
  length: number;
}

/** First numeric token in a string (keeps its position so we can rewrite in
 *  place and preserve any surrounding text, like "$" or " apples"). */
function firstNumber(s: string): NumToken | null {
  const m = /-?\d+(?:\.\d+)?/.exec(s);
  if (!m) return null;
  return { value: Number(m[0]), index: m.index, length: m[0].length };
}

/** All "<number> <op> <number>" expressions in a string. */
function findExpressions(s: string) {
  const re = /(-?\d+(?:\.\d+)?)\s*([+\-−–—*×xX·/÷])\s*(-?\d+(?:\.\d+)?)/g;
  return [...s.matchAll(re)];
}

interface Analysis {
  op: Op;
  opSymbol: string;
  a: number;
  b: number;
  exprIndex: number;
  exprLength: number;
  answer: number;
  correctIdx: number;
  optNums: NumToken[];
}

/**
 * Decide whether a question is a verifiable integer-arithmetic MCQ and, if so,
 * return everything needed to regenerate it. Returns null (→ leave untouched)
 * the moment anything doesn't line up.
 */
function analyze(q: Question): Analysis | null {
  if (q.correct == null) return null;
  // A "select all that apply" arithmetic item has no single numeric answer to
  // verify against, so the fresh-numbers transform never applies to one.
  if (isMultiSelect(q)) return null;
  const correctIdx = q.options.findIndex((o) => o.label === q.correct);
  if (correctIdx < 0) return null;

  // Exactly one arithmetic expression in the stem — zero means it's prose,
  // more than one is ambiguous (e.g. a "2024-2025" year sitting next to "3+4").
  const exprs = findExpressions(q.stem);
  if (exprs.length !== 1) return null;
  const m = exprs[0];
  const op = OP_CANON[m[2]];
  if (!op) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  if (!isInt(a) || !isInt(b)) return null; // v1: integers only
  if (op === "/" && (b === 0 || a % b !== 0)) return null; // keep division exact

  const answer = apply(op, a, b);
  if (!isInt(answer)) return null;

  // Every option must be a single rewritable integer, so the regenerated set
  // is still a clean numeric MCQ.
  const optNums: NumToken[] = [];
  for (const o of q.options) {
    const tok = firstNumber(o.text);
    if (!tok || !isInt(tok.value)) return null;
    optNums.push(tok);
  }

  // The keystone check: the value we computed must match the labelled answer.
  // If it doesn't, we misread the question — so we refuse to touch it.
  if (optNums[correctIdx].value !== answer) return null;

  return {
    op,
    opSymbol: m[2],
    a,
    b,
    exprIndex: m.index ?? 0,
    exprLength: m[0].length,
    answer,
    correctIdx,
    optNums,
  };
}

/** Cheap feasibility check (used to decide whether to offer the toggle). */
export function canScrambleNumbers(q: Question): boolean {
  return analyze(q) !== null;
}

function randInt(rng: () => number, lo: number, hi: number): number {
  if (hi < lo) [lo, hi] = [hi, lo];
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Build a fresh variant of `q` with new numbers, or return null if the question
 * isn't a verifiable arithmetic MCQ (caller should then keep the original).
 *
 * @param rng injectable for deterministic tests; defaults to Math.random.
 */
export function tryScrambleNumbers(
  q: Question,
  rng: () => number = Math.random,
): Question | null {
  const an = analyze(q);
  if (!an) return null;

  const { op, opSymbol, a, b, answer, correctIdx, optNums } = an;
  const base = Math.max(Math.abs(a), Math.abs(b), 5);

  // --- regenerate operands, constrained so the result stays clean ---
  let na = a;
  let nb = b;
  let nAnswer = answer;
  for (let guard = 0; guard < 24; guard++) {
    if (op === "/") {
      const divisor = randInt(rng, 2, Math.min(12, Math.max(2, Math.abs(b))));
      const quotient = randInt(rng, 2, Math.min(12, Math.max(2, Math.abs(answer))));
      nb = divisor;
      na = divisor * quotient;
      nAnswer = quotient;
    } else if (op === "*") {
      const hi = Math.min(20, Math.max(5, base));
      na = randInt(rng, 2, hi);
      nb = randInt(rng, 2, hi);
      nAnswer = na * nb;
    } else {
      na = randInt(rng, 1, base * 2);
      nb = randInt(rng, 1, base * 2);
      // Preserve a non-negative result when the original was non-negative.
      if (op === "-" && a >= b && na < nb) [na, nb] = [nb, na];
      nAnswer = apply(op, na, nb);
    }
    if (na !== a || nb !== b) break; // ensure the test actually changed
  }

  // --- distractors: keep each wrong option's offset from the answer, so the
  //     regenerated choices stay as plausible as the author's originals ---
  const used = new Set<number>([nAnswer]);
  const newVals = optNums.map((tok, i) => {
    if (i === correctIdx) return nAnswer;
    const offset = tok.value - answer;
    let cand = nAnswer + offset;
    if (cand < 0) cand = nAnswer + Math.abs(offset); // mirror negatives up
    while (used.has(cand)) cand += 1; // keep choices distinct
    used.add(cand);
    return cand;
  });

  // --- rewrite numbers in place, preserving operator symbol & surrounding text ---
  const newExpr = `${na} ${opSymbol} ${nb}`;
  const stem =
    q.stem.slice(0, an.exprIndex) + newExpr + q.stem.slice(an.exprIndex + an.exprLength);

  const options: QuestionOption[] = q.options.map((o, i) => {
    const tok = optNums[i];
    const text =
      o.text.slice(0, tok.index) + String(newVals[i]) + o.text.slice(tok.index + tok.length);
    return { label: o.label, text };
  });

  // id / number / correct label all unchanged — only the numbers move.
  return { ...q, stem, options };
}
