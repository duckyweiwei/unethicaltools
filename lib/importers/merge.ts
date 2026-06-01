import type { Question, QuestionOption, Quiz, QuizSource, SkippedItem } from "../domain/types";
import { usesAnswerText } from "../domain/types";
import { newQuestionId, newQuizId } from "../domain/ids";
import { DERIVED_FLAG_SET, scoreQuestion } from "./pdf/parser/confidence";
import type { MarkSchemeEntry } from "./pdf/parser/mark-scheme";

export type { MarkSchemeEntry } from "./pdf/parser/mark-scheme";

/** One row of a standalone answer key: question number → correct option label. */
export interface AnswerKeyEntry {
  number: number;
  label: string;
}

const SCHEME_TEXT_MATCH_FLAG =
  "Answer matched to an option by text from the mark scheme — verify";

/** Stable key for the (number, part) index a mark scheme is reconciled on. */
function schemeKey(number: number, part: string | null | undefined): string {
  return `${number}|${part ?? ""}`;
}

/** Loose text key: lowercase, collapse non-alphanumerics. For option-text matching. */
function normText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * If a scheme answer names an option letter ("B", "(B)", "B — nucleus"), return
 * that option's label when it's actually one of this question's options. The
 * letter must stand as its own token so an open answer like "Because…" never
 * reads as option B. Returns null when no leading option letter is present.
 */
function schemeLetterLabel(answer: string, options: QuestionOption[]): string | null {
  const m = /^\(?([A-Ha-h])\)?(?=$|[\s).:–—-])/.exec(answer.trim());
  if (!m) return null;
  const label = m[1].toUpperCase();
  return options.some((o) => o.label === label) ? label : null;
}

/** Lower-confidence fallback: match a scheme answer to an option by its text. */
function schemeTextLabel(answer: string, options: QuestionOption[]): string | null {
  const a = normText(answer);
  if (!a) return null;
  const hit = options.find((o) => normText(o.text) === a);
  return hit ? hit.label : null;
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
  /**
   * Combined entries from any mark-scheme PDFs, keyed by question number and
   * (optional) part. Richer than `answerKeys`: it can fill MCQ answers, supply
   * reference text for open/cloze questions, AND promote skipped multi-part
   * parts into answered questions. Applied by (number, part); ambiguous matches
   * are flagged for review, never guessed.
   */
  markScheme?: MarkSchemeEntry[];
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

  // Mark-scheme index, keyed by (number, part). First entry per key wins, so a
  // restated row never clobbers the first match the scheme gave.
  const schemeMap = new Map<string, MarkSchemeEntry>();
  for (const e of input.markScheme ?? []) {
    const k = schemeKey(e.number, e.part);
    if (!schemeMap.has(k)) schemeMap.set(k, e);
  }

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
      let answerText = q.answerText ?? null;
      const extraFlags: string[] = [];
      // Provenance of the answer (for labelling in the UI). If the parser already
      // had one it's "detected"; anything we fill from a second doc below becomes
      // "mark-scheme". The AI solver later sets "ai" on keyless questions.
      let answerOrigin: Question["answerOrigin"] =
        correct != null || (answerText != null && answerText.trim() !== "") ? "detected" : null;

      if (correct == null && q.number != null) {
        const cand = keyMap.get(q.number);
        if (cand && q.options.some((o) => o.label === cand)) {
          correct = cand;
          answerOrigin = "mark-scheme";
        }
      }

      // Mark scheme: a richer second source matched by number AND part. For an
      // MCQ, take the option it names (by letter, else by option text — the
      // text match is fuzzier, so flag it). For a self-graded open/cloze, fill
      // the reference answer verbatim. Never overrides what's already set.
      const entry = q.number != null ? schemeMap.get(schemeKey(q.number, q.part)) : undefined;
      if (entry) {
        if (q.type === "mcq" && correct == null) {
          const byLetter = schemeLetterLabel(entry.answer, q.options);
          if (byLetter) {
            correct = byLetter;
            answerOrigin = "mark-scheme";
          } else {
            const byText = schemeTextLabel(entry.answer, q.options);
            if (byText) {
              correct = byText;
              answerOrigin = "mark-scheme";
              extraFlags.push(SCHEME_TEXT_MATCH_FLAG);
            }
          }
        } else if (usesAnswerText(q) && (answerText == null || !answerText.trim())) {
          answerText = entry.answer;
          answerOrigin = "mark-scheme";
        }
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
        answerText,
        answerOrigin,
        sourceLabel: doc.fileName,
        flags: [...baseFlags, ...extraFlags],
      };
      const scored = scoreQuestion(base);
      questions.push({ ...base, confidence: scored.confidence, flags: scored.flags });
    }
  }

  // Carry forward any blocks the parser couldn't auto-import, pooled across all
  // question docs. A skipped multi-part PART (number + part, no options) whose
  // answer the mark scheme supplies is PROMOTED into an answered open question;
  // anything still unmatched stays skipped for manual review.
  const pooledSkipped = input.questionDocs.flatMap((d) => d.quiz.skipped ?? []);
  const skipped: SkippedItem[] = [];
  for (const item of pooledSkipped) {
    const entry =
      item.part != null && item.number != null
        ? schemeMap.get(schemeKey(item.number, item.part))
        : undefined;
    if (!entry) {
      skipped.push(item);
      continue;
    }
    seq += 1;
    const base: Omit<Question, "confidence"> = {
      id: newQuestionId(seq),
      number: item.number,
      type: "open",
      stem: item.stem,
      options: [],
      correct: null,
      answerText: entry.answer,
      answerOrigin: "mark-scheme",
      explanation: null,
      flags: [],
      ...(item.part != null ? { part: item.part } : {}),
      ...(item.marks != null ? { marks: item.marks } : {}),
    };
    const scored = scoreQuestion(base);
    questions.push({ ...base, confidence: scored.confidence, flags: scored.flags });
  }

  return {
    id: newQuizId(),
    title: input.title ?? input.questionDocs[0]?.quiz.title ?? "Untitled Quiz",
    source: input.source ?? { type: "pdf" },
    questions,
    skipped: skipped.length ? skipped : undefined,
    createdAt: new Date().toISOString(),
  };
}
