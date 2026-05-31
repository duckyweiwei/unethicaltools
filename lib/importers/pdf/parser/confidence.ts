import type { Question } from "../../../domain/types";
import { isSequential } from "./patterns";

/**
 * The flag strings `scoreQuestion` derives from a question's own shape. Named
 * (and exported as a Set) so consumers that re-score a question — e.g. the
 * multi-PDF merge, after filling a previously-missing answer — can strip the
 * stale ones and let scoreQuestion re-derive, without hardcoding the literals.
 */
export const DERIVED_FLAGS = {
  fewOptions: "Fewer than 2 options detected",
  manyOptions: "Unusually many options",
  emptyStem: "Empty question stem",
  noAnswer: "No correct answer detected",
  answerNotOption: "Answer label is not among the options",
  notSequential: "Option labels are not sequential (A, B, C...)",
} as const;

export const DERIVED_FLAG_SET: ReadonlySet<string> = new Set(Object.values(DERIVED_FLAGS));

/**
 * Per-question confidence. Low confidence flags the question for the review
 * screen and, when enabled, routes the document to the LLM fallback. The flags
 * are surfaced to the user verbatim so they know WHY a question needs a look.
 */
export function scoreQuestion(q: Omit<Question, "confidence">): {
  confidence: number;
  flags: string[];
} {
  const flags = [...q.flags];
  let score = 1;

  if (q.options.length < 2) {
    score -= 0.5;
    flags.push(DERIVED_FLAGS.fewOptions);
  }
  if (q.options.length > 6) {
    score -= 0.15;
    flags.push(DERIVED_FLAGS.manyOptions);
  }
  if (!q.stem.trim()) {
    score -= 0.5;
    flags.push(DERIVED_FLAGS.emptyStem);
  }
  if (q.correct == null) {
    score -= 0.4;
    flags.push(DERIVED_FLAGS.noAnswer);
  } else if (!q.options.some((o) => o.label === q.correct)) {
    score -= 0.3;
    flags.push(DERIVED_FLAGS.answerNotOption);
  }

  const labels = q.options.map((o) => o.label);
  if (labels.length >= 2 && !isSequential(labels)) {
    score -= 0.2;
    flags.push(DERIVED_FLAGS.notSequential);
  }

  return {
    confidence: Math.max(0, Math.min(1, Number(score.toFixed(2)))),
    flags,
  };
}
