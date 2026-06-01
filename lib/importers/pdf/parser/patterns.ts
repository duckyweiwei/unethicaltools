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

// A MULTI-answer tag: "Answers: B, D" / "Ans - A C" / "Correct answers: B and D"
// / "Answer: A, C, E". Two or more option letters, separated by commas, spaces,
// "and", "&", or slashes. Anchored end-to-end and requiring a delimiter run
// between letters, so a single-letter "Answer: B" (handled by `matchAnswerTag`)
// and ordinary prose never match. Returns the de-duplicated, uppercased labels
// in the order written, or null when fewer than two distinct letters are found.
const MULTI_ANSWER_TAG_RE =
  /^\s*(?:Ans|Answers?|Correct(?:\s*Answers?)?)\s*[:.\-]?\s*((?:\(?[A-Ha-h]\)?(?:\s*(?:,|and|&|\/|\s)\s*)?){2,})\s*$/i;

export function matchMultiAnswerTag(line: string): string[] | null {
  const m = MULTI_ANSWER_TAG_RE.exec(line);
  if (!m) return null;
  // Pull STANDALONE option letters only (word-boundaried), so the "and" written
  // between letters — "A and C" — doesn't leak its own a/d as bogus answers.
  const letters = (m[1].match(/\b[A-Ha-h]\b/g) ?? []).map((c) => c.toUpperCase());
  const uniq = [...new Set(letters)];
  return uniq.length >= 2 ? uniq : null;
}

// A multi-select INSTRUCTION in the stem: "Select all that apply", "Choose ALL
// that apply", "Choose two", "Pick three", "Select 2 of the following". The count
// word (two/three/…) or digit is captured when stated so the parser knows how
// many answers to expect; "all that apply" implies an open count (null). Matched
// case-insensitively anywhere in the stem.
const MULTI_SELECT_RE =
  /\b(?:select|choose|pick|identify|mark|tick|check)\b[^.?!]{0,30}?\b(?:(all\s+that\s+apply)|(two|three|four|five|2|3|4|5)\b)/i;
const COUNT_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 };

export interface MultiSelectHint {
  /** How many answers the instruction asks for; null for "all that apply". */
  count: number | null;
}

export function matchMultiSelect(stem: string): MultiSelectHint | null {
  const m = MULTI_SELECT_RE.exec(stem);
  if (!m) return null;
  if (m[1]) return { count: null }; // "all that apply"
  const tok = (m[2] ?? "").toLowerCase();
  const count = COUNT_WORDS[tok] ?? (parseInt(tok, 10) || null);
  return { count };
}

// Free-text answer tag for short-answer items: "Answer: Mitochondria",
// "Ans - The nucleus controls the cell". A delimiter is required (so ordinary
// prose merely starting with "Answer" isn't captured). The bare-letter form is
// matched by `matchAnswerTag` first, so this only ever sees multi-character /
// multi-word answers.
const ANSWER_TAG_TEXT_RE = /^\s*(?:Ans|Answer|Correct(?:\s*Answer)?)\s*[:.\-]\s*(.+\S)\s*$/i;

export function matchAnswerTagText(line: string): string | null {
  const m = ANSWER_TAG_TEXT_RE.exec(line);
  return m ? m[1].trim() : null;
}

// A True/False prompt: "True or False: <statement>", "True/False — <statement>",
// "T/F: <statement>". Anchored at the start so it only fires on a genuine lead-in
// (not a stem that merely mentions "true or false" mid-sentence). The captured
// group is the bare statement to be judged; a delimiter after the lead-in is
// optional because PDFs vary ("True or False The sky is blue").
const TRUE_FALSE_LEAD_RE =
  /^\s*(?:true\s*(?:or|\/)\s*false|t\s*\/\s*f)\s*[:.\-–—]?\s*(\S.*)$/i;

export function matchTrueFalseLead(stem: string): string | null {
  const m = TRUE_FALSE_LEAD_RE.exec(stem);
  return m ? m[1].trim() : null;
}

// Normalize any true/false answer token — "T", "true", "F", "False.", "(true)" —
// to a canonical "True" | "False", or null if it isn't a T/F verdict. Used to
// read a T/F answer out of the same signals an MCQ answer comes from (inline
// tag, answer key, free-text key), where the token may be a letter or a word.
export function normalizeTrueFalse(raw: string | null | undefined): "True" | "False" | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (s === "true" || s === "t") return "True";
  if (s === "false" || s === "f") return "False";
  return null;
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

// End-matter that trails the LAST question on an exam paper: a references /
// bibliography list, the content disclaimer, or acknowledgements. Anchored at
// BOTH ends so it only matches a standalone header line ("References:",
// "Disclaimer:") — never an in-question mention like "see the reference table".
// Used to stop question accumulation so a trailing citation dump doesn't bleed
// into the final question's stem or last option.
export function isEndMatter(line: string): boolean {
  return /^\s*(?:references?|bibliography|acknowledge?ments?|disclaimer|works\s+cited)\s*[:.]?\s*$/i.test(
    line,
  );
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

// The trailing `(?![A-Za-z])` keeps a single A–H letter from being grabbed out
// of a longer word, so a free-text answer key row like "3. Cellular respiration"
// is NOT misread as the letter key "3 → C". A genuine letter key ("3. C") is
// always followed by a space, digit, punctuation, or end-of-line.
const KEY_PAIR_RE = /(\d{1,3})\s*[.):]\s*\(?([A-Ha-h])\)?(?![A-Za-z])/g;

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

// A numbered free-text answer row in an answer key: "1. Mitochondria",
// "12) The nucleus controls the cell". Used to ingest short-answer keys, as
// opposed to the bare-letter "1. B" rows captured by `keyPairs`. One answer per
// line (free text can't be split unambiguously across a single line). The answer
// may be a SINGLE character ("1. T" for a True/False key, "1. 7" for a numeric
// short answer) — A–H single letters are claimed by `keyPairs`/`isKeyLine` first,
// so only non-letter-pair rows ever reach here.
const KEY_TEXT_RE = /^\s*(\d{1,3})\s*[.):]\s+(\S(?:.*\S)?)\s*$/;

export function matchKeyText(line: string): { number: number; text: string } | null {
  const m = KEY_TEXT_RE.exec(line);
  if (!m) return null;
  return { number: parseInt(m[1], 10), text: m[2].trim() };
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
  const leftover = line
    .replace(KEY_PAIR_RE, " ")
    .replace(BLANK_CELL_RE, " ") // tolerate "46. –" blank cells in a fixed grid
    .replace(/[\s,;|]+/g, "")
    .trim();
  return leftover.length === 0;
}

// A fixed-size answer grid (common in official mark schemes) reserves a cell for
// every possible question number and leaves the unused ones blank, rendered as
// "46. –" (number + a dash placeholder). Those blanks must NOT disqualify an
// otherwise-pure key row like "16. C 31. D 46. –" — without stripping them, the
// leftover "46.–" makes isKeyLine reject the row and its real pairs are lost.
// Covers hyphen, en/em dash, figure dash, and minus sign.
const BLANK_CELL_RE = /(\d{1,3})\s*[.):]\s*[–—‐\-−]+/g;

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

/**
 * An exam-style mark allocation lifted out of a line, plus the mark count
 * recovered as metadata. Exam papers annotate each question with its worth —
 * "(2 marks)", "[3]", "(Total: 25 marks)" — which is grading metadata, not part
 * of the question wording or an answer option. We strip it from the displayed
 * text and keep the number separately so the stem reads clean.
 */
export interface MarkAllocation {
  /** The input with any mark allocations removed (whitespace re-tidied). */
  text: string;
  /** Marks recovered: an explicit "Total" wins; else the per-part sum. Null if none. */
  marks: number | null;
}

// "(Total: 25 marks)" / "[Total 6]" / "(Total — 15)". A stated total is the
// authoritative figure, so when present it supersedes any per-part sum.
const TOTAL_MARKS_RE = /[([]\s*total\s*[:.\-–—]?\s*(\d{1,3})\s*(?:marks?)?\s*[)\]]/gi;
// "(2 marks)" / "[1 mark]" / "(10marks)" — a number explicitly qualified by the
// word "mark(s)". The `\s*` tolerates the missing space PDF extraction often drops.
const WORD_MARKS_RE = /[([]\s*(\d{1,3})\s*marks?\s*[)\]]/gi;
// A bare bracketed number in SQUARE brackets — the IB/Cambridge convention for a
// mark printed at the end of a question ("… explain why. [3]"). Restricted to
// square brackets and 1–2 digits, so ordinary parentheses and larger numbers
// (years, four-digit citations) are left untouched.
const BARE_MARKS_RE = /\[\s*(\d{1,2})\s*\]/g;

/**
 * Remove exam-style mark allocations from a line and report the marks as
 * metadata. A deliberately conservative, board-agnostic rule: it only fires on
 * the unambiguous conventions above (the word "mark(s)", a "Total" annotation,
 * or a short square-bracketed number), so it never eats ordinary parentheticals
 * or "(N points)" — the latter is reserved for the unsupported-free-response
 * check. When nothing matches the input is returned unchanged.
 */
export function parseMarkAllocation(input: string): MarkAllocation {
  let total: number | null = null;
  let sum = 0;
  let found = false;

  let text = input.replace(TOTAL_MARKS_RE, (_m, n: string) => {
    total = parseInt(n, 10);
    found = true;
    return " ";
  });
  text = text.replace(WORD_MARKS_RE, (_m, n: string) => {
    sum += parseInt(n, 10);
    found = true;
    return " ";
  });
  text = text.replace(BARE_MARKS_RE, (_m, n: string) => {
    sum += parseInt(n, 10);
    found = true;
    return " ";
  });

  if (!found) return { text: input, marks: null };
  return { text: text.replace(/\s+/g, " ").trim(), marks: total ?? (sum > 0 ? sum : null) };
}
