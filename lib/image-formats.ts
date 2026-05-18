/**
 * Image format registry — parallel to lib/formats.ts (video) and
 * lib/audio-formats.ts (audio). Used by the Image Converter tool.
 *
 * Adding a new image format = adding one entry here + an entry in
 * lib/image-converters.ts. The conversion engine, UI, sitemap, and SEO
 * pages all read from these two registries.
 *
 * Kept separate from video/audio because image conversion uses a totally
 * different runtime (canvas / ImageDecoder / libheif-js for HEIC) — none
 * of the ffmpeg.wasm machinery applies.
 */

export type ImageFormatId = "png" | "jpg" | "webp" | "avif" | "heic";

export interface ImageFormatConfig {
  id: ImageFormatId;
  /** UPPERCASE display name (e.g. "PNG"). */
  displayName: string;
  /** Lower-case, no-dot list of file extensions associated with this format. */
  extensions: string[];
  /** MIME types used in accept= and File.type sniffing. */
  mimeTypes: string[];
  /** Canvas / Blob output MIME (the one we feed to `canvas.toBlob()`). Only
   *  set for formats we can WRITE (PNG/JPG/WEBP). HEIC + AVIF input only. */
  outputMime?: "image/png" | "image/jpeg" | "image/webp";
  /** Whether the format compresses lossy. PNG = lossless, JPG/AVIF/HEIC = lossy. */
  losslessness: "lossless" | "lossy";
  /** Whether the format supports alpha (transparency). PNG/WEBP = yes; JPG = no. */
  supportsAlpha: boolean;
  /** Long-form, human-friendly description of the format. */
  description: string;
  /** Common origin / use cases. */
  origin: string;
}

export const IMAGE_FORMATS: Record<ImageFormatId, ImageFormatConfig> = {
  png: {
    id: "png",
    displayName: "PNG",
    extensions: ["png"],
    mimeTypes: ["image/png"],
    outputMime: "image/png",
    losslessness: "lossless",
    supportsAlpha: true,
    description:
      "PNG (Portable Network Graphics) is the universal lossless image format — lossless compression, alpha transparency, supported by every browser and image viewer made since the late 1990s. Larger than lossy formats; perfect for screenshots, UI assets, and anything where pixel-perfect matters.",
    origin:
      "Screenshots, app icons, UI assets, line art, anywhere transparency matters.",
  },
  jpg: {
    id: "jpg",
    displayName: "JPG",
    extensions: ["jpg", "jpeg", "jpe", "jfif"],
    mimeTypes: ["image/jpeg"],
    outputMime: "image/jpeg",
    losslessness: "lossy",
    supportsAlpha: false,
    description:
      "JPG (JPEG) is the universal lossy photo format. Excellent compression for natural images (photos with gradients, fine detail). No transparency. Plays everywhere — every browser, phone, camera, social platform, printer.",
    origin:
      "Camera photos, web images, social media posts, photo prints. The default photo format since 1992.",
  },
  webp: {
    id: "webp",
    displayName: "WEBP",
    extensions: ["webp"],
    mimeTypes: ["image/webp"],
    outputMime: "image/webp",
    losslessness: "lossy",
    supportsAlpha: true,
    description:
      "WEBP is Google's modern image format — typically 25-35% smaller than JPG at the same quality, with optional alpha. Universally supported by browsers since 2020, but some legacy tools (older email clients, certain CMSes, Microsoft Office) still don't accept it.",
    origin:
      "Modern web delivery, Google services, optimized assets from image CDNs.",
  },
  avif: {
    id: "avif",
    displayName: "AVIF",
    extensions: ["avif"],
    mimeTypes: ["image/avif"],
    // No outputMime: browsers don't reliably encode AVIF via canvas.toBlob.
    // Decode works in Chrome 85+ / Safari 16+ / Firefox 113+, which we use
    // to convert AVIF → JPG/PNG/WEBP, but not the reverse.
    losslessness: "lossy",
    supportsAlpha: true,
    description:
      "AVIF (AV1 Image File Format) is the newest open image format — ~50% smaller than JPG at similar quality, lossless or lossy, alpha support. Modern browsers decode it; older tools and many native apps still don't.",
    origin:
      "Modern web delivery (Netflix, YouTube thumbnails, image-CDN output), AV1 ecosystem.",
  },
  heic: {
    id: "heic",
    displayName: "HEIC",
    extensions: ["heic", "heif"],
    mimeTypes: ["image/heic", "image/heif"],
    // HEIC output isn't practical in-browser (no native encoder, libheif's
    // encoder is patent-encumbered). Decode-only via libheif-js, then we
    // export to JPG/PNG/WEBP.
    losslessness: "lossy",
    supportsAlpha: true,
    description:
      "HEIC (High Efficiency Image Container) is Apple's default photo format on iPhones since 2017. Smaller than JPG, supports depth maps and bursts — but only Apple devices and very recent versions of Windows / Chrome / Firefox decode it natively. The reason every iPhone photo needs conversion before uploading anywhere.",
    origin:
      "iPhone / iPad photos (camera roll default since iOS 11), recent macOS screenshots.",
  },
};

export function getImageFormat(id: ImageFormatId): ImageFormatConfig {
  return IMAGE_FORMATS[id];
}

/** Match by extension (without dot). Returns null when unknown. */
export function detectImageFormatByExtension(ext: string): ImageFormatConfig | null {
  const lower = ext.toLowerCase().replace(/^\./, "");
  for (const f of Object.values(IMAGE_FORMATS)) {
    if (f.extensions.includes(lower)) return f;
  }
  return null;
}

/** Best-effort detection from a File. */
export function detectImageFormatFromFile(file: File): ImageFormatConfig | null {
  const m = file.name.match(/\.([^.]+)$/);
  if (m) {
    const byExt = detectImageFormatByExtension(m[1]);
    if (byExt) return byExt;
  }
  if (file.type) {
    for (const f of Object.values(IMAGE_FORMATS)) {
      if (f.mimeTypes.some((t) => t.toLowerCase() === file.type.toLowerCase())) {
        return f;
      }
    }
  }
  return null;
}
