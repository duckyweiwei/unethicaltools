import type { Question, QuestionOption, Quiz, QuizSource, SkippedItem } from "../../../domain/types";
import { newQuestionId, newQuizId } from "../../../domain/ids";
import { hasBlank } from "../../../study/cloze";
import type { ExtractedDoc, Word } from "../extract";
import { scoreQuestion } from "./confidence";
import {
  isAnswerKeyHeader,
  isEndMatter,
  isKeyLine,
  isSequential,
  type KeyPair,
  keyPairs,
  matchAnswerTag,
  matchAnswerTagText,
  matchExplanation,
  matchKeyText,
  matchMultiAnswerTag,
  matchMultiSelect,
  matchOption,
  matchQuestion,
  matchSectionHeader,
  matchTrueFalseLead,
  normalizeTrueFalse,
  parseMarkAllocation,
  repairGluedWords,
  splitEnumeratedStem,
  splitInlineOptions,
} from "./patterns";

export { parseMarkScheme } from "./mark-scheme";
export type { MarkSchemeEntry } from "./mark-scheme";

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
  /** Two-or-more option labels from a multi-answer tag ("Answers: B, D"), for
   *  "select all that apply" MCQs. Null when no multi-answer tag was seen. */
  inlineAnswers: string[] | null;
  /** Free-text answer found inline ("Answer: Mitochondria"), for short-answer. */
  openAnswer: string | null;
  explanationLines: string[];
  mode: "stem" | "options" | "explanation";
  /** False when the question sits under an explicit non-MCQ section header. */
  mcqSection: boolean;
}

export function parseExtracted(doc: ExtractedDoc, source: QuizSource): Quiz {
  const drafts: Draft[] = [];
  const keyMap = new Map<number, string>();
  // Free-text answers from a short-answer key ("1. Mitochondria"), keyed by
  // question number — the reference text revealed for self-grading.
  const answerKeyText = new Map<number, string>();
  let cur: Draft | null = null;
  let inKeySection = false;
  let sectionIsMcq = true; // until a header says otherwise, treat all as MCQ
  // Monotonic-number guard: `lastQ` is the number of the last STARTED question;
  // `enumNext` is the next index expected while absorbing a stem's numbered
  // sub-enumeration ("Define the following: 1. … 2. … 3. …"). Both reset at
  // section / answer-key boundaries so each section can renumber from 1.
  let lastQ: number | null = null;
  let enumNext: number | null = null;

  const commit = () => {
    if (cur) drafts.push(cur);
    cur = null;
  };

  for (let li = 0; li < doc.lines.length; li++) {
    const line = doc.lines[li];
    const text = line.text;
    if (!text.trim()) continue;

    // End-matter ("References:", "Disclaimer:", "Acknowledgements") trails the
    // last question on a real exam paper — a citation/copyright block that would
    // otherwise bleed into the final question's stem or last option (its numbered
    // citations look like a sub-enumeration). Once we've begun parsing questions,
    // the first such header ends the paper: commit the open question and stop.
    if ((cur || drafts.length) && isEndMatter(text)) {
      commit();
      break;
    }

    // Section header ("Section B: Short Answer") — closes the current question
    // and flips MCQ-eligibility for everything that follows.
    const sec = matchSectionHeader(text);
    if (sec) {
      commit();
      sectionIsMcq = sec.isMcq;
      inKeySection = false;
      lastQ = null;
      enumNext = null;
      continue;
    }

    // Answer-key header switches us into key-collection mode — but only a REAL
    // one. A diagram legend ("Key:") matches the same header shape, so we require
    // a bare "Key" to be corroborated by answer-like rows just below it before we
    // believe it (an explicit "Answer(s)" header is always honored). Without this,
    // a pedigree/diagram "Key:" mid-question swallows that question's options.
    if (isAnswerKeyHeader(text) && answerKeyHeaderConfirmed(text, doc.lines, li)) {
      inKeySection = true;
      commit();
      lastQ = null;
      enumNext = null;
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
      // No letter pairs on this key row → a free-text short-answer key entry.
      const kt = matchKeyText(text);
      if (kt) {
        answerKeyText.set(kt.number, kt.text);
        continue;
      }
    }

    // New question — guarded against a stem's numbered sub-enumeration
    // ("Define the following: 1. … 2. … 3. …") whose items each parse as a
    // numbered question. We START a new question only when the number ADVANCES
    // the main sequence; a numbering reset (n <= lastQ) anchors a sub-list, and
    // consecutive items continue it. The one genuinely ambiguous case — a
    // continuation index that coincides with the resumed main number — is
    // broken by looking ahead: a real question carries its own options.
    const q = matchQuestion(text);
    if (q) {
      const n = q.number;
      let startNew: boolean;
      if (lastQ === null) {
        startNew = true; // first question in the doc / section
      } else if (enumNext !== null && n === enumNext) {
        // Continues an anchored sub-enumeration — unless this line has its own
        // options, which makes it a real (resumed) question instead.
        startNew = hasOwnOptions(doc.lines, li, q.rest);
      } else if (n <= lastQ) {
        startNew = false; // numbering reset → anchor a sub-enumeration
      } else {
        startNew = true; // advances the main sequence → genuine new question
      }

      if (startNew) {
        commit();
        cur = {
          number: n,
          stemLines: q.rest ? [q.rest] : [],
          options: [],
          inlineAnswer: null,
          inlineAnswers: null,
          openAnswer: null,
          explanationLines: [],
          mode: "stem",
          mcqSection: sectionIsMcq,
        };
        lastQ = n;
        enumNext = null;
        continue;
      }

      // Absorbed as a sub-enumeration item: advance the expected index and let
      // the full line (marker included) fall through to stem continuation.
      enumNext = n + 1;
    }

    if (!cur) continue; // preamble before the first question

    // Standalone answer tag — a bare option letter ("Answer: B") for MCQs, a
    // multi-letter set ("Answers: B, D") for "select all that apply" MCQs, or
    // free text ("Answer: Mitochondria") for short-answer items. Multi-letter is
    // tried first (it requires >=2 letters, so it never steals a single-letter
    // tag); the single-letter form next; only a multi-character word answer falls
    // through to free text.
    const multiTag = matchMultiAnswerTag(text);
    if (multiTag) {
      cur.inlineAnswers = multiTag;
      continue;
    }
    const tag = matchAnswerTag(text);
    if (tag) {
      cur.inlineAnswer = tag;
      continue;
    }
    const tagText = matchAnswerTagText(text);
    if (tagText) {
      cur.openAnswer = tagText;
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
  type Kept =
    | { d: Draft; kind: "mcq" }
    | { d: Draft; kind: "diagram"; labels: string[]; stem: string }
    | { d: Draft; kind: "tf"; statement: string; correct: "True" | "False"; marks: number | null }
    | { d: Draft; kind: "open"; answer: string; marks: number | null }
    | { d: Draft; kind: "cloze"; answer: string; marks: number | null };
  const kept: Kept[] = [];
  const skipped: SkippedItem[] = [];
  for (const d of drafts) {
    // Multi-part structured question (parts carry mark allocations) — split into
    // per-part review items rather than mis-importing the parts as MCQ options.
    if (isMultiPart(d)) {
      skipped.push(...expandMultiPart(d));
      continue;
    }
    // Labeled-diagram MCQ — choices are bare letters printed ON a figure, not
    // text. Checked BEFORE the ordinary MCQ keep because such a draft may carry a
    // stray pseudo-option that would otherwise pass the >=2 gate as a broken MCQ;
    // detectDiagramLabels rejects anything with real option text, so genuine text
    // MCQs fall straight through to the keep below.
    if (d.mcqSection) {
      const diagram = detectDiagramLabels(d);
      if (diagram) {
        kept.push({ d, kind: "diagram", labels: diagram.labels, stem: diagram.stem });
        continue;
      }
    }
    if (d.mcqSection && d.options.length >= 2) {
      kept.push({ d, kind: "mcq" });
      continue;
    }
    const hasStem = d.stemLines.some((l) => l.trim());
    const { text: cleanedStem, marks: stemMarks } = parseMarkAllocation(
      repairGluedWords(d.stemLines.join(" ").replace(/\s+/g, " ").trim()),
    );

    // A True/False prompt ("True or False: <statement>") with no options of its
    // own. Modeled as a two-option question (A = True, B = False) so it plays,
    // edits, and grades through the existing MCQ paths. The verdict is read from
    // the same signals an MCQ answer comes from — inline tag, answer key, or a
    // free-text key — where it may be a letter ("F") or a word ("False").
    // Without a resolvable verdict it falls through (open / skipped) unchanged.
    if (d.options.length < 2) {
      const statement = matchTrueFalseLead(cleanedStem);
      if (statement && /[A-Za-z]/.test(statement)) {
        const verdict = normalizeTrueFalse(
          d.openAnswer ?? d.inlineAnswer ?? answerKeyText.get(d.number) ?? keyMap.get(d.number),
        );
        if (verdict) {
          kept.push({ d, kind: "tf", statement, correct: verdict, marks: stemMarks });
          continue;
        }
      }
    }

    // A self-graded prompt: a stem, too few options to be MCQ, and a reference
    // answer we can reveal — found inline or via a short-answer key. A stem that
    // carries a fill-in-the-blank gap ("… is the ______.") becomes a `cloze`, so
    // the player can reveal the answer IN the blank; everything else is a plain
    // short-answer ("open"). Without an answer it stays skipped (nothing to
    // grade against), exactly as before.
    if (hasStem && d.options.length < 2) {
      const answer = d.openAnswer ?? answerKeyText.get(d.number) ?? null;
      if (answer) {
        kept.push({ d, kind: hasBlank(cleanedStem) ? "cloze" : "open", answer, marks: stemMarks });
        continue;
      }
    }
    if (hasStem || d.options.length >= 1) {
      // Don't surface a block this tool fundamentally can't model as an MCQ — a
      // fill-in-the-table prompt, or a multi-part problem graded by points
      // ("A … (7 Points)  B … (3 Points)"). Identifying these here keeps the
      // review screen from inviting the user to "Add as question" something there
      // is no clean way to import; like the unsupported figure sections, it's
      // dropped rather than exported.
      const sk = toSkipped(d);
      if (!isUnsupportedFreeResponse(sk.stem, sk.options)) skipped.push(sk);
    }
  }

  const emphasisFont = detectEmphasisFont(
    kept.flatMap((k) => (k.kind === "mcq" ? [k.d] : [])),
  );

  // Index-based IDs guarantee uniqueness even when source numbers repeat. MCQ,
  // True/False, short-answer, and fill-in-the-blank are finalized in doc order.
  const questions = kept.map((k, i) =>
    k.kind === "mcq"
      ? finalize(k.d, keyMap, i, emphasisFont)
      : k.kind === "diagram"
        ? finalizeDiagram(k.d, k.labels, k.stem, i)
        : k.kind === "tf"
          ? finalizeTrueFalse(k.d, k.statement, k.correct, i, k.marks)
          : finalizeOpen(k.d, k.answer, i, k.kind === "cloze" ? "cloze" : "open", k.marks),
  );

  return {
    id: newQuizId(),
    title: deriveTitle(doc, source),
    source,
    questions,
    skipped: skipped.length ? skipped : undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Look ahead from the numbered line at `idx` to decide whether it begins a real
 * question (its own answer options follow) rather than a bare sub-enumeration
 * item that merely shares the numbering space. Consulted ONLY for the ambiguous
 * tie where a sub-list's next index coincides with the resumed main number.
 * Scans just until the next question marker or section boundary, so it never
 * borrows a later question's options. Options may be inline on the same line
 * ("4. Which? A) x B) y") or on the lines that follow.
 */
function hasOwnOptions(lines: ExtractedDoc["lines"], idx: number, rest: string): boolean {
  const inl = splitInlineOptions(rest);
  if (inl && inl.length >= 2 && isSequential(inl.map((o) => o.label))) return true;
  let count = 0;
  for (let j = idx + 1; j < lines.length; j++) {
    const t = lines[j].text;
    if (!t.trim()) continue;
    if (matchSectionHeader(t) || isAnswerKeyHeader(t) || matchQuestion(t)) break;
    const inline = splitInlineOptions(t);
    if (inline && inline.length >= 2 && isSequential(inline.map((o) => o.label))) return true;
    if (matchOption(t) && ++count >= 2) return true;
  }
  return false;
}

/**
 * Decide whether an answer-key-shaped header is REALLY an answer key, so a
 * diagram legend ("Key:") isn't mistaken for one and swallow the question's
 * options into key-collection mode. An explicit "Answer(s)" header is always
 * honored. A BARE "Key" is believed only when corroborated: we look ahead a few
 * non-empty lines and accept it the moment a genuine letter-pair key row ("1. B
 * 2. A 3. D") appears, but reject it as soon as a question or section header
 * shows up first — the legend case, where the next real thing is the question's
 * own options or the following question, never a key row.
 */
function answerKeyHeaderConfirmed(
  header: string,
  lines: ExtractedDoc["lines"],
  idx: number,
): boolean {
  if (/answer/i.test(header)) return true;
  let seen = 0;
  for (let j = idx + 1; j < lines.length && seen < 8; j++) {
    const t = lines[j].text;
    if (!t.trim()) continue;
    seen++;
    if (isKeyLine(t)) return true; // "1. B  2. A  3. D" → a real key follows
    if (matchQuestion(t) || matchSectionHeader(t)) return false; // legend, not a key
  }
  return false;
}

/** Flag shown on a recovered labeled-diagram MCQ so the review screen explains
 *  why its choices have no text and where the picture will come from. */
const DIAGRAM_FLAG =
  "Diagram question — choose the labelled position on the figure (captured from the PDF)";

// A STANDALONE label printed on a figure: "A.", "(C)", "D)" surrounded by
// whitespace/line-edges. Deliberately narrow (single A–H letter, no following
// text) so it never matches an ordinary text option "A) Nucleus".
const DIAGRAM_LABEL_RE = /(?:^|\s)\(?([A-H])[.)](?=\s|$)/g;

/**
 * Recover a LABELED-DIAGRAM MCQ — one whose choices A/B/C/D are bare letters
 * printed ON a figure (vector line-art the extractor can't see) rather than text
 * options. PDF extraction leaves those letters glued into the stem ("… points to
 * C. A. D. B.") and yields no usable options, so the draft would otherwise be
 * dropped as un-importable.
 *
 * Detected conservatively: it fires ONLY when no captured option carries real
 * text (a leading glued-on label like "D." is stripped before the test), and the
 * stem/options contain a run of standalone labels A, B, C, … of length >= 3. A
 * genuine text MCQ is rejected immediately (its options have text), so normal
 * parsing is untouched. Returns the labels in A,B,C order and the stem with those
 * standalone letters removed, or null when this isn't a diagram MCQ.
 */
function detectDiagramLabels(d: Draft): { labels: string[]; stem: string } | null {
  for (const o of d.options) {
    const body = o.text.replace(/^\s*\(?[A-H][.)]\s*/, "").trim();
    if (/\w/.test(body)) return null; // a real text option → not a diagram MCQ
  }
  const blob = [...d.stemLines, ...d.options.map((o) => `${o.label}. ${o.text}`)].join(" ");
  DIAGRAM_LABEL_RE.lastIndex = 0;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = DIAGRAM_LABEL_RE.exec(blob))) found.add(m[1].toUpperCase());
  const labels: string[] = [];
  for (let i = 0; i < 8; i++) {
    const ch = String.fromCharCode(65 + i);
    if (!found.has(ch)) break; // require the run to be consecutive from A
    labels.push(ch);
  }
  if (labels.length < 3) return null;
  const stem = repairGluedWords(
    d.stemLines.join(" ").replace(DIAGRAM_LABEL_RE, " ").replace(/\s+/g, " ").trim(),
  );
  if ((stem.match(/[A-Za-z]/g) ?? []).length < 3) return null; // nothing but stray letters left
  return { labels, stem };
}

const MULTIPART_REASON = "Multi-part question — add an answer or its mark scheme";

/**
 * A multi-part / "structured" exam question — a shared intro followed by parts
 * "(a) … (b) …", each with its own marks and answer — is NOT a multiple-choice
 * question, even though PDF extraction captures the parts as if they were the
 * options "A) … B) …". We recognise it deterministically by the one signal that
 * cleanly separates structured questions from MCQs: exam papers print a MARK
 * ALLOCATION on the parts ("(a) … [3]"), which genuine MCQ options never carry.
 * Conservative by design — without that signal a draft keeps its MCQ treatment,
 * so ordinary multiple-choice parsing is untouched.
 */
function isMultiPart(d: Draft): boolean {
  if (d.options.length < 1) return false;
  const marked = d.options.filter((o) => parseMarkAllocation(o.text).marks != null).length;
  if (marked >= 2) return true;
  // A single marked part beneath a real intro stem is structured too.
  return marked >= 1 && d.options.length === 1 && d.stemLines.some((l) => l.trim());
}

/**
 * Split a detected multi-part draft into one review item per part, each carrying
 * its part path ("a", "b") and marks. The shared intro is prepended so a part
 * reads in context, and the part marker is restored ("(a) …"). Parts have no
 * answer in a question-only paper, so they surface as `skipped` for review until
 * a mark scheme (or the user) supplies answers — never as a bogus MCQ. The
 * `part` field lets a later mark-scheme match promote a part to a real question.
 */
function expandMultiPart(d: Draft): SkippedItem[] {
  const intro = cleanStem(d.stemLines).stem;
  const out: SkippedItem[] = [];
  for (const o of d.options) {
    const part = o.label.toLowerCase();
    // Strip mark allocations and repair glue; keep any nested "(i)/(ii)" inline
    // (splitting nested roman sub-parts into their own items is a later refinement).
    const { text, marks } = parseMarkAllocation(
      repairGluedWords(o.text.replace(/\s+/g, " ").trim()),
    );
    if (!text.trim()) continue; // a bare "(a)" marker with no body is noise
    const stem = (intro ? `${intro}\n\n(${part}) ${text}` : `(${part}) ${text}`).trim();
    out.push({ number: d.number, part, marks, stem, options: [], reason: MULTIPART_REASON });
  }
  return out;
}

/** Turn a dropped draft into a review-surface `SkippedItem`, cleaning its text
 *  exactly as `finalize` would and labeling WHY it wasn't auto-imported. The
 *  non-MCQ-section reason takes priority since it's the most specific. */
function toSkipped(d: Draft): SkippedItem {
  const { stem } = cleanStem(d.stemLines);
  const options: QuestionOption[] = d.options.map((o) => ({
    label: o.label,
    text: cleanOptionText(o.text),
  }));
  const reason = !d.mcqSection
    ? "Under a non-multiple-choice section"
    : d.options.length === 0
      ? "No answer options were detected"
      : "Only one answer option was detected";
  return { number: d.number, stem, options, reason };
}

/**
 * Identify an exam free-response block this MCQ tool can't represent, so the
 * review screen doesn't offer it for import. Two marks, either sufficient:
 *   • a FILL-IN-THE-TABLE instruction ("Complete the table above") — a data grid
 *     the user is meant to fill, which has no multiple-choice shape; or
 *   • a MULTI-PART, points-graded structure ("A … (7 Points)  B … (3 Points)"),
 *     detected by ≥2 "(N points)" allocations — an essay/worked-problem set.
 * Scans the stem AND any sub-part text the parser captured as pseudo-options
 * (the "A. … B. … C. …" parts often masquerade as options).
 */
function isUnsupportedFreeResponse(stem: string, options: QuestionOption[]): boolean {
  const blob = `${stem} ${options.map((o) => o.text).join(" ")}`;
  const tableFill = /\b(complete|fill\s+in|fill\s+out)\b[^.]{0,40}\btable\b/i.test(blob);
  const pointParts = (blob.match(/\(\s*\d+\s*points?\s*\)/gi) ?? []).length;
  return tableFill || pointParts >= 2;
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

/**
 * Clean a draft's stem lines into display text plus any mark allocation: join →
 * repair glued words → strip exam mark allocations ("(2 marks)", "[3]") as
 * metadata → split a flattened roman enumeration onto its own lines.
 */
function cleanStem(stemLines: string[]): { stem: string; marks: number | null } {
  const joined = repairGluedWords(stemLines.join(" ").replace(/\s+/g, " ").trim());
  const { text, marks } = parseMarkAllocation(joined);
  return { stem: splitEnumeratedStem(text), marks };
}

/** Clean option text like a stem (minus enumeration splitting): repair glued
 *  words and strip any mark allocation so "(2 marks)" never clutters a choice. */
function cleanOptionText(raw: string): string {
  return parseMarkAllocation(repairGluedWords(raw.replace(/\s+/g, " ").trim())).text;
}

function finalize(
  d: Draft,
  keyMap: Map<number, string>,
  index: number,
  emphasisFont: string | null,
): Question {
  const options: QuestionOption[] = d.options.map((o) => ({
    label: o.label,
    text: cleanOptionText(o.text),
  }));
  const { stem, marks } = cleanStem(d.stemLines);

  // Single-answer signal priority: separate key > asterisk > tag line > emphasis font.
  const fromKey = keyMap.get(d.number) ?? null;
  const starred = d.options.filter((o) => o.correctByAsterisk).map((o) => o.label);
  const fromAsterisk = starred[0] ?? null;
  const emphasized = emphasisFont
    ? d.options.filter((o) => o.font === emphasisFont).map((o) => o.label)
    : [];
  const fromFont = emphasized.length === 1 ? emphasized[0] : null;
  const correctSingle = fromKey ?? fromAsterisk ?? d.inlineAnswer ?? fromFont ?? null;

  // Multi-select ("select all that apply" / "choose two"): treat the question as
  // multi-answer only when we have an unambiguous set of >=2 correct option
  // labels. Signals, in priority order: an explicit multi-letter tag ("Answers:
  // B, D"); two-or-more starred options; or — ONLY when the stem actually asks
  // for several — two-or-more emphasis-font options. Never fires from a single
  // signal, so ordinary single-answer MCQs are completely unaffected.
  const hint = matchMultiSelect(stem);
  const optionLabels = new Set(options.map((o) => o.label));
  const asSet = (labels: string[]): string[] | null => {
    const inOrder = options
      .map((o) => o.label)
      .filter((l) => labels.includes(l) && optionLabels.has(l));
    return inOrder.length >= 2 ? inOrder : null;
  };
  const correctSet =
    asSet(d.inlineAnswers ?? []) ?? asSet(starred) ?? (hint ? asSet(emphasized) : null);

  const correct = correctSet ? correctSet[0] : correctSingle;

  const flags: string[] = [];
  const distinct = new Set(
    [fromKey, fromAsterisk, d.inlineAnswer, fromFont].filter(Boolean) as string[],
  );
  if (!correctSet && distinct.size > 1) {
    flags.push(`Conflicting answer signals (${[...distinct].join(" / ")}) — using ${correct}`);
  }
  // The stem asks for multiple answers but we resolved fewer than two — surface
  // it so the user can complete the key (checkboxes) in the editor rather than
  // ship a single-answer key for a "select all" question.
  if (hint && !correctSet) {
    flags.push(
      hint.count != null
        ? `Stem asks to choose ${hint.count}, but only one answer was detected`
        : "Stem says “select all that apply”, but only one answer was detected",
    );
  }

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
    ...(correctSet ? { correctSet } : {}),
    explanation,
    ...(marks != null ? { marks } : {}),
    flags,
  };

  const scored = scoreQuestion(base);
  return { ...base, confidence: scored.confidence, flags: scored.flags };
}

/**
 * Finalize a recovered LABELED-DIAGRAM MCQ. Its choices are the bare letters
 * printed on the figure, so each option keeps its label with EMPTY text (the
 * player/editor render the letter itself). No answer can be read from text — the
 * figure is vector art the server can't see — so `correct` stays null and
 * `needsDiagram` asks the client to rasterize the page region and attach it. The
 * explanatory diagram flag leads, ahead of the generic confidence flags.
 */
function finalizeDiagram(
  d: Draft,
  labels: string[],
  cleanedStem: string,
  index: number,
): Question {
  const { text, marks } = parseMarkAllocation(cleanedStem);
  const stem = splitEnumeratedStem(text);
  const options: QuestionOption[] = labels.map((label) => ({ label, text: "" }));
  const explanation = d.explanationLines.length
    ? repairGluedWords(d.explanationLines.join(" ").replace(/\s+/g, " ").trim())
    : null;
  const base: Omit<Question, "confidence"> = {
    id: newQuestionId(index + 1),
    number: d.number,
    type: "mcq",
    stem,
    options,
    correct: null,
    explanation,
    ...(marks != null ? { marks } : {}),
    needsDiagram: true,
    flags: [],
  };
  const scored = scoreQuestion(base);
  return { ...base, confidence: scored.confidence, flags: [DIAGRAM_FLAG, ...scored.flags] };
}

/** Finalize a True/False draft into a two-option question (A = True, B = False)
 *  with the correct label set from the detected verdict. Modeling it as a 2-MCQ
 *  lets the player render True/False choices and grade by label, and the editor
 *  edit it, with no type-specific plumbing in either. `statement` is the stem
 *  with the "True or False:" lead-in already stripped and glue-repaired. */
function finalizeTrueFalse(
  d: Draft,
  statement: string,
  correct: "True" | "False",
  index: number,
  marks: number | null,
): Question {
  const stem = splitEnumeratedStem(statement);
  const explanation = d.explanationLines.length
    ? repairGluedWords(d.explanationLines.join(" ").replace(/\s+/g, " ").trim())
    : null;
  const base: Omit<Question, "confidence"> = {
    id: newQuestionId(index + 1),
    number: d.number,
    type: "true_false",
    stem,
    options: [
      { label: "A", text: "True" },
      { label: "B", text: "False" },
    ],
    correct: correct === "True" ? "A" : "B",
    explanation,
    ...(marks != null ? { marks } : {}),
    flags: [],
  };
  const scored = scoreQuestion(base);
  return { ...base, confidence: scored.confidence, flags: scored.flags };
}

/** Finalize a self-graded draft: no options, no labelled correct — just the
 *  verbatim stem and a reference answer the player reveals for self-grading.
 *  Cleaned exactly like an MCQ stem. `type` distinguishes a plain short-answer
 *  ("open") from a fill-in-the-blank ("cloze") whose stem keeps its blank so the
 *  player can reveal the answer inside it. */
function finalizeOpen(
  d: Draft,
  answer: string,
  index: number,
  type: "open" | "cloze",
  marks: number | null,
): Question {
  const { stem } = cleanStem(d.stemLines);
  const explanation = d.explanationLines.length
    ? repairGluedWords(d.explanationLines.join(" ").replace(/\s+/g, " ").trim())
    : null;
  const base: Omit<Question, "confidence"> = {
    id: newQuestionId(index + 1),
    number: d.number,
    type,
    stem,
    options: [],
    correct: null,
    answerText: repairGluedWords(answer.replace(/\s+/g, " ").trim()),
    explanation,
    ...(marks != null ? { marks } : {}),
    flags: [],
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
