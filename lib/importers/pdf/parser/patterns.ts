/**
 * The regular signals a practice test latches onto. Each helper is a small,
 * testable predicate so the parser stays readable and the ruleset is easy to
 * extend (new annotation styles, new question markers) without rewrites.
 */

export interface QuestionMatch {
  number: number;
  rest: string;
}

// "1." / "1)" / "Q1" / "Q1." / "Question 1:" ...
// The bare-number form accepts either a real space after the marker ("10. If")
// OR no space when a letter follows ("11.In") — real PDFs drop the space — while
// still rejecting decimals like "11.5" (the lookahead requires a letter, and a
// genuine space lets "5. 2 plus 2" through).
const QUESTION_RE =
  /^\s*(?:Q(?:uestion)?\s*(\d{1,3})\s*[.):]?\s+(.*)|(\d{1,3})[.)](?:\s+|(?=[A-Za-z]))(.*))$/i;

export function matchQuestion(line: string): QuestionMatch | null {
  const m = QUESTION_RE.exec(line);
  if (!m) return null;
  return { number: parseInt(m[1] ?? m[3], 10), rest: (m[2] ?? m[4] ?? "").trim() };
}

export interface OptionMatch {
  label: string;
  text: string;
}

// "A) text" / "A. text" / "(A) text" / "(a) text"
const OPTION_RE = /^\s*(?:\(([A-Ha-h])\)|([A-Ha-h])[.)])\s+(.*)$/;

export function matchOption(line: string): OptionMatch | null {
  const m = OPTION_RE.exec(line);
  if (!m) return null;
  return { label: (m[1] ?? m[2]).toUpperCase(), text: (m[3] ?? "").trim() };
}

// All options on one line: "A) Nucleus  B) Mitochondria  C) Ribosome ..."
const INLINE_MARKER = /(?:^|\s)(?:\(([A-Ha-h])\)|([A-Ha-h])[.)])\s+/g;

export function splitInlineOptions(line: string): OptionMatch[] | null {
  INLINE_MARKER.lastIndex = 0;
  const marks: { label: string; markStart: number; textStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = INLINE_MARKER.exec(line))) {
    marks.push({ label: (m[1] ?? m[2]).toUpperCase(), markStart: m.index, textStart: INLINE_MARKER.lastIndex });
  }
  if (marks.length < 2) return null;

  const out: OptionMatch[] = [];
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].markStart : line.length;
    out.push({ label: marks[i].label, text: line.slice(marks[i].textStart, end).trim() });
  }
  return out;
}

// "Ans: B" / "Answer - C" / "Correct Answer: D"
const ANSWER_TAG_RE = /^\s*(?:Ans|Answer|Correct(?:\s*Answer)?)\s*[:.\-]?\s*\(?([A-Ha-h])\)?\s*$/i;

export function matchAnswerTag(line: string): string | null {
  const m = ANSWER_TAG_RE.exec(line);
  return m ? m[1].toUpperCase() : null;
}

// "Explanation: ..." / "Rationale - ..."
const EXPLANATION_RE = /^\s*(?:Explanation|Rationale|Reason|Why)\s*[:.\-]\s*(.*)$/i;

export function matchExplanation(line: string): string | null {
  const m = EXPLANATION_RE.exec(line);
  return m ? (m[1] ?? "").trim() : null;
}

// "Answer Key" / "Answers" / "Key" header line
export function isAnswerKeyHeader(line: string): boolean {
  return /^\s*(?:answer\s*key|answers?|key)\s*:?\s*$/i.test(line);
}

// "Section A: Multiple Choice" / "Part 2 — Short Answer" ...
// We require a delimiter right after the label so prose like
// "Section B is worth 20 points" (no colon) is NOT treated as a header.
const SECTION_RE = /^\s*(?:section|part)\s+[A-Za-z0-9]{1,3}\s*[:.\-–—)]/i;
const NON_MCQ_HINT =
  /\b(?:short[\s-]*answer|long[\s-]*answer|essays?|written|free[\s-]*response|problems?)\b/i;

export interface SectionMatch {
  /** False for sections explicitly marked short/long answer, essay, etc. */
  isMcq: boolean;
}

/**
 * Recognize an exam section header and classify whether it holds MCQs.
 * Returns null for ordinary lines. MCQ is the default (so a plain list of
 * questions with no headers — the common case — stays fully eligible); only an
 * explicit non-MCQ hint flips it off.
 */
export function matchSectionHeader(line: string): SectionMatch | null {
  if (!SECTION_RE.test(line)) return null;
  return { isMcq: !NON_MCQ_HINT.test(line) };
}

const KEY_PAIR_RE = /(\d{1,3})\s*[.):]\s*\(?([A-Ha-h])\)?/g;

export interface KeyPair {
  number: number;
  label: string;
}

export function keyPairs(line: string): KeyPair[] {
  KEY_PAIR_RE.lastIndex = 0;
  const out: KeyPair[] = [];
  let m: RegExpExecArray | null;
  while ((m = KEY_PAIR_RE.exec(line))) out.push({ number: parseInt(m[1], 10), label: m[2].toUpperCase() });
  return out;
}

/**
 * True when a line is essentially ONLY number->letter pairs, e.g.
 * "1. B 2. A 3. D" or "1) C". Checked BEFORE question detection so an answer
 * key row isn't misread as "question 1 with stem 'B 2. A 3. D'".
 * A real stem like "1. A patient presents..." survives because removing the
 * "1. A" pair leaves substantial text.
 */
export function isKeyLine(line: string): boolean {
  const pairs = keyPairs(line);
  if (pairs.length === 0) return false;
  const leftover = line.replace(KEY_PAIR_RE, " ").replace(/[\s,;|]+/g, "").trim();
  return leftover.length === 0;
}

export function isSequential(labels: string[]): boolean {
  if (labels.length < 2) return false;
  return labels.every((l, i) => l === String.fromCharCode(65 + i));
}

/**
 * Repair words that PDF text-extraction glued together by dropping the space
 * (e.g. "which of the following isfalse?" → "… is false?"). Conservative by
 * construction: every pattern only matches letter runs that are NOT themselves
 * English words, so a real word is never split. We target the function-word
 * glue that dominates quiz phrasing rather than attempting a general speller.
 */
const GLUE_FIXES: Array<[RegExp, string]> = [
  // copula/auxiliary fused to a truth- or comparison-word: "isfalse", "aretrue"
  [
    /\b(is|are|was|were|be|been|being)(true|false|correct|incorrect|right|wrong|valid|invalid|equal|greater|less|positive|negative)\b/gi,
    "$1 $2",
  ],
  // auxiliary fused to "not" — note "cannot" is a real word, so "can" is omitted
  [/\b(is|are|was|were|do|does|did|will|would|should|could|has|have|had|may|might|must)(not)\b/gi, "$1 $2"],
  // "the following" and the article fused to a preceding preposition/conjunction
  [/\b(the)(following)\b/gi, "$1 $2"],
  [/\b(of|to|in|on|for|at|by|with|from|into|than|that|then|when|where)(the)\b/gi, "$1 $2"],
  // quantifier/determiner fused to "of": "noneof", "whichof", "allof"
  [/\b(which|none|all|each|both|one|some|most|any)(of)\b/gi, "$1 $2"],
];

export function repairGluedWords(text: string): string {
  let out = text;
  for (const [re, rep] of GLUE_FIXES) out = out.replace(re, rep);
  return out;
}

const ROMAN_ORDER = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
// Longest tokens first so "iii." isn't matched as "ii" + a dangling "i".
const ROMAN_MARK = /(^|[\s(])((?:viii|vii|iii|ii|ix|iv|vi|xi|x|v|i))[.)]\s+/gi;

/**
 * Break enumerated sub-statements that PDF flattening bunched into a single
 * stem ("… which is correct? i. … ii. … iii. …") onto their own lines, so the
 * question reads as a list instead of a wall of text. Fires only when ≥2
 * markers appear in correct roman order starting at "i", which keeps a stray
 * "i." in ordinary prose untouched. The inserted newlines render as separate
 * lines via the player/preview's `whitespace-pre-line`.
 */
export function splitEnumeratedStem(stem: string): string {
  ROMAN_MARK.lastIndex = 0;
  const marks: { at: number; token: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = ROMAN_MARK.exec(stem))) {
    marks.push({ at: m.index + m[1].length, token: m[2].toLowerCase() });
  }
  let run = 0;
  while (run < marks.length && marks[run].token === ROMAN_ORDER[run]) run++;
  if (run < 2) return stem;

  const head = stem.slice(0, marks[0].at).trim();
  const parts: string[] = head ? [head] : [];
  for (let i = 0; i < run; i++) {
    const start = marks[i].at;
    const end = i + 1 < run ? marks[i + 1].at : stem.length;
    parts.push(stem.slice(start, end).trim());
  }
  return parts.join("\n");
}
