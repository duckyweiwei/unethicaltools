import type { Quiz } from "../../domain/types";
import type { Importer } from "../types";
import { extractPdf, PdfTooLargeError } from "./extract";
import { extractAnswerKeyPairs, parseExtracted } from "./parser";
import type { KeyPair } from "./parser/patterns";

export interface PdfSource {
  data: Uint8Array;
  filename: string;
}

export interface PdfParseResult {
  /** The parsed quiz. May have zero questions for a standalone answer-key PDF. */
  quiz: Quiz;
  /** Any number→letter pairs found, so a key-only PDF can be merged later. */
  answerKey: KeyPair[];
  /** Page count, for the upload UI and the page-cap guard. */
  pages: number;
}

/**
 * Full ingestion: extract → deterministic parse → answer-key sweep. Returns the
 * quiz plus the raw key pairs and page count so a caller (the upload API) can
 * tell a questions PDF from a standalone answer-key PDF and enforce limits.
 * `opts.maxPages` rejects oversized files before the costly extraction loop.
 */
export async function parsePdf(
  source: PdfSource,
  opts?: { maxPages?: number },
): Promise<PdfParseResult> {
  const doc = await extractPdf(source.data, { maxPages: opts?.maxPages });
  const quiz = parseExtracted(doc, { type: "pdf", filename: source.filename });
  const answerKey = extractAnswerKeyPairs(doc);
  return { quiz, answerKey, pages: doc.pages };
}

export { PdfTooLargeError };

/**
 * The PDF importer: ingestion -> extraction -> deterministic parse.
 * Implements the shared `Importer` interface, so swapping it (or its engine)
 * later doesn't ripple into the rest of the app.
 */
export const pdfImporter: Importer<PdfSource> = {
  id: "pdf",
  async parse(source: PdfSource): Promise<Quiz> {
    return (await parsePdf(source)).quiz;
  },
};
