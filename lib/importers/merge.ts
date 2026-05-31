import type { Question, Quiz, QuizSource } from "../domain/types";
import { newQuestionId, newQuizId } from "../domain/ids";
import { DERIVED_FLAG_SET, scoreQuestion } from "./pdf/parser/confidence";

/** One row of a standalone answer key: question number → correct option label. */
export interface AnswerKeyEntry {
  number: number;
  label: string;
}

export interface QuestionDocInput {
  /** Filename, kept as each question's `sourceLabel`. */
  fileName: string;
  quiz: Quiz;
}

export interface MergeInput {
  /** Question PDFs, in the order the user staged them. */
  questionDocs: QuestionDocInput[];
  /** Combined key pairs from any standalone answer-key PDFs. */
  answerKeys: AnswerKeyEntry[];
  title?: string;
  source?: QuizSource;
}

/**
 * Combine one or more imported question PDFs (plus any standalone answer-key
 * PDFs) into a single quiz.
 *
 * Answer keys are matched BY QUESTION NUMBER across the whole set: a key only
 * fills a question whose answer wasn't already detected, and only when the label
 * is actually one of that question's options. Matching uses each question's
 * ORIGINAL number (so a lone "questions + key" pair lines up); display numbers
 * are then renumbered sequentially only when ≥2 question docs are combined, to
 * avoid duplicate "1, 2, 3 …" across docs. IDs are always reassigned uniquely.
 *
 * Every question is re-scored afterward so a freshly merged-in answer refreshes
 * its confidence and clears the stale "No correct answer detected" flag.
 */
export function mergeQuizzes(input: MergeInput): Quiz {
  const keyMap = new Map<number, string>();
  for (const k of input.answerKeys) keyMap.set(k.number, k.label.toUpperCase());

  const multiDoc = input.questionDocs.length > 1;
  const questions: Question[] = [];
  let seq = 0;

  for (const doc of input.questionDocs) {
    for (const q of doc.quiz.questions) {
      seq += 1;

      // Fill a missing answer from the combined key, by the question's own
      // number — but never override an answer the parser already found, and
      // only accept a label that's actually one of this question's options.
      let correct = q.correct;
      if (correct == null && q.number != null) {
        const cand = keyMap.get(q.number);
        if (cand && q.options.some((o) => o.label === cand)) correct = cand;
      }

      // Re-score from a clean base: drop the parser's previously-derived flags
      // (keep any custom ones, e.g. conflicting-signal notes) and let
      // scoreQuestion re-derive against the possibly-updated answer.
      const baseFlags = q.flags.filter((f) => !DERIVED_FLAG_SET.has(f));
      const base: Omit<Question, "confidence"> = {
        ...q,
        id: newQuestionId(seq),
        number: multiDoc ? seq : q.number,
        correct,
        sourceLabel: doc.fileName,
        flags: baseFlags,
      };
      const scored = scoreQuestion(base);
      questions.push({ ...base, confidence: scored.confidence, flags: scored.flags });
    }
  }

  // Carry forward any blocks the parser couldn't auto-import, pooled across all
  // question docs, so the review screen can surface them once for the whole set.
  const skipped = input.questionDocs.flatMap((d) => d.quiz.skipped ?? []);

  return {
    id: newQuizId(),
    title: input.title ?? input.questionDocs[0]?.quiz.title ?? "Untitled Quiz",
    source: input.source ?? { type: "pdf" },
    questions,
    skipped: skipped.length ? skipped : undefined,
    createdAt: new Date().toISOString(),
  };
}
