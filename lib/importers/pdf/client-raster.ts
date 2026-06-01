/**
 * CLIENT-SIDE diagram rasterization.
 *
 * Labeled-diagram MCQs ("which letter marks the axon?") point at VECTOR line-art
 * the server's raster extractor can never see, so the parser emits regions to
 * render instead (`DiagramRequest`: page + box, in PDF user units, y from the
 * top). This module turns each region into a PNG dataURL in the browser with
 * pdf.js, so the figure can be stored and shown like any other question image.
 *
 * pdf.js (v5) is the renderer bundled inside `unpdf` (already a dependency). It
 * is loaded lazily via dynamic import so the ~1 MB engine is code-split into its
 * own chunk — only a user who actually imports a diagram PDF ever downloads it,
 * and it never lands in the main client bundle. The `unpdf/pdfjs` subpath is the
 * pure renderer: it pulls in NO node:zlib / unpdf parser code (verified: the
 * bundle has zero `node:` imports), so it's safe in the browser.
 *
 * `import type` only from the parser libs — those runtime modules reach for
 * node built-ins and must never be bundled client-side; type imports are erased.
 */
import type { DiagramRequest } from "@/lib/importers/pdf/attach";

export interface RasterResult {
  /** PNG data URL of the cropped figure region. */
  dataUrl: string;
  /** Pixel dimensions of the crop (already scaled), for the image reference. */
  width: number;
  height: number;
}

// Oversample so vector line-art stays crisp on retina displays. A line diagram
// PNG compresses well, so 2× costs little; the region height is already capped
// upstream (MAX_DIAGRAM_H) so a crop can't blow past a few megapixels.
const RASTER_SCALE = 2;

let pdfjsPromise: Promise<typeof import("unpdf/pdfjs")> | null = null;
function loadPdfjs(): Promise<typeof import("unpdf/pdfjs")> {
  if (!pdfjsPromise) pdfjsPromise = import("unpdf/pdfjs");
  return pdfjsPromise;
}

/**
 * Render each server-hinted diagram region from the ORIGINAL PDF bytes, returning
 * a map keyed by the request's `questionId`.
 *
 * Best-effort and non-throwing: pdf.js failing to load, a page that won't render,
 * or a degenerate box are all swallowed — that question simply keeps its
 * `needsDiagram` hint and the rest still attach. Pages are rendered once even
 * when several diagrams share one page.
 */
export async function rasterizeDiagramRequests(
  bytes: Uint8Array,
  requests: DiagramRequest[],
): Promise<Map<string, RasterResult>> {
  const out = new Map<string, RasterResult>();
  if (!requests.length || typeof document === "undefined") return out;

  let pdf: import("unpdf/pdfjs").PDFDocumentProxy | null = null;
  try {
    const { getDocument } = await loadPdfjs();
    // Copy the bytes: pdf.js can detach the ArrayBuffer it's handed.
    pdf = await getDocument({
      data: Uint8Array.from(bytes),
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    // Group requests by page so a page with several diagrams renders only once.
    const byPage = new Map<number, DiagramRequest[]>();
    for (const r of requests) {
      const list = byPage.get(r.page);
      if (list) list.push(r);
      else byPage.set(r.page, [r]);
    }

    for (const [pageNum, reqs] of byPage) {
      let page: import("unpdf/pdfjs").PDFPageProxy | null = null;
      try {
        page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: RASTER_SCALE });
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = Math.ceil(viewport.width);
        pageCanvas.height = Math.ceil(viewport.height);
        // PDFs paint on transparency; the white `background` keeps a line diagram
        // visible on dark UIs and from printing as a blank rectangle. pdf.js (v5)
        // takes the canvas directly and manages its own 2D context.
        await page.render({ canvas: pageCanvas, viewport, background: "#ffffff" }).promise;

        for (const r of reqs) {
          // Box is in PDF user units, top-based — the SAME basis as the pdf.js
          // viewport at scale 1, so scaling by RASTER_SCALE maps it to canvas px.
          const sx = Math.max(0, Math.floor(r.box.x * RASTER_SCALE));
          const sy = Math.max(0, Math.floor(r.box.top * RASTER_SCALE));
          const sw = Math.min(pageCanvas.width - sx, Math.ceil(r.box.w * RASTER_SCALE));
          const sh = Math.min(pageCanvas.height - sy, Math.ceil(r.box.h * RASTER_SCALE));
          if (sw <= 1 || sh <= 1) continue;
          const crop = document.createElement("canvas");
          crop.width = sw;
          crop.height = sh;
          const cropCtx = crop.getContext("2d");
          if (!cropCtx) continue;
          cropCtx.drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
          out.set(r.questionId, { dataUrl: crop.toDataURL("image/png"), width: sw, height: sh });
        }
      } catch {
        // Skip this page's diagrams; the questions keep their needsDiagram hint.
      } finally {
        try {
          page?.cleanup();
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    // pdf.js failed to load or parse — return whatever attached (likely nothing).
  } finally {
    try {
      await pdf?.destroy();
    } catch {
      /* ignore */
    }
  }
  return out;
}
