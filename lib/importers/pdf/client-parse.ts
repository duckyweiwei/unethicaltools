/**
 * CLIENT-SIDE full parse — extraction + deterministic parse entirely in the
 * browser, so a PDF that's too big to upload (Vercel caps a serverless request
 * body at ~4.5 MB) can still become a quiz. It mirrors the server's `parsePdf`
 * (index.ts) but swaps unpdf's loader for the browser-safe `unpdf/pdfjs` renderer
 * and SKIPS the server-only raster-figure extraction (images.ts / node:zlib).
 * Vector diagrams are still recovered: the parser emits `diagramRequests`, which
 * the uploader rasterizes in-browser exactly as it does for server parses.
 *
 * Everything here is browser-safe: the pure core (extract-core), the parser, and
 * attach.ts pull in NO node/unpdf runtime; pdf.js is loaded lazily so the ~1 MB
 * engine is code-split and only fetched when a big file actually needs it.
 */
import type { PdfParseResult } from "./index";
import { extractFromProxy } from "./extract-core";
import { parseExtracted, extractAnswerKeyPairs, parseMarkScheme } from "./parser/index";
import { computeDiagramRequests } from "./attach";

export { PdfTooLargeError } from "./extract-core";

let pdfjsPromise: Promise<typeof import("unpdf/pdfjs")> | null = null;
function loadPdfjs(): Promise<typeof import("unpdf/pdfjs")> {
  if (!pdfjsPromise) pdfjsPromise = import("unpdf/pdfjs");
  return pdfjsPromise;
}

/**
 * Parse PDF bytes to the same shape as the server's `parsePdf`, minus raster
 * figures (`images: []`). Throws `PdfTooLargeError` if the page count exceeds
 * `opts.maxPages`. The bytes are copied before handing to pdf.js (it can detach
 * the buffer), and the document is always destroyed.
 */
export async function parsePdfClient(
  bytes: Uint8Array,
  filename: string,
  opts?: { maxPages?: number },
): Promise<PdfParseResult> {
  const { getDocument } = await loadPdfjs();
  const pdf = await getDocument({
    data: Uint8Array.from(bytes),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  try {
    const doc = await extractFromProxy(pdf, { maxPages: opts?.maxPages });
    const quiz = parseExtracted(doc, { type: "pdf", filename });
    const answerKey = extractAnswerKeyPairs(doc);
    const markScheme = parseMarkScheme(doc);
    const diagramRequests = computeDiagramRequests(quiz, doc);
    return { quiz, answerKey, markScheme, pages: doc.pages, images: [], diagramRequests };
  } finally {
    try {
      await pdf.destroy();
    } catch {
      /* ignore */
    }
  }
}
