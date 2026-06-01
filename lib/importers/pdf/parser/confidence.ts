import type { Question } from "../../../domain/types";
import { isMultiSelect, usesAnswerText } from "../../../domain/types";
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
  noReferenceAnswer: "No reference answer set",
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

  // Self-graded questions (short-answer "open" and fill-in-the-blank "cloze")
  // have no options and no labelled answer; they are scored on the presence of a
  // stem and a reference answer instead, so the MCQ-shaped penalties below never
  // apply.
  if (usesAnswerText(q)) {
    if (!q.stem.trim()) {
      score -= 0.5;
      flags.push(DERIVED_FLAGS.emptyStem);
    }
    if (!q.answerText || !q.answerText.trim()) {
      score -= 0.4;
      flags.push(DERIVED_FLAGS.noReferenceAnswer);
    }
    return {
      confidence: Math.max(0, Math.min(1, Number(score.toFixed(2)))),
      flags,
    };
  }

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

  // Multi-select: every label in the correct set must be a real option. The
  // single-answer check above already covers `correct` (= the set's first
  // label), so only penalise here when one of the OTHER set labels is bogus and
  // we haven't already flagged it.
  if (isMultiSelect(q)) {
    const labels = new Set(q.options.map((o) => o.label));
    const allValid = (q.correctSet ?? []).every((l) => labels.has(l));
    if (!allValid && !flags.includes(DERIVED_FLAGS.answerNotOption)) {
      score -= 0.3;
      flags.push(DERIVED_FLAGS.answerNotOption);
    }
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
