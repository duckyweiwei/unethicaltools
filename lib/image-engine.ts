/**
 * Browser image converter. Sister of lib/converter-engine.ts (ffmpeg) and
 * lib/bleep/whisper.ts (transformers.js) — different runtime, same shape.
 *
 * Two decode paths:
 *   - PNG / JPG / WEBP / AVIF: native browser via `createImageBitmap()` →
 *     zero dependencies, fastest path. AVIF decode works in Chrome 85+,
 *     Safari 16+, Firefox 113+ (i.e. >97% of users in 2026).
 *   - HEIC: lazy-loaded `libheif-js` WebAssembly bundle (~5 MB pure-JS
 *     build). Only fetched when a `*-to-heic` source is dropped, so the
 *     other routes don't pay the bundle cost.
 *
 * Encode path:
 *   - Always `canvas.toBlob(mime, quality)` — every browser supports
 *     PNG / JPG / WEBP output via this API. AVIF / HEIC encode is not
 *     practical in-browser (canvas doesn't reliably encode AVIF;
 *     libheif's encoder is patent-encumbered).
 *
 * Alpha handling: when output is JPG (no alpha) and input has transparency,
 * we composite onto a white background before encoding. This matches the
 * common "save as JPG" behavior in image editors.
 */

import type { ImageFormatConfig } from "./image-formats";

const DEFAULT_QUALITY: Record<"image/jpeg" | "image/webp" | "image/png", number> = {
  "image/jpeg": 0.92,
  "image/webp": 0.85,
  "image/png": 1, // ignored by toBlob for PNG; kept for shape uniformity
};

export interface ConvertImageOptions {
  /** The detected source format — drives the decode path. */
  inputFormat: ImageFormatConfig;
  /** Target MIME the canvas will encode. */
  outputMime: "image/png" | "image/jpeg" | "image/webp";
  /** 0–1 quality for lossy outputs. Defaults are sensible. */
  quality?: number;
  /** Background fill applied when input has alpha and output doesn't (JPG).
   *  Default `#ffffff` (matches image-editor "save as JPG" behavior). */
  background?: string;
  onProgress?: (p: ImageConvertProgress) => void;
}

export type ImageConvertProgress =
  | { stage: "reading" }
  | { stage: "loading-heic-decoder" }
  | { stage: "decoding" }
  | { stage: "encoding" }
  | { stage: "done" };

export interface ImageConvertResult {
  blob: Blob;
  filename: string;
  inputBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  durationMs: number;
}

/** Bitmap representation we can draw to a canvas regardless of decode path. */
interface DecodedBitmap {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export async function convertImage(
  file: File,
  opts: ConvertImageOptions,
): Promise<ImageConvertResult> {
  const startedAt = performance.now();
  const quality = opts.quality ?? DEFAULT_QUALITY[opts.outputMime];

  opts.onProgress?.({ stage: "reading" });

  const decoded =
    opts.inputFormat.id === "heic"
      ? await decodeHeic(file, opts.onProgress)
      : await decodeNative(file);

  opts.onProgress?.({ stage: "encoding" });

  // Composite onto a background when output can't carry alpha that the
  // input has. Currently this is JPG; PNG/WEBP keep alpha through.
  const needsCompositeBackground = opts.outputMime === "image/jpeg";

  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const ctx = canvas.getContext("2d", { alpha: !needsCompositeBackground });
  if (!ctx) throw new Error("Failed to obtain 2D canvas context");

  if (needsCompositeBackground) {
    ctx.fillStyle = opts.background ?? "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(decoded.source, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      opts.outputMime,
      quality,
    );
  });

  // Release ImageBitmap if we created one — frees GPU-side memory sooner.
  if (decoded.source instanceof ImageBitmap) decoded.source.close();

  opts.onProgress?.({ stage: "done" });

  return {
    blob,
    filename: deriveOutputName(file, opts.outputMime),
    inputBytes: file.size,
    outputBytes: blob.size,
    width: decoded.width,
    height: decoded.height,
    durationMs: performance.now() - startedAt,
  };
}

/** Native browser decode: works for PNG / JPG / WEBP / AVIF. */
async function decodeNative(file: File): Promise<DecodedBitmap> {
  // createImageBitmap handles all browser-supported formats efficiently and
  // gives us a GPU-friendly bitmap. Falls back to <img> + decode() if the
  // browser refuses (older Safari).
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height };
    } catch {
      // fall through to <img> path
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    // .decode() resolves once the image is fully ready to draw.
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    // Revoke happens later — keep alive until draw completes in caller scope.
    // Caller's drawImage consumes synchronously, so revoke at end of convertImage.
    // We'll let GC handle it; revoking too eagerly breaks Safari.
    void url;
  }
}

/**
 * HEIC decode via libheif-js (lazy-loaded). The library returns one or more
 * decoded images (HEIC supports image sequences); we take the first frame,
 * convert its RGBA bytes into ImageData, blit through a temp canvas, and
 * return that as an ImageBitmap-equivalent draw source.
 *
 * Bundle is ~5 MB pure-JS — fine as a lazy chunk for the HEIC route, would
 * be unacceptable in the main bundle.
 */
async function decodeHeic(
  file: File,
  onProgress?: (p: ImageConvertProgress) => void,
): Promise<DecodedBitmap> {
  onProgress?.({ stage: "loading-heic-decoder" });
  // `libheif-js` exports a factory function (Emscripten module pattern). The
  // dynamic-import + .default dance handles both CJS and ESM shapes the
  // bundler might wrap it in.
  const mod = (await import("libheif-js")) as unknown as
    | { default?: unknown; HeifDecoder?: new () => HeifDecoder }
    | { HeifDecoder: new () => HeifDecoder };
  const libheif = (mod as { default?: unknown }).default ?? mod;
  const Decoder = (libheif as { HeifDecoder?: new () => HeifDecoder }).HeifDecoder;
  if (!Decoder) {
    throw new Error("libheif-js did not expose HeifDecoder");
  }

  onProgress?.({ stage: "decoding" });
  const buffer = await file.arrayBuffer();
  const decoder = new Decoder();
  const images = decoder.decode(buffer);
  if (!images || images.length === 0) {
    throw new Error("libheif found no images in the file");
  }
  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();

  // Decode into an ImageData buffer the canvas can consume directly.
  const imageData = await new Promise<ImageData>((resolve, reject) => {
    image.display(
      { data: new Uint8ClampedArray(width * height * 4), width, height },
      (display: ImageData | null) => {
        if (!display) reject(new Error("libheif display callback returned null"));
        else resolve(display);
      },
    );
  });

  // Blit through a temp canvas so we can draw it onto the output canvas
  // (drawImage doesn't accept ImageData directly).
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const tmpCtx = tmp.getContext("2d");
  if (!tmpCtx) throw new Error("Failed to create temp canvas for HEIC blit");
  tmpCtx.putImageData(imageData, 0, 0);
  return { source: tmp, width, height };
}

function deriveOutputName(file: File, outputMime: string): string {
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  const ext =
    outputMime === "image/jpeg" ? "jpg"
    : outputMime === "image/png" ? "png"
    : outputMime === "image/webp" ? "webp"
    : "bin";
  return `${base}.${ext}`;
}

/* ---------- libheif-js type shims ---------- */
// The library has no published .d.ts. The shapes here are derived from its
// README + source. Kept minimal — we only touch HeifDecoder.decode and the
// per-image get_width / get_height / display methods.

interface HeifDecoder {
  decode(buffer: ArrayBuffer): HeifImage[];
}
interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(
    target: { data: Uint8ClampedArray; width: number; height: number },
    callback: (image: ImageData | null) => void,
  ): void;
}
