/**
 * Shared domain model for the whole tool suite.
 *
 * Every tool (PDF importer now; docx / image / AI later) PRODUCES this shape,
 * and the quiz player CONSUMES it — the player neither knows nor cares where a
 * quiz came from. Keep this model source-agnostic.
 */

export type SourceType = "pdf" | "docx" | "image" | "text" | "ai";

export interface QuizSource {
  type: SourceType;
  filename?: string;
}

export interface QuestionOption {
  /** Original label exactly as written: "A", "B", "C"... */
  label: string;
  /** Option text exactly as written in the source (no rephrasing). */
  text: string;
}

/**
 * A reference to an image attached to a question's prompt — a diagram, chart, or
 * figure the question asks about. The PIXELS are NOT stored here: a quiz is JSON
 * persisted to localStorage (~5MB quota), so the bytes would blow it up. Instead
 * only this lightweight pointer travels with the quiz, and the actual data (a
 * dataURL string) lives in IndexedDB keyed by `id` — see lib/storage/image-store.ts.
 * Optional alt text keeps it accessible; intrinsic dimensions let the player
 * reserve aspect-ratio space so attaching an image doesn't reflow the card.
 */
export interface QuestionImage {
  /** Key into the IndexedDB image store. */
  id: string;
  /** Alt text for screen readers; the stem is used as a fallback when empty. */
  alt?: string;
  /** Intrinsic pixel width, when measured at attach time. */
  width?: number;
  /** Intrinsic pixel height, when measured at attach time. */
  height?: number;
}

/**
 * v1 implements "mcq" only. The union is intentionally open so true/false,
 * cloze, matching, and open-ended can be added later WITHOUT reshaping the
 * model. Nothing should hardcode "exactly 4 options".
 */
export type QuestionType = "mcq" | "true_false" | "cloze" | "matching" | "open";

export interface Question {
  id: string;
  /** Original number if detected, else null (unnumbered). */
  number: number | null;
  type: QuestionType;
  /** Question stem, verbatim. */
  stem: string;
  options: QuestionOption[];
  /** Correct option label (e.g. "B"); null when undetermined. For a
   *  multi-select question this holds the FIRST label of `correctSet`, so every
   *  single-answer code path (playability, confidence, mark-scheme, scramble)
   *  keeps seeing a non-null answer; the full set lives in `correctSet`. */
  correct: string | null;
  /**
   * For a "select all that apply" / "choose two" MCQ, the FULL set of correct
   * option labels (length >= 2). Present only for multi-answer questions;
   * absent/undefined for ordinary single-answer MCQs and every other type.
   * Grading is all-or-nothing (the chosen set must equal this set exactly).
   * `isMultiSelect()` is the one place that decides whether a question is
   * multi-answer — branch on it, never on `Array.isArray(correctSet)` directly.
   */
  correctSet?: string[] | null;
  /**
   * Reference answer for non-MCQ ("open" / short-answer) questions, verbatim
   * from the source — the text revealed for self-grading. Null/undefined for
   * MCQs, whose answer lives in `correct` as an option label.
   */
  answerText?: string | null;
  /**
   * Where this question's answer came from:
   *  - "detected"    — the parser found it in the question paper itself.
   *  - "mark-scheme" — filled by reconciling a second uploaded doc (answer key
   *                    or mark scheme).
   *  - "ai"          — inferred by the AI solver for a paper with NO key. This is
   *                    a suggestion, not an official answer, and MUST be labelled
   *                    as such wherever it's shown.
   * Null/undefined when no answer is set, or for quizzes saved before this field
   * existed (treated as "detected" by the UI's fallback).
   */
  answerOrigin?: "detected" | "mark-scheme" | "ai" | null;
  /**
   * The AI solver's self-reported confidence (0..1), present only when
   * `answerOrigin === "ai"`. Distinct from `confidence`, which is the PARSER's
   * extraction confidence in the question itself.
   */
  answerConfidence?: number | null;
  /** Explanation text if present in the source. */
  explanation: string | null;
  /**
   * Marks this question is worth, when the source annotates it ("(2 marks)",
   * "[3]", "(Total: 25 marks)"). Metadata only — the allocation is stripped from
   * the stem so the wording stays clean, and kept here for display or weighting.
   * Null/undefined when the source states no allocation.
   */
  marks?: number | null;
  /** Parser confidence for this question, 0..1. */
  confidence: number;
  /** Human-readable reasons this question may need review. */
  flags: string[];
  /** Filename this question came from, set when merged from multiple PDFs. */
  sourceLabel?: string;
  /**
   * For a question split out of a multi-part item, its part path within the
   * parent — "a", "b", or a nested "b.i". Lets a mark scheme fill the right part
   * by question number AND part. Null/undefined for ordinary standalone questions.
   */
  part?: string | null;
  /**
   * Optional image attached to the prompt. A REFERENCE only — the bytes live in
   * IndexedDB (see QuestionImage). Null/undefined for text-only questions. Carried
   * verbatim through publish and combine; the player/editor resolve it lazily.
   */
  image?: QuestionImage | null;
}

/**
 * A block the parser found but couldn't import as a clean MCQ (e.g. it sat
 * under a non-multiple-choice section, or had too few options). Carried on the
 * quiz so the review screen can surface it for the user to fix or discard,
 * instead of silently dropping it. Never part of a published quiz.
 */
export interface SkippedItem {
  /** Original number if detected, else null. */
  number: number | null;
  /** Captured stem text, verbatim. */
  stem: string;
  /** Any options that were detected, verbatim. */
  options: QuestionOption[];
  /** Why it couldn't be imported automatically. */
  reason: string;
  /**
   * For one part of a detected multi-part question, its part path ("a", "b",
   * "b.i"). Present only on multi-part parts; lets a later mark-scheme match
   * promote this part into an answered question by question number AND part.
   */
  part?: string | null;
  /** Marks this part is worth, when the source annotates it. */
  marks?: number | null;
}

export interface Quiz {
  id: string;
  title: string;
  source: QuizSource;
  questions: Question[];
  /** Blocks that couldn't be auto-imported; shown for review, never published. */
  skipped?: SkippedItem[];
  /** ISO timestamp. */
  createdAt: string;
}

/** Below this confidence a question is flagged for the review screen / LLM fallback. */
export const LOW_CONFIDENCE = 0.6;

/**
 * True for question types whose answer is free REFERENCE TEXT (`answerText`),
 * revealed for self-grading, rather than a labelled option in `correct`:
 * short-answer ("open") and fill-in-the-blank ("cloze"). The player, editor,
 * and scorer branch on THIS — not on a single literal type — so every
 * option-less, self-graded type stays in lockstep as the union grows.
 */
export function usesAnswerText(q: Pick<Question, "type">): boolean {
  return q.type === "open" || q.type === "cloze";
}

/**
 * True for a multi-answer MCQ ("select all that apply" / "choose two"), where
 * `correctSet` lists every label that must be picked. Deliberately narrow — it
 * fires ONLY for an MCQ carrying a set of >=2 correct labels — so every existing
 * single-answer path stays untouched. This is the single switch the parser,
 * player, editor, and scorer all branch on.
 */
export function isMultiSelect(q: Pick<Question, "type" | "correctSet">): boolean {
  return q.type === "mcq" && Array.isArray(q.correctSet) && q.correctSet.length >= 2;
}

/**
 * Encode a set of chosen option labels into the stable string the player stores
 * in its answers map. Sorted so the value is order-independent (picking A then C
 * equals picking C then A) and can be compared to the encoded correct set.
 */
export function encodeChoice(labels: string[]): string {
  return [...new Set(labels)].sort().join(",");
}

/** Decode the stored multi-select value back into its labels (empty when none). */
export function decodeChoice(value: string | null | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

/**
 * Grade an MCQ (or True/False) answer — the single source of truth for whether a
 * pick is correct, shared by the player's live feedback, results, and saved
 * history so they can never drift. Multi-select requires the chosen set to equal
 * the correct set EXACTLY (all required, no extras, no partial credit);
 * single-answer compares the one chosen label to `correct`. Self-graded types
 * (open/cloze) and flashcards are graded by the player's own verdict sentinels,
 * not here, so this is only called for option-based grading.
 */
export function gradeMcq(q: Question, chosen: string | null | undefined): boolean {
  if (chosen == null) return false;
  if (isMultiSelect(q)) {
    return encodeChoice(decodeChoice(chosen)) === encodeChoice(q.correctSet ?? []);
  }
  return chosen === q.correct;
}
