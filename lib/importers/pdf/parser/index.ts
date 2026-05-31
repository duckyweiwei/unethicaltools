import type { Question, QuestionOption, Quiz, QuizSource, SkippedItem } from "../../../domain/types";
import { newQuestionId, newQuizId } from "../../../domain/ids";
import type { ExtractedDoc, Word } from "../extract";
import { scoreQuestion } from "./confidence";
import {
  isAnswerKeyHeader,
  isKeyLine,
  isSequential,
  type KeyPair,
  keyPairs,
  matchAnswerTag,
  matchExplanation,
  matchOption,
  matchQuestion,
  matchSectionHeader,
  repairGluedWords,
  splitEnumeratedStem,
  splitInlineOptions,
} from "./patterns";

/**
 * Stage 3 + 4 — structure parsing and answer reconciliation.
 *
 * Walks the extracted lines in reading order, segments them into questions,
 * splits each into stem + options, and detects the marked answer from any of
 * four deterministic signals (in priority order):
 *   1. a separate answer key ("1. B  2. A ...")
 *   2. an asterisk on the correct option
 *   3. an "Answer: B" tag line
 *   4. a per-document EMPHASIS FONT — many practice tests ship with the correct
 *      option bolded/highlighted. Font ids are opaque per-document, but the
 *      emphasis font is recoverable by relative frequency (it recurs ~once per
 *      question), so we detect it within the doc rather than hardcoding.
 *
 * Emits the domain model with a per-question confidence score.
 */

interface DraftOption {
  label: string;
  text: string;
  correctByAsterisk: boolean;
  /** Dominant font of this option's line (for emphasis-answer detection). */
  font: string | null;
}

interface Draft {
  number: number;
  stemLines: string[];
  options: DraftOption[];
  inlineAnswer: string | null;
  explanationLines: string[];
  mode: "stem" | "options" | "explanation";
  /** False when the question sits under an explicit non-MCQ section header. */
  mcqSection: boolean;
}

export function parseExtracted(doc: ExtractedDoc, source: QuizSource): Quiz {
  const drafts: Draft[] = [];
  const keyMap = new Map<number, string>();
  let cur: Draft | null = null;
  let inKeySection = false;
  let sectionIsMcq = true; // until a header says otherwise, treat all as MCQ

  const commit = () => {
    if (cur) drafts.push(cur);
    cur = null;
  };

  for (const line of doc.lines) {
    const text = line.text;
    if (!text.trim()) continue;

    // Section header ("Section B: Short Answer") — closes the current question
    // and flips MCQ-eligibility for everything that follows.
    const sec = matchSectionHeader(text);
    if (sec) {
      commit();
      sectionIsMcq = sec.isMcq;
      inKeySection = false;
      continue;
    }

    // Answer-key header switches us into key-collection mode.
    if (isAnswerKeyHeader(text)) {
      inKeySection = true;
      commit();
      continue;
    }

    // Answer-key rows ("1. B 2. A 3. D"). Checked BEFORE question detection,
    // since such a row starts with a number marker too.
    if (isKeyLine(text)) {
      for (const p of keyPairs(text)) keyMap.set(p.number, p.label);
      continue;
    }
    if (inKeySection) {
      const ps = keyPairs(text);
      if (ps.length) {
        for (const p of ps) keyMap.set(p.number, p.label);
        continue;
      }
    }

    // New question.
    const q = matchQuestion(text);
    if (q) {
      commit();
      cur = {
        number: q.number,
        stemLines: q.rest ? [q.rest] : [],
        options: [],
        inlineAnswer: null,
        explanationLines: [],
        mode: "stem",
        mcqSection: sectionIsMcq,
      };
      continue;
    }

    if (!cur) continue; // preamble before the first question

    // Standalone answer tag.
    const tag = matchAnswerTag(text);
    if (tag) {
      cur.inlineAnswer = tag;
      continue;
    }

    // Explanation block.
    const exp = matchExplanation(text);
    if (exp != null) {
      cur.mode = "explanation";
      cur.explanationLines.push(exp);
      continue;
    }

    // Inline options (several markers on one line) — checked BEFORE single
    // option so "A) x  B) y  C) z" isn't misread as one option whose text
    // swallows the rest. Require >=3 sequential markers from A.
    const inline = splitInlineOptions(text);
    if (inline && inline.length >= 3 && isSequential(inline.map((o) => o.label))) {
      cur.mode = "options";
      const font = dominantFont(line.words);
      for (const o of inline) cur.options.push(makeDraftOption(o.label, o.text, font));
      continue;
    }

    // One option per line.
    const opt = matchOption(text);
    if (opt) {
      cur.mode = "options";
      cur.options.push(makeDraftOption(opt.label, opt.text, dominantFont(line.words)));
      continue;
    }

    // Continuation / wrapped lines.
    if (cur.mode === "options" && cur.options.length) {
      cur.options[cur.options.length - 1].text += ` ${text}`;
    } else if (cur.mode === "explanation") {
      cur.explanationLines.push(text);
    } else {
      cur.stemLines.push(text);
    }
  }
  commit();

  // Keep MCQ-shaped drafts; collect the rest as "skipped" so the review screen
  // can surface them instead of silently dropping them. A draft is MCQ-shaped
  // when it sits under an MCQ section AND has >=2 options. Everything else is:
  //  - under an explicit non-MCQ section header ("Section C: Long Answer"),
  //    whose multi-part a/b/c sub-questions otherwise masquerade as options; or
  //  - simply has <2 options (short-answer prompts, stray numbering).
  // We only surface a skipped draft that carries real content (a stem or at
  // least one option), so bare/stray numbering never becomes review noise.
  const mcq: Draft[] = [];
  const skipped: SkippedItem[] = [];
  for (const d of drafts) {
    if (d.mcqSection && d.options.length >= 2) {
      mcq.push(d);
    } else if (d.stemLines.some((l) => l.trim()) || d.options.length >= 1) {
      skipped.push(toSkipped(d));
    }
  }

  const emphasisFont = detectEmphasisFont(mcq);

  // Index-based IDs guarantee uniqueness even when source numbers repeat.
  const questions = mcq.map((d, i) => finalize(d, keyMap, i, emphasisFont));

  return {
    id: newQuizId(),
    title: deriveTitle(doc, source),
    source,
    questions,
    skipped: skipped.length ? skipped : undefined,
    createdAt: new Date().toISOString(),
  };
}

/** Turn a dropped draft into a review-surface `SkippedItem`, cleaning its text
 *  exactly as `finalize` would and labeling WHY it wasn't auto-imported. The
 *  non-MCQ-section reason takes priority since it's the most specific. */
function toSkipped(d: Draft): SkippedItem {
  const stem = splitEnumeratedStem(
    repairGluedWords(d.stemLines.join(" ").replace(/\s+/g, " ").trim()),
  );
  const options: QuestionOption[] = d.options.map((o) => ({
    label: o.label,
    text: repairGluedWords(o.text.replace(/\s+/g, " ").trim()),
  }));
  const reason = !d.mcqSection
    ? "Under a non-multiple-choice section"
    : d.options.length === 0
      ? "No answer options were detected"
      : "Only one answer option was detected";
  return { number: d.number, stem, options, reason };
}

/**
 * Pull every number→letter answer pair out of a document, ignoring questions.
 * Used to ingest a STANDALONE answer-key PDF (just "1. B  2. A  3. D …") as a
 * separate upload, so its answers can be merged onto a question-only quiz.
 * Mirrors the key-collection branch of `parseExtracted`: bare key rows are
 * recognized anywhere; after an "Answer Key" header we accept looser rows too.
 */
export function extractAnswerKeyPairs(doc: ExtractedDoc): KeyPair[] {
  const map = new Map<number, string>();
  let inKeySection = false;
  for (const line of doc.lines) {
    const text = line.text;
    if (!text.trim()) continue;
    if (isAnswerKeyHeader(text)) {
      inKeySection = true;
      continue;
    }
    if (isKeyLine(text)) {
      for (const p of keyPairs(text)) map.set(p.number, p.label);
      continue;
    }
    if (inKeySection) {
      const ps = keyPairs(text);
      if (ps.length) for (const p of ps) map.set(p.number, p.label);
    }
  }
  return [...map.entries()].map(([number, label]) => ({ number, label }));
}

function makeDraftOption(label: string, rawText: string, font: string | null): DraftOption {
  let text = rawText.trim();
  let correctByAsterisk = false;
  if (/[*★]\s*$/.test(text)) {
    correctByAsterisk = true;
    text = text.replace(/[*★]\s*$/, "").trim();
  }
  return { label, text, correctByAsterisk, font };
}

/** Character-weighted dominant font of a line's words (so a short label marker
 *  in a different font doesn't outvote the option's actual text). */
function dominantFont(words?: Word[]): string | null {
  if (!words || !words.length) return null;
  const weight = new Map<string, number>();
  for (const w of words) {
    if (!w.fontName) continue;
    const len = Math.max(1, w.text.trim().length);
    weight.set(w.fontName, (weight.get(w.fontName) ?? 0) + len);
  }
  let best: string | null = null;
  let bestW = 0;
  for (const [f, n] of weight) {
    if (n > bestW) {
      bestW = n;
      best = f;
    }
  }
  return best;
}

/** The font used to emphasize correct answers, if the document has one.
 *  It's the most common NON-regular option font, provided it recurs across a
 *  meaningful share of questions (≈ once each) and stays a clear minority. */
function detectEmphasisFont(drafts: Draft[]): string | null {
  const fontCount = new Map<string, number>();
  for (const d of drafts) {
    for (const o of d.options) {
      if (o.font) fontCount.set(o.font, (fontCount.get(o.font) ?? 0) + 1);
    }
  }
  if (fontCount.size < 2) return null;

  let regular: string | null = null;
  let regN = 0;
  for (const [f, n] of fontCount) {
    if (n > regN) {
      regN = n;
      regular = f;
    }
  }

  let emph: string | null = null;
  let emphN = 0;
  for (const [f, n] of fontCount) {
    if (f === regular) continue;
    if (n > emphN) {
      emphN = n;
      emph = f;
    }
  }

  const threshold = Math.max(2, Math.floor(drafts.length * 0.4));
  if (emph && emphN >= threshold && emphN < regN) return emph;
  return null;
}

function finalize(
  d: Draft,
  keyMap: Map<number, string>,
  index: number,
  emphasisFont: string | null,
): Question {
  const options: QuestionOption[] = d.options.map((o) => ({
    label: o.label,
    text: repairGluedWords(o.text.replace(/\s+/g, " ").trim()),
  }));

  // Answer signal priority: separate key > asterisk > tag line > emphasis font.
  const fromKey = keyMap.get(d.number) ?? null;
  const fromAsterisk = d.options.find((o) => o.correctByAsterisk)?.label ?? null;
  let fromFont: string | null = null;
  if (emphasisFont) {
    const emphasized = d.options.filter((o) => o.font === emphasisFont);
    if (emphasized.length === 1) fromFont = emphasized[0].label;
  }
  const correct = fromKey ?? fromAsterisk ?? d.inlineAnswer ?? fromFont ?? null;

  const flags: string[] = [];
  const distinct = new Set(
    [fromKey, fromAsterisk, d.inlineAnswer, fromFont].filter(Boolean) as string[],
  );
  if (distinct.size > 1) {
    flags.push(`Conflicting answer signals (${[...distinct].join(" / ")}) — using ${correct}`);
  }

  const stem = splitEnumeratedStem(
    repairGluedWords(d.stemLines.join(" ").replace(/\s+/g, " ").trim()),
  );
  const explanation = d.explanationLines.length
    ? repairGluedWords(d.explanationLines.join(" ").replace(/\s+/g, " ").trim())
    : null;

  const base: Omit<Question, "confidence"> = {
    id: newQuestionId(index + 1),
    number: d.number,
    type: "mcq",
    stem,
    options,
    correct,
    explanation,
    flags,
  };

  const scored = scoreQuestion(base);
  return { ...base, confidence: scored.confidence, flags: scored.flags };
}

/** First substantive line as a title; fall back to the filename. We skip form
 *  fields ("Last Name: ____") and near-empty lines so the real heading wins. */
function deriveTitle(doc: ExtractedDoc, source: QuizSource): string {
  for (const l of doc.lines) {
    const t = l.text.trim();
    if (!t) continue;
    if (matchQuestion(t) || isAnswerKeyHeader(t)) break; // reached the questions
    if (/_{3,}/.test(t)) continue; // form field line: "Student Number: ____"
    if (t.length <= 3 || t.length >= 120) continue;
    const letters = (t.match(/[A-Za-z]/g) ?? []).length;
    if (letters < 4) continue; // mostly punctuation / numbers
    return t;
  }
  return source.filename?.replace(/\.[^.]+$/, "") ?? "Untitled Quiz";
}
