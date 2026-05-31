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
  /** Correct option label (e.g. "B"); null when undetermined. */
  correct: string | null;
  /** Explanation text if present in the source. */
  explanation: string | null;
  /** Parser confidence for this question, 0..1. */
  confidence: number;
  /** Human-readable reasons this question may need review. */
  flags: string[];
  /** Filename this question came from, set when merged from multiple PDFs. */
  sourceLabel?: string;
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
