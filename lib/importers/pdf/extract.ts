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
  // Per-page height, so the header/footer pass can reason about margins as a
  // FRACTION of page height (robust to pages of differing size).
  const pageHeights = new Map<number, number>();

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const pageWidth = viewport.width;
    pageHeights.set(p, pageHeight);
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

  const kept = stripRunningHeadersFooters(lines, pageHeights);
  return { pages: pdf.numPages, lines: kept, text: kept.map((l) => l.text).join("\n") };
}

/**
 * Drop running page headers/footers (the paper code, page numbers, "Turn over")
 * before the parser can glue them into stems/options. Pure rule-based — nothing
 * is rewritten by a model.
 *
 * A physical margin ROW is a header/footer iff ALL hold:
 *   1. it sits in the top or bottom MARGIN band of its page;
 *   2. its NORMALIZED text (case-, whitespace-, dash- and digit-folded, so a
 *      page number like "– 12 –" or a code "8825 – 6007" matches across pages)
 *      recurs on >= MIN_PAGES distinct pages; and
 *   3. those occurrences sit at nearly the same FRACTIONAL y (one consistent
 *      band — not a coincidental string seen at the top on one page and the
 *      bottom on another).
 *
 * Column-split headers are handled first: when column detection slices a
 * full-width header into per-column pieces (e.g. "– 12 –" | "8825–6007" beside a
 * figure), we rejoin same-page lines sharing a y into one row BEFORE matching, so
 * the rejoined "– 12 – 8825–6007" still matches the header seen whole elsewhere.
 *
 * Deliberately conservative: genuine question content is unique per question, so
 * it can never satisfy (2)+(3). When in doubt the row is kept.
 */
function stripRunningHeadersFooters(lines: Line[], pageHeights: Map<number, number>): Line[] {
  // Top/bottom band as a fraction of page height. The IB header sits at ~6% and
  // the first question line at ~9%, so 12% comfortably covers headers without
  // relying on the band alone to spare content (recurrence does that).
  const MARGIN_FRAC = 0.12;
  // Same row must repeat on at least this many distinct pages to count.
  const MIN_PAGES = 3;
  // Cross-page: occurrences must cluster within this fraction of page height to
  // be "the same band" — keeps a top-margin string from grouping with a
  // bottom-margin one.
  const Y_TOL_FRAC = 0.04;
  // Same-page: lines within this fraction of each other are one physical row
  // (column-split pieces of a header). Tight, so a header (~6%) never merges
  // with the first question line (~9%).
  const ROW_TOL_FRAC = 0.012;

  // 1. Keep only margin-band lines, tagged with their fractional y.
  type MLine = { line: Line; yFrac: number };
  const byPage = new Map<number, MLine[]>();
  for (const line of lines) {
    const ph = pageHeights.get(line.page);
    if (!ph) continue;
    const yFrac = line.y / ph;
    if (yFrac >= MARGIN_FRAC && yFrac <= 1 - MARGIN_FRAC) continue; // mid-page, not a margin
    let a = byPage.get(line.page);
    if (!a) byPage.set(line.page, (a = []));
    a.push({ line, yFrac });
  }

  // 2. Merge same-page margin lines that share a y into one physical row (rejoins
  //    column-split header pieces). Text is concatenated left-to-right.
  type Row = { page: number; yFrac: number; members: Line[]; text: string };
  const rows: Row[] = [];
  for (const [page, ms] of byPage) {
    ms.sort((a, b) => a.yFrac - b.yFrac);
    let cur: MLine[] = [];
    const flush = () => {
      if (!cur.length) return;
      const ordered = [...cur].sort((a, b) => a.line.x - b.line.x);
      rows.push({
        page,
        yFrac: cur[0].yFrac, // smallest, since cur is built in ascending y
        members: ordered.map((c) => c.line),
        text: ordered.map((c) => c.line.text).join(" "),
      });
      cur = [];
    };
    for (const m of ms) {
      if (cur.length && m.yFrac - cur[0].yFrac > ROW_TOL_FRAC) flush();
      cur.push(m);
    }
    flush();
  }

  // 3. Group rows across pages by their folded key.
  const groups = new Map<string, { rows: Row[]; pages: Set<number> }>();
  for (const r of rows) {
    const key = headerKey(r.text);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { rows: [], pages: new Set() }));
    g.rows.push(r);
    g.pages.add(r.page);
  }

  // 4. Drop every member line of any qualifying group.
  const drop = new Set<Line>();
  for (const g of groups.values()) {
    if (g.pages.size < MIN_PAGES) continue;
    const ys = g.rows.map((r) => r.yFrac);
    if (Math.max(...ys) - Math.min(...ys) > Y_TOL_FRAC) continue; // not one consistent band
    for (const r of g.rows) for (const m of r.members) drop.add(m);
  }

  return drop.size ? lines.filter((l) => !drop.has(l)) : lines;
}

/**
 * Fold a line to a recurrence key: lower-case, unify dash variants, mask every
 * run of digits to "#", and DROP all whitespace. Whitespace-insensitivity lets a
 * header survive both inter-token spacing variance ("8825–6007" vs "8825 – 6007")
 * and column-split rejoining, while digit masking lets page-varying numbers
 * ("– 12 –" vs "– 13 –") share one key. Only digits are masked, so distinct word
 * content never collides.
 */
function headerKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‐-―−]/g, "-") // hyphen/en/em/minus dashes → "-"
    .replace(/\d+/g, "#")
    .replace(/\s+/g, "");
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
