/**
 * Stage 4b — mark-scheme extraction.
 *
 * A mark scheme is a SECOND document, uploaded alongside the question paper, that
 * lists the accepted answers. Unlike a bare answer key ("1. B  2. A"), a scheme
 * is keyed by question number AND part — "1 (a) nucleus", "1 (b) (i) controls
 * cell activities [2]" — and the answers are free text, often terse. We read it
 * into a flat list of { number, part, answer } entries so the merge step can
 * reconcile each onto the right question (or multi-part part) by number + part.
 *
 * Deterministic and conservative: we only emit an entry when a line clearly
 * starts with a question number; everything kept is the source's own wording
 * (mark allocations stripped), never paraphrased. Ambiguous matches are left for
 * the merge step to flag rather than guessed at here.
 */
import type { ExtractedDoc } from "../extract";
import { parseMarkAllocation } from "./patterns";

export interface MarkSchemeEntry {
  number: number;
  /**
   * Part path within the question: "a", "b", or a nested "b.i". Null when the
   * scheme gives a single whole-question answer (no lettered parts).
   */
  part: string | null;
  /** Reference answer, verbatim from the scheme with mark allocations removed.
   *  May be a bare option letter ("B") for a multiple-choice scheme. */
  answer: string;
}

const ROMAN = "viii|vii|iii|ii|ix|iv|vi|xi|x|v|i";

// A scheme row: a leading question number, an OPTIONAL parenthesised part "(a)"
// and OPTIONAL parenthesised roman "(i)", an optional separator, then the answer.
// Parts must be parenthesised on purpose: a bare "1 a nucleus" is ambiguous
// (is the answer "a nucleus"?), so we only split a part we can see in brackets.
const SCHEME_LINE_RE = new RegExp(
  `^\\s*(\\d{1,3})\\s*[.)]?\\s*` +
    `(?:\\(([a-h])\\))?\\s*` +
    `(?:\\((${ROMAN})\\))?\\s*` +
    `[:.)\\-\\u2013\\u2014]?\\s*` +
    `(\\S(?:.*\\S)?)\\s*$`,
  "i",
);

/** Build the part path from an optional letter and optional roman ("b" + "i" → "b.i"). */
function partPath(letter: string | undefined, roman: string | undefined): string | null {
  if (!letter && !roman) return null;
  return [letter, roman].filter(Boolean).join(".").toLowerCase();
}

/**
 * Parse a mark-scheme document into per-(number, part) answer entries. One entry
 * per recognised line; the first occurrence of a given number+part wins (schemes
 * sometimes restate a row). Lines that don't start with a number, or whose
 * answer is empty once marks are stripped, are ignored.
 */
export function parseMarkScheme(doc: ExtractedDoc): MarkSchemeEntry[] {
  const seen = new Set<string>();
  const out: MarkSchemeEntry[] = [];
  for (const line of doc.lines) {
    const text = line.text;
    if (!text.trim()) continue;
    const m = SCHEME_LINE_RE.exec(text);
    if (!m) continue;
    const number = parseInt(m[1], 10);
    const part = partPath(m[2], m[3]);
    const answer = parseMarkAllocation(m[4]).text.trim();
    if (!answer || !/[A-Za-z0-9]/.test(answer)) continue;
    const key = `${number}|${part ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ number, part, answer });
  }
  return out;
}
