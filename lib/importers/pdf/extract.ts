/**
 * Stage 2 — text extraction, SERVER entry.
 *
 * Loads PDF bytes with unpdf (a serverless-friendly pdf.js build) and hands the
 * document to the shared, engine-agnostic core (extract-core.ts) for the actual
 * line-model construction. The browser path uses the same core with the bundled
 * `unpdf/pdfjs` renderer (see client-parse.ts), so big files can be parsed
 * locally without a server upload — keeping the line model byte-identical across
 * both environments.
 *
 * unpdf reaches for node built-ins, so this module must only ever run on the
 * server; the pure core is what the client imports.
 */
import { getDocumentProxy } from "unpdf";
import { extractFromProxy } from "./extract-core";
import type { ExtractedDoc } from "./extract-core";

export type { Word, Line, ExtractedDoc } from "./extract-core";
export { PdfTooLargeError } from "./extract-core";

export async function extractPdf(
  data: Uint8Array,
  opts?: { maxPages?: number },
): Promise<ExtractedDoc> {
  const pdf = await getDocumentProxy(data);
  return extractFromProxy(pdf, opts);
}
