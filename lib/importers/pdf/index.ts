import type { Quiz } from "../../domain/types";
import type { Importer } from "../types";
import { extractPdf, PdfTooLargeError } from "./extract";
import { extractPdfFigures, type ExtractedImage } from "./images";
import { attachFigures, computeDiagramRequests, type DiagramRequest } from "./attach";
import { extractAnswerKeyPairs, parseExtracted, parseMarkScheme } from "./parser";
import type { MarkSchemeEntry } from "./parser";
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
  /**
   * Per-(number, part) reference answers found, so a mark-scheme PDF (uploaded
   * alongside its question paper) can be reconciled onto the right questions and
   * multi-part parts at merge time. Liberal — populated for any numbered-answer
   * doc; only applied when the user classifies a doc as a mark scheme.
   */
  markScheme: MarkSchemeEntry[];
  /** Page count, for the upload UI and the page-cap guard. */
  pages: number;
  /** Figures pulled from the PDF (best-effort), for the review tray to attach. */
  images: ExtractedImage[];
  /**
   * Rasterize requests for labeled-diagram MCQs (`Question.needsDiagram`): page +
   * region the CLIENT must render, because those figures are vector line-art the
   * server's raster extractor can't capture. Empty when the paper has none.
   */
  diagramRequests: DiagramRequest[];
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
  // Copy the bytes up front: pdf.js can detach the buffer it's handed during
  // text extraction, which would leave nothing for the image pass to read.
  const imageBytes = Uint8Array.from(source.data);
  const doc = await extractPdf(source.data, { maxPages: opts?.maxPages });
  const quiz = parseExtracted(doc, { type: "pdf", filename: source.filename });
  const answerKey = extractAnswerKeyPairs(doc);
  const markScheme = parseMarkScheme(doc);
  // Best-effort and isolated: a failure here must never sink a good text parse.
  // Extract figures (with page boxes), then match them to questions by caption
  // and position so the client can auto-attach the confident ones.
  const figures = await extractPdfFigures(imageBytes, doc.pages).catch(() => []);
  const images = figures.length ? attachFigures(figures, quiz, doc) : [];
  // Independent of the raster pass: diagram MCQs reference VECTOR figures the
  // extractor never finds, so their regions are computed straight from text
  // geometry for the client to rasterize.
  const diagramRequests = computeDiagramRequests(quiz, doc);
  return { quiz, answerKey, markScheme, pages: doc.pages, images, diagramRequests };
}

export { PdfTooLargeError };
export type { DiagramRequest } from "./attach";

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
