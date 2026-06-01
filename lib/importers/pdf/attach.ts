/**
 * Stage 2c — match extracted figures to questions, deterministically.
 *
 * With each figure's page rectangle (from `images.ts`) and the parser's
 * top-based text coordinates, we can finally say which question a figure belongs
 * to without guessing — using two signals, strongest first:
 *
 *   1. REFERENCE. A question that cites "Figure 1" / "Table 10.2" in its stem
 *      claims the figure that proves it. We prefer a figure that carries the SAME
 *      label as its own caption (which also resolves a label repeated across a
 *      long exam — e.g. two "Figure 2"s in different sections: each question takes
 *      the nearest). When no figure carries that caption — the common bare-table
 *      case, where "Table 10.2" lives only in the question text — we fall back to
 *      the nearest figure on the question's own page. Because this runs PER
 *      question, every question that names the same figure gets it (Q7 AND Q8).
 *
 *   2. POSITION. A figure NO question referenced, and with no caption of its own,
 *      attaches to the nearest question on the same page, preferring the first one
 *      below it (figures lead the questions that reference them). Bounded by
 *      distance so an unrelated image doesn't grab a far-off question.
 *
 * Anything we can't place confidently is left for the manual review tray — the
 * auto pass should save work, never mis-attach. Pure logic, server-side.
 */
import type { Quiz } from "../../domain/types";
import type { ExtractedDoc } from "./extract";
import type { ExtractedImage, Figure } from "./images";

/**
 * A region the SERVER asks the client to rasterize for a labeled-diagram MCQ.
 * Such a question's figure is vector line-art the raster extractor can't see
 * (see `Question.needsDiagram`), so the server can only point at WHERE it is —
 * page + rectangle — and let the browser render it (task: client pdf.js render).
 * The box is in PDF user units with y measured from the TOP (the same basis as
 * `Figure.box` and the extracted line coords); the client maps it to canvas
 * pixels by its own render scale and clamps it to the page.
 */
export interface DiagramRequest {
  questionId: string;
  page: number;
  box: { x: number; top: number; w: number; h: number };
}

/** "Figure 1", "Fig. 2", "Table 10.2" — capture the kind and its number. */
const LABEL_RE = /\b(figure|fig|table)\b\.?\s*([0-9]+(?:\.[0-9]+)?)/i;

/** Caption must sit within this vertical band around a figure's top edge. */
const CAPTION_ABOVE = 60; // px a caption may sit above the figure top
const CAPTION_INTO = 12; // px a caption may dip below the figure top
/** Positional fallback won't reach past this vertical gap (≈ half a page). */
const MAX_FALLBACK_GAP = 420;

function normLabel(kind: string, num: string): string {
  return `${/^fig/i.test(kind) ? "figure" : "table"} ${num}`;
}

/** Lowercased alphanumerics only — a spacing/punctuation-tolerant match key. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

interface Anchor {
  page: number;
  y: number;
}

/**
 * Find each question's source position by re-locating its opening line in the
 * extracted document. Two-pointer walk in reading order, matching a numbered
 * line whose text prefix lines up with the question's stem — tolerant of the
 * glue-repair the parser applied. Questions we can't place simply get no anchor
 * (caption matching still works; positional fallback is skipped for them).
 */
function locateAnchors(quiz: Quiz, doc: ExtractedDoc): Map<string, Anchor> {
  const cands = doc.lines
    .map((l) => {
      const m = /^\s*(\d{1,3})[.)]\s+(.+)/.exec(l.text);
      return m ? { page: l.page, y: l.y, rest: norm(m[2]) } : null;
    })
    .filter((c): c is { page: number; y: number; rest: string } => c !== null);

  const map = new Map<string, Anchor>();
  let cursor = 0;
  for (const q of quiz.questions) {
    const key = norm(q.stem).slice(0, 8);
    if (!key) continue;
    for (let j = cursor; j < cands.length; j++) {
      if (cands[j].rest.startsWith(key)) {
        map.set(q.id, { page: cands[j].page, y: cands[j].y });
        cursor = j + 1;
        break;
      }
    }
  }
  return map;
}

/** The caption label sitting next to a figure, or null. Prefers the closest
 *  matching line in the vertical band just above (or barely into) the figure. */
function captionFor(fig: Figure, doc: ExtractedDoc): string | null {
  let best: { label: string; dist: number } | null = null;
  for (const l of doc.lines) {
    if (l.page !== fig.page) continue;
    const m = LABEL_RE.exec(l.text);
    if (!m) continue;
    const above = fig.box.top - l.y; // >0 when the line is above the figure top
    if (above < -CAPTION_INTO || above > CAPTION_ABOVE) continue;
    if (Math.abs(l.x - fig.box.x) > Math.max(80, fig.box.w)) continue;
    const dist = Math.abs(above);
    if (!best || dist < best.dist) best = { label: normLabel(m[1], m[2]), dist };
  }
  return best?.label ?? null;
}

export function attachFigures(
  figures: Figure[],
  quiz: Quiz,
  doc: ExtractedDoc,
): ExtractedImage[] {
  const anchors = locateAnchors(quiz, doc);
  const captions = figures.map((f) => captionFor(f, doc));
  const targets: string[][] = figures.map(() => []);

  // Pass 1 — reference. Each question that names a figure in its stem claims it.
  for (const q of quiz.questions) {
    const m = LABEL_RE.exec(q.stem);
    if (!m) continue;
    const label = normLabel(m[1], m[2]);
    const a = anchors.get(q.id);

    // (a) Prefer a figure whose OWN caption matches the label — the strongest
    // signal, and the one that disambiguates a label repeated across sections
    // (each question takes the nearest same-label figure, by page then distance).
    let best = -1;
    let bestKey = Infinity;
    figures.forEach((f, i) => {
      if (captions[i] !== label) return;
      const center = f.box.top + f.box.h / 2;
      const key = a ? Math.abs(f.page - a.page) * 1e5 + Math.abs(center - a.y) : i;
      if (key < bestKey) {
        bestKey = key;
        best = i;
      }
    });

    // (b) No figure carries that caption — the bare-table case, where "Table N"
    // appears only in the question text. Fall back to the nearest figure on the
    // question's OWN page, preferring one just above it (a figure leads the
    // questions that cite it). Bounded so a stray "Refer to…" at the far end of a
    // page can't reach an unrelated image. Per-question, so Q7 and Q8 both get it.
    if (best < 0 && a) {
      let bestScore = Infinity;
      figures.forEach((f, i) => {
        if (f.page !== a.page) return;
        const below = a.y >= f.box.top; // question starts at/under the figure top
        const gap = below ? Math.max(0, a.y - (f.box.top + f.box.h)) : f.box.top - a.y;
        if (gap > MAX_FALLBACK_GAP) return;
        const score = (below ? 0 : 1e6) + gap;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
    }

    if (best >= 0 && !targets[best].includes(q.id)) targets[best].push(q.id);
  }

  // Pass 2 — positional fallback for CAPTIONLESS, still-unmatched figures: the
  // anchored question on the same page nearest the figure by EDGE DISTANCE. This
  // is direction-agnostic on purpose. The common exam layout is stem → figure →
  // options, so the figure sits just below its question's start line (nearest the
  // question ABOVE it); a shared stimulus instead leads the question it serves
  // (nearest the question BELOW it). Edge distance picks the right owner in both
  // cases, and a tie resolves to the earlier (above) question since the first
  // minimum is kept — so a figure embedded under a stem never jumps to the next
  // question that happens to start lower on the page.
  figures.forEach((f, i) => {
    if (captions[i] || targets[i].length) return;
    const figTop = f.box.top;
    const figBot = f.box.top + f.box.h;
    let best: string | null = null;
    let bestGap = Infinity;
    for (const q of quiz.questions) {
      const a = anchors.get(q.id);
      if (!a || a.page !== f.page) continue;
      // 0 when the question's start line falls within the figure's vertical span.
      const gap = a.y >= figBot ? a.y - figBot : a.y <= figTop ? figTop - a.y : 0;
      if (gap > MAX_FALLBACK_GAP) continue;
      if (gap < bestGap) {
        bestGap = gap;
        best = q.id;
      }
    }
    if (best) targets[i].push(best);
  });

  // Pages that hold at least one IMPORTED question. A page with none is an
  // unsupported section — the long free-response / graphical problems this tool
  // doesn't turn into quiz questions ("Question #8: Taxes (20 Points)…"). A figure
  // stranded on such a page has nothing to attach to, so we DROP it rather than
  // export a graph for a question the quiz doesn't contain. Figures that DID
  // attach are always kept; an unattached figure on a supported page still falls
  // through to the manual review tray (a genuine "couldn't place it" case).
  const supportedPages = new Set<number>();
  for (const a of anchors.values()) supportedPages.add(a.page);

  const out: ExtractedImage[] = [];
  figures.forEach((f, i) => {
    if (!targets[i].length && !supportedPages.has(f.page)) return; // unsupported-section figure → drop
    out.push({
      dataUrl: f.dataUrl,
      page: f.page,
      width: f.width,
      height: f.height,
      attachToIds: targets[i],
    });
  });
  return out;
}

/** Padding (PDF user units) around the detected text band, so the captured
 *  region comfortably includes vector strokes that reach past the labels. */
const DIAGRAM_PAD = { top: 8, bottomNoNext: 48, side: 16 } as const;
/** Hard cap on a captured region's height, so a mis-located anchor can't ask the
 *  client to rasterize half a page. */
const MAX_DIAGRAM_H = 640;

/**
 * Build a rasterize request for every `needsDiagram` question — the labeled-
 * diagram MCQs the parser recovered, whose A/B/C/D choices are letters printed
 * on a VECTOR figure the raster extractor never sees. We can't capture the
 * pixels here (no server-side rasterizer), so we hand the client the page and a
 * rectangle to render.
 *
 * The rectangle is the question's vertical band on its page: from just above its
 * stem down to the next question that starts below it (or a padded bottom when
 * it's the last on the page), spanning the body text column. Bounding the band
 * by the next question guarantees the whole figure is inside it without bleeding
 * into the following question — clipping a diagram would defeat the point, so we
 * err generous (extra whitespace is harmless). Questions we can't re-locate in
 * the document get no request and simply fall back to manual image attach.
 */
export function computeDiagramRequests(quiz: Quiz, doc: ExtractedDoc): DiagramRequest[] {
  const needs = quiz.questions.filter((q) => q.needsDiagram);
  if (!needs.length) return [];
  const anchors = locateAnchors(quiz, doc);
  const out: DiagramRequest[] = [];
  for (const q of needs) {
    const a = anchors.get(q.id);
    if (!a) continue;
    // The nearest question that starts below this one on the SAME page bounds the
    // band from beneath (figures sit between a stem and the next question).
    let nextY = Infinity;
    for (const other of quiz.questions) {
      const oa = anchors.get(other.id);
      if (oa && oa.page === a.page && oa.y > a.y && oa.y < nextY) nextY = oa.y;
    }
    const band = doc.lines.filter((l) => l.page === a.page && l.y >= a.y - 2 && l.y < nextY);
    const ws = band.flatMap((l) => l.words);
    if (!ws.length) continue;
    const left = Math.max(0, Math.min(...ws.map((w) => w.x)) - DIAGRAM_PAD.side);
    const right = Math.max(...ws.map((w) => w.x + w.width)) + DIAGRAM_PAD.side;
    const top = Math.max(0, Math.min(...ws.map((w) => w.y - w.height)) - DIAGRAM_PAD.top);
    // When another question follows on the page, extend to just above it so the
    // figure (which may have blank space below its lowest label) is never clipped;
    // otherwise pad beneath the lowest word.
    const bottom =
      nextY === Infinity ? Math.max(...ws.map((w) => w.y)) + DIAGRAM_PAD.bottomNoNext : nextY - 4;
    const h = Math.min(MAX_DIAGRAM_H, bottom - top);
    if (h <= 0 || right <= left) continue;
    out.push({ questionId: q.id, page: a.page, box: { x: left, top, w: right - left, h } });
  }
  return out;
}
