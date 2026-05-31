import { getDocumentProxy } from "unpdf";

/**
 * Stage 2 — text extraction.
 *
 * Turns PDF bytes into a normalized, layout-aware line model using pdf.js
 * (via unpdf, which ships a serverless-friendly build). We keep per-word x/y
 * coordinates so the parser can disambiguate multi-column and inline layouts.
 *
 * Coordinates are normalized to be TOP-BASED (y increases downward), which is
 * how the parser reasons about reading order.
 */

export interface Word {
  text: string;
  x: number; // left edge
  y: number; // top-based y
  width: number;
  height: number;
  fontName: string;
}

export interface Line {
  page: number;
  column: number; // 0 or 1 (two-column support)
  x: number; // min word x
  y: number; // line top-y
  text: string;
  words: Word[];
}

export interface ExtractedDoc {
  pages: number;
  lines: Line[]; // reading order
  text: string; // full text fallback
}

interface RawItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
}

// Insert a space between two words when the horizontal gap exceeds this
// fraction of the glyph height (handles char-level vs word-level item streams).
const SPACE_RATIO = 0.25;

/** Thrown when a PDF exceeds the page cap — surfaced to the user as guidance to
 *  split the file, rather than silently risking the serverless time budget. */
export class PdfTooLargeError extends Error {
  constructor(
    readonly pages: number,
    readonly maxPages: number,
  ) {
    super(`PDF has ${pages} pages; limit is ${maxPages}.`);
    this.name = "PdfTooLargeError";
  }
}

export async function extractPdf(
  data: Uint8Array,
  opts?: { maxPages?: number },
): Promise<ExtractedDoc> {
  const pdf = await getDocumentProxy(data);
  // Guard the time budget up front: numPages is known after load but before the
  // costly per-page text extraction, so reject an oversized doc cheaply.
  if (opts?.maxPages != null && pdf.numPages > opts.maxPages) {
    throw new PdfTooLargeError(pdf.numPages, opts.maxPages);
  }
  const lines: Line[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const pageWidth = viewport.width;
    const content = await page.getTextContent();

    const items: RawItem[] = [];
    for (const it of content.items as Array<Record<string, unknown>>) {
      const str = (it.str as string) ?? "";
      if (!str || !str.trim()) continue;
      const tr = it.transform as number[];
      if (!tr) continue;
      items.push({
        str,
        x: tr[4],
        y: pageHeight - tr[5], // flip to top-based
        width: (it.width as number) ?? 0,
        height: (it.height as number) || Math.abs(tr[3]) || 10,
        fontName: (it.fontName as string) ?? "",
      });
    }
    if (!items.length) continue;

    const gutterX = detectColumnGutter(items, pageWidth);
    lines.push(...buildLines(items, gutterX, p));
  }

  return { pages: pdf.numPages, lines, text: lines.map((l) => l.text).join("\n") };
}

/**
 * Detect a single vertical gutter splitting the page into two columns.
 * Returns the gutter x (page units) or null for single-column pages.
 * v1 handles up to two columns — enough for two-column worksheets.
 */
function detectColumnGutter(items: RawItem[], pageWidth: number): number | null {
  const BINS = 60;
  const covered = new Array<number>(BINS).fill(0);
  for (const it of items) {
    const start = Math.max(0, Math.floor((it.x / pageWidth) * BINS));
    const end = Math.min(BINS - 1, Math.floor(((it.x + it.width) / pageWidth) * BINS));
    for (let b = start; b <= end; b++) covered[b]++;
  }

  const first = covered.findIndex((c) => c > 0);
  if (first < 0) return null;
  let last = BINS - 1;
  while (last > first && covered[last] === 0) last--;

  // Find the widest internal empty run (the gutter candidate).
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let b = first; b <= last; b++) {
    if (covered[b] === 0) {
      if (runStart < 0) runStart = b;
    } else if (runStart >= 0) {
      const len = b - runStart;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }

  if (bestLen < Math.max(3, Math.floor(BINS * 0.05))) return null;
  const gutterX = ((bestStart + bestLen / 2) / BINS) * pageWidth;
  const left = items.filter((it) => it.x + it.width / 2 < gutterX).length;
  const right = items.length - left;
  // Both sides must carry real content to be a true two-column layout.
  if (left >= items.length * 0.2 && right >= items.length * 0.2) return gutterX;
  return null;
}

function buildLines(items: RawItem[], gutterX: number | null, page: number): Line[] {
  const groups: RawItem[][] =
    gutterX == null
      ? [items]
      : [
          items.filter((it) => it.x + it.width / 2 < gutterX),
          items.filter((it) => it.x + it.width / 2 >= gutterX),
        ];

  const out: Line[] = [];
  // Reading order: column 0 top->bottom, then column 1 top->bottom.
  groups.forEach((group, col) => {
    const sorted = [...group].sort((a, b) => a.y - b.y || a.x - b.x);
    let current: RawItem[] = [];
    let refY: number | null = null;

    const flush = () => {
      if (current.length) out.push(makeLine([...current].sort((a, b) => a.x - b.x), page, col));
      current = [];
    };

    for (const it of sorted) {
      const tol = Math.max(2, it.height * 0.6);
      if (refY == null || Math.abs(it.y - refY) <= tol) {
        current.push(it);
        refY = refY == null ? it.y : (refY + it.y) / 2;
      } else {
        flush();
        current = [it];
        refY = it.y;
      }
    }
    flush();
  });

  return out;
}

function makeLine(ws: RawItem[], page: number, col: number): Line {
  let text = "";
  let prev: RawItem | null = null;
  for (const w of ws) {
    if (prev) {
      const gap = w.x - (prev.x + prev.width);
      if (gap > Math.min(prev.height, w.height) * SPACE_RATIO) text += " ";
    }
    text += w.str;
    prev = w;
  }
  text = text.replace(/\s+/g, " ").trim();

  return {
    page,
    column: col,
    x: Math.min(...ws.map((w) => w.x)),
    y: Math.min(...ws.map((w) => w.y)),
    text,
    words: ws.map((w) => ({
      text: w.str,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      fontName: w.fontName,
    })),
  };
}
