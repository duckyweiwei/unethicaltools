/**
 * Stage 2b — figure extraction (best-effort), now POSITION-AWARE.
 *
 * `unpdf`'s `extractImages` hands back each page's raster images as decoded
 * pixels but throws away WHERE they sit on the page. That single gap caused both
 * of the rough edges users hit: a figure stored as several image objects (a
 * scanned table sliced into horizontal strips is the common case) surfaced as
 * many disconnected pieces, and with no coordinates we couldn't say which
 * question a figure belonged to — so every image had to be attached by hand.
 *
 * We fix both at the source by replicating unpdf's `paintImageXObject` walk while
 * tracking the graphics-state CTM (the transform stack the original loop
 * ignores). That recovers each image's page rectangle, which lets us (1) cluster
 * abutting/overlapping pieces and composite them back into ONE figure, and (2)
 * hand the boxes to the attach pass so figures can be matched to questions by
 * caption and position. The text parser already keeps top-based y coordinates,
 * so the two coordinate spaces line up.
 *
 * Runs only in the Node parse route. Pixels are composited and re-encoded to PNG
 * via the dependency-free encoder (no sharp/canvas) and returned as data URLs.
 */
import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { rawToPng } from "./png";

/** A figure ready for the client: PNG bytes + its page rectangle (top-based,
 *  matching `extract.ts`) so the attach pass can reason about position. */
export interface Figure {
  /** PNG data URL, ready to drop into <img> / IndexedDB. */
  dataUrl: string;
  /** 1-based source page. */
  page: number;
  width: number;
  height: number;
  /** Page rectangle in PDF user units, y measured from the TOP. */
  box: Box;
}

/** The wire shape returned to the client: a figure plus the ids of the questions
 *  the attach pass matched it to. Empty → the figure goes to the manual review
 *  tray. May list several (one figure can be referenced by multiple questions,
 *  e.g. "Refer to Figure 1" across Q13–Q16), in which case each gets its own copy
 *  of the bytes client-side. Ids are ORIGINAL (pre-merge) question ids. */
export interface ExtractedImage {
  dataUrl: string;
  page: number;
  width: number;
  height: number;
  attachToIds: string[];
}

interface Box {
  x: number;
  top: number;
  w: number;
  h: number;
}

/** A single painted image: decoded pixels + intrinsic size + page rectangle. */
interface RawImage {
  data: Uint8Array | Uint8ClampedArray;
  pw: number; // intrinsic pixel width
  ph: number; // intrinsic pixel height
  channels: 1 | 3 | 4;
  box: Box;
}

// Decorative-image guards, applied to the FINAL figure (post-cluster). Tuned to
// keep real diagrams/tables while dropping icons, bullets, and hairline rules.
const MIN_SIDE = 40; // px — smallest edge of the composited figure
const MIN_AREA = 48 * 48; // px²
const MAX_PER_PAGE = 6;
const MAX_TOTAL = 30;
const MAX_SCAN_PAGES = 30; // bound the time budget on long files
// Cap a composited canvas so a pathological cluster can't allocate gigabytes.
const MAX_CANVAS_PX = 4_000_000;

// pdf.js affine helpers (row-vector PDF convention). `mul(ctm, cm)` matches how a
// canvas accumulates `ctx.transform`, so the running CTM is mul(CTM, cmArgs).
function mul(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}
function applyPt(m: number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Compute a painted image's page rectangle from the CTM that maps its unit
 *  square to user space. Robust to flips/rotation via the corner bounding box;
 *  y is flipped to top-based to match the text pipeline. */
function ctmToBox(ctm: number[], pageHeight: number): Box {
  const corners: Array<[number, number]> = [
    applyPt(ctm, 0, 0),
    applyPt(ctm, 1, 0),
    applyPt(ctm, 1, 1),
    applyPt(ctm, 0, 1),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, top: pageHeight - maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Pull every painted image off one page WITH its page rectangle, by walking the
 * operator list and tracking the CTM stack (save / restore / transform). Mirrors
 * unpdf's pixel fetch (`page.objs` / `page.commonObjs`), adding the position the
 * original loop discards. Best-effort: anything that fails to resolve is skipped.
 */
async function rawImagesForPage(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  pageNumber: number,
  OPS: Record<string, number>,
): Promise<RawImage[]> {
  const page = await pdf.getPage(pageNumber);
  const pageHeight = page.getViewport({ scale: 1 }).height;
  const opList = await page.getOperatorList();

  const out: RawImage[] = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === OPS.save) {
      stack.push(ctm.slice());
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      ctm = mul(ctm, args as number[]);
    } else if (fn === OPS.paintImageXObject) {
      const key = args[0] as string;
      const img = await new Promise<{ data?: Uint8ClampedArray; width?: number; height?: number } | null>(
        (resolve) =>
          (typeof key === "string" && key.startsWith("g_") ? page.commonObjs : page.objs).get(
            key,
            resolve as (v: unknown) => void,
          ),
      ).catch(() => null);
      pushRaw(out, img, ctm, pageHeight);
    } else if (fn === OPS.paintInlineImageXObject) {
      // Inline images carry their pixels directly in the op args.
      pushRaw(out, args[0] as { data?: Uint8ClampedArray; width?: number; height?: number }, ctm, pageHeight);
    }
  }
  return out;
}

/** Validate a fetched image's pixel buffer and record it with its box. */
function pushRaw(
  out: RawImage[],
  img: { data?: Uint8ClampedArray; width?: number; height?: number } | null,
  ctm: number[],
  pageHeight: number,
): void {
  if (!img || !img.data || !img.width || !img.height) return;
  const channels = img.data.length / (img.width * img.height);
  if (channels !== 1 && channels !== 3 && channels !== 4) return;
  out.push({
    data: img.data,
    pw: img.width,
    ph: img.height,
    channels,
    box: ctmToBox(ctm, pageHeight),
  });
}

/** Read one channel-normalized RGBA pixel from a raw image at (sx, sy). */
function sampleRGBA(img: RawImage, sx: number, sy: number, o: [number, number, number, number]): void {
  const i = (sy * img.pw + sx) * img.channels;
  const d = img.data;
  if (img.channels === 1) {
    o[0] = o[1] = o[2] = d[i];
    o[3] = 255;
  } else if (img.channels === 3) {
    o[0] = d[i];
    o[1] = d[i + 1];
    o[2] = d[i + 2];
    o[3] = 255;
  } else {
    o[0] = d[i];
    o[1] = d[i + 1];
    o[2] = d[i + 2];
    o[3] = d[i + 3];
  }
}

/**
 * Composite a cluster of pieces into one RGBA buffer, each blitted (nearest-
 * neighbour) into its slot in the union rectangle. The single-piece case skips
 * the canvas entirely and encodes the pixels as-is. Returns null if the figure
 * is too small to be a real diagram or too large to safely allocate.
 */
function compositeCluster(pieces: RawImage[]): { png: Buffer; box: Box } | null {
  // Union rectangle in page units.
  const X0 = Math.min(...pieces.map((p) => p.box.x));
  const Y0 = Math.min(...pieces.map((p) => p.box.top));
  const X1 = Math.max(...pieces.map((p) => p.box.x + p.box.w));
  const Y1 = Math.max(...pieces.map((p) => p.box.top + p.box.h));
  const unionBox: Box = { x: X0, top: Y0, w: X1 - X0, h: Y1 - Y0 };

  if (pieces.length === 1) {
    const p = pieces[0];
    if (p.pw < MIN_SIDE || p.ph < MIN_SIDE || p.pw * p.ph < MIN_AREA) return null;
    try {
      return { png: rawToPng(p.data, p.pw, p.ph, p.channels), box: unionBox };
    } catch {
      return null;
    }
  }

  // Pixels-per-point: pick the sharpest piece so we never upscale the source.
  let scale = 1;
  for (const p of pieces) {
    if (p.box.w > 0) scale = Math.max(scale, p.pw / p.box.w);
    if (p.box.h > 0) scale = Math.max(scale, p.ph / p.box.h);
  }
  let Cw = Math.max(1, Math.round(unionBox.w * scale));
  let Ch = Math.max(1, Math.round(unionBox.h * scale));
  if (Cw * Ch > MAX_CANVAS_PX) {
    const k = Math.sqrt(MAX_CANVAS_PX / (Cw * Ch));
    Cw = Math.max(1, Math.floor(Cw * k));
    Ch = Math.max(1, Math.floor(Ch * k));
    scale *= k;
  }
  if (Cw < MIN_SIDE || Ch < MIN_SIDE || Cw * Ch < MIN_AREA) return null;

  // White, opaque background so any seams between strips read clean on the UI.
  const canvas = new Uint8ClampedArray(Cw * Ch * 4).fill(255);
  const px: [number, number, number, number] = [0, 0, 0, 0];

  for (const p of pieces) {
    const dx0 = Math.round((p.box.x - X0) * scale);
    const dy0 = Math.round((p.box.top - Y0) * scale);
    const dw = Math.max(1, Math.round(p.box.w * scale));
    const dh = Math.max(1, Math.round(p.box.h * scale));
    for (let dy = 0; dy < dh; dy++) {
      const cy = dy0 + dy;
      if (cy < 0 || cy >= Ch) continue;
      const sy = Math.min(p.ph - 1, Math.floor((dy / dh) * p.ph));
      for (let dx = 0; dx < dw; dx++) {
        const cx = dx0 + dx;
        if (cx < 0 || cx >= Cw) continue;
        const sx = Math.min(p.pw - 1, Math.floor((dx / dw) * p.pw));
        sampleRGBA(p, sx, sy, px);
        const ci = (cy * Cw + cx) * 4;
        canvas[ci] = px[0];
        canvas[ci + 1] = px[1];
        canvas[ci + 2] = px[2];
        canvas[ci + 3] = px[3];
      }
    }
  }

  try {
    return { png: rawToPng(canvas, Cw, Ch, 4), box: unionBox };
  } catch {
    return null;
  }
}

/** Two boxes belong to the same figure when they touch or overlap — horizontal
 *  ranges meet (the strip case: identical x/width) and the vertical gap is tiny. */
function connected(a: Box, b: Box): boolean {
  const hGap = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  const vGap = Math.max(a.top, b.top) - Math.min(a.top + a.h, b.top + b.h);
  const hTol = Math.max(8, Math.min(a.w, b.w) * 0.15);
  const vTol = Math.max(10, Math.min(a.h, b.h) * 0.6);
  return hGap <= hTol && vGap <= vTol;
}

/** Union-find clustering of a page's pieces into figures. */
function clusterPieces(pieces: RawImage[]): RawImage[][] {
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      if (connected(pieces[i].box, pieces[j].box)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, RawImage[]>();
  pieces.forEach((p, i) => {
    const r = find(i);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(p);
  });
  return [...groups.values()];
}

/**
 * Extract every figure from the first MAX_SCAN_PAGES pages, merging fragmented
 * pieces back into whole figures. Best-effort throughout: a page or image that
 * fails to decode is skipped, never fatal — figure extraction must never break a
 * successful text parse. Pass a COPY of the PDF bytes; pdf.js may detach them.
 */
export async function extractPdfFigures(data: Uint8Array, pages: number): Promise<Figure[]> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  let OPS: Record<string, number>;
  try {
    pdf = await getDocumentProxy(data);
    ({ OPS } = (await getResolvedPDFJS()) as { OPS: Record<string, number> });
  } catch {
    return [];
  }

  const out: Figure[] = [];
  const seen = new Set<string>(); // dedupe a logo repeated across pages
  const lastPage = Math.min(pages, MAX_SCAN_PAGES);

  for (let p = 1; p <= lastPage && out.length < MAX_TOTAL; p++) {
    let pieces: RawImage[];
    try {
      pieces = await rawImagesForPage(pdf, p, OPS);
    } catch {
      continue; // unreadable page — move on
    }
    if (!pieces.length) continue;

    let perPage = 0;
    for (const cluster of clusterPieces(pieces)) {
      if (perPage >= MAX_PER_PAGE || out.length >= MAX_TOTAL) break;
      const composited = compositeCluster(cluster);
      if (!composited) continue;
      const { png, box } = composited;
      const sig = `${Math.round(box.w)}x${Math.round(box.h)}:${png.length}`;
      if (seen.has(sig)) continue; // same logo on every page lands once
      seen.add(sig);
      out.push({
        dataUrl: `data:image/png;base64,${png.toString("base64")}`,
        page: p,
        width: Math.round(box.w),
        height: Math.round(box.h),
        box,
      });
      perPage++;
    }
  }

  return out;
}
