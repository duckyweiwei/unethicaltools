/**
 * Fill-in-the-blank ("cloze") helpers, source-agnostic.
 *
 * A cloze question is an ordinary stem with a BLANK to be filled, e.g.
 * "The powerhouse of the cell is the __________." paired with a reference
 * answer ("mitochondria"). Detection (`hasBlank`) lets the importer tag such a
 * question `cloze` instead of generic short-answer; rendering (`fillBlank`)
 * lets the player reveal the answer IN the blank, so the completed sentence
 * reads naturally instead of showing a detached "Answer: …" box.
 *
 * Kept out of the PDF parser on purpose: blanks are a property of the quiz
 * model, not of PDFs, so the source-agnostic player can import this without
 * reaching into importer internals.
 */

// A fill-in gap: a run of underscores ("__________") or an explicit bracketed
// blank ("[blank]", "[ ]", "[___]"). Conservative — three+ underscores so a
// stray "__" in ordinary text isn't misread as a blank.
const BLANK_RE = /_{3,}|\[\s*(?:blanks?|_+)?\s*\]/i;

/** True when a stem carries a fill-in-the-blank gap. */
export function hasBlank(text: string): boolean {
  return BLANK_RE.test(text);
}

/** The pieces of a cloze stem with its FIRST blank replaced by the answer, so a
 *  caller can emphasize the filled-in part: `before` + **answer** + `after`. */
export interface FilledBlank {
  before: string;
  answer: string;
  after: string;
}

/**
 * Split a cloze stem around its FIRST blank, substituting `answer`. Only the
 * first gap is filled (v1 cloze carries a single reference answer; a stem with
 * several blanks keeps the rest intact rather than repeating one answer into
 * all of them). Returns null when there's no blank to fill, so the caller can
 * fall back to showing the answer on its own.
 */
export function fillBlank(stem: string, answer: string): FilledBlank | null {
  const m = BLANK_RE.exec(stem);
  if (!m) return null;
  return {
    before: stem.slice(0, m.index),
    answer,
    after: stem.slice(m.index + m[0].length),
  };
}
