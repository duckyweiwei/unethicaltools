/**
 * Image converter registry — one entry per `<input>-to-<output>` slug.
 * Mirrors lib/converters.ts (video → MP4) and lib/audio-converters.ts
 * (audio → MP3).
 *
 * Unlike video/audio, images have multiple legitimate targets (JPG for
 * "make this play everywhere", WEBP for "modernize for the web", PNG for
 * "I need lossless / transparency"), so we don't lock to one output —
 * each route declares both input + output explicitly.
 */

import type { ImageFormatId } from "./image-formats";
import { IMAGE_FORMATS } from "./image-formats";
import type { FAQ } from "./converters";

const BENEFIT_KEYWORDS = [
  "no upload",
  "no upload image converter",
  "private image converter",
  "free image converter",
  "no sign up image converter",
  "no account image converter",
];

export interface ImageConverterConfig {
  /** URL slug, e.g. "heic-to-jpg". */
  slug: string;
  input: ImageFormatId;
  output: Exclude<ImageFormatId, "avif" | "heic">; // we encode only PNG/JPG/WEBP
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  tagline: string;
  whyConvertParagraphs: string[];
  faqs: FAQ[];
}

const SHARED_IMAGE_FAQS: FAQ[] = [
  {
    q: "Is my image actually private?",
    a:
      "Yes. The conversion runs entirely in your browser — for PNG/JPG/WEBP/AVIF via the standard Canvas API, for HEIC via the libheif-js WebAssembly library. There's no upload endpoint in the code. You can open DevTools and check the Network tab.",
  },
  {
    q: "Does the output preserve image dimensions?",
    a:
      "Yes — the output keeps the original pixel dimensions exactly. No resizing, no cropping. If you need to resize, do it in a dedicated image editor after the format conversion.",
  },
  {
    q: "What about EXIF metadata (camera info, GPS, timestamps)?",
    a:
      "Most EXIF metadata is dropped during conversion. The browser's canvas pipeline doesn't carry EXIF through. EXIF orientation IS applied (the image isn't rotated wrong), but camera tags, GPS coords, and timestamps don't survive. This is usually a privacy win when sharing photos.",
  },
  {
    q: "What's the file size limit?",
    a:
      "There's no fixed limit — only what your device's RAM can hold. Even very large photos (~50 MP) decode and re-encode in seconds on a modern laptop. HEIC files take longer (~1-3 s) because they decode via WebAssembly.",
  },
];

export const IMAGE_CONVERTERS: ImageConverterConfig[] = [
  {
    slug: "heic-to-jpg",
    input: "heic",
    output: "jpg",
    title: "HEIC to JPG Converter — Free, No Upload, Private",
    description:
      "Convert HEIC (iPhone photos) to JPG in your browser. Free, no upload, no account. Makes iPhone camera roll photos universally playable.",
    keywords: [
      "heic to jpg converter",
      "heic to jpeg",
      "iphone photo to jpg",
      "heic converter free",
      "heic to jpg no upload",
      "heic to jpg private",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "HEIC to JPG Converter",
    tagline:
      "Convert iPhone HEIC photos to universal JPG — privately, in your browser. No upload.",
    whyConvertParagraphs: [
      "HEIC is Apple's default photo format on iPhones since iOS 11. It's about half the size of JPG at the same quality — great for storage on the device, terrible for sharing. Most platforms outside the Apple ecosystem (Windows, Android, Discord, most CMSes, almost every email client) still don't decode HEIC natively.",
      "Converting to JPG fixes the compatibility wall. Every browser, phone, social platform, and printer made in the last two decades handles JPG. You trade Apple's tighter compression for universal playback — a fair trade if the photo is leaving your iPhone.",
    ],
    faqs: [
      {
        q: "Why won't my Windows / Discord / web upload form open my HEIC?",
        a:
          "HEIC support outside Apple is patchy. Windows 10+ requires a paid extension. Most upload forms whitelist .jpg/.png/.webp specifically. Most non-Apple chat / email apps either refuse HEIC or convert it themselves (often losing the original).",
      },
      {
        q: "Will the JPG be larger than the HEIC?",
        a:
          "Yes — typically 1.5-2× larger. HEIC is more compression-efficient. The trade-off is the universal compatibility.",
      },
      {
        q: "Are bursts / Live Photos preserved?",
        a:
          "No — only the main still frame is decoded. The motion data in Live Photos and the depth maps in Portrait shots don't carry through to JPG (the JPG format doesn't have a place to put them).",
      },
      ...SHARED_IMAGE_FAQS,
    ],
  },
  {
    slug: "avif-to-jpg",
    input: "avif",
    output: "jpg",
    title: "AVIF to JPG Converter — Free, No Upload, Private",
    description:
      "Convert AVIF (modern web image format) to JPG in your browser. Free, no upload. Makes AVIF images work in older tools and apps.",
    keywords: [
      "avif to jpg converter",
      "avif to jpeg",
      "avif converter free",
      "avif to jpg no upload",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "AVIF to JPG Converter",
    tagline:
      "Convert modern AVIF images to universal JPG — privately, in your browser.",
    whyConvertParagraphs: [
      "AVIF (AV1 Image File Format) is the newest open image format — typically ~50% smaller than JPG at the same visual quality. Browsers decode it (Chrome 85+, Safari 16+, Firefox 113+), but most image editors, older CMSes, and almost every native desktop app still don't recognize it.",
      "Converting to JPG gets you universal compatibility. You lose AVIF's better compression efficiency but gain the ability to open the file anywhere.",
    ],
    faqs: [
      {
        q: "Why is the JPG so much larger?",
        a:
          "AVIF compresses ~30-50% better than JPG at perceptually similar quality. A 200 KB AVIF often becomes a 400-500 KB JPG. The trade-off is universal compatibility.",
      },
      {
        q: "Can this handle AVIF with alpha (transparency)?",
        a:
          "AVIF supports alpha, but JPG doesn't. We composite the AVIF onto a white background before encoding to JPG. If you need transparency preserved, convert to PNG or WEBP instead.",
      },
      ...SHARED_IMAGE_FAQS,
    ],
  },
  {
    slug: "webp-to-jpg",
    input: "webp",
    output: "jpg",
    title: "WEBP to JPG Converter — Free, No Upload, Private",
    description:
      "Convert WEBP to JPG in your browser. Free, no upload. Makes Google's modern image format work in older tools, email, and Office apps.",
    keywords: [
      "webp to jpg converter",
      "webp to jpeg",
      "webp converter free",
      "webp to jpg no upload",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "WEBP to JPG Converter",
    tagline:
      "Convert Google's WEBP images to universal JPG — privately, in your browser. No upload.",
    whyConvertParagraphs: [
      "WEBP is Google's modern image format — ~25-35% smaller than JPG at similar quality, with optional alpha. Every major browser decodes it. The remaining holdouts are older email clients, certain CMSes (legacy WordPress installs without plugins), Microsoft Office, and a handful of niche desktop apps.",
      "JPG is the path of least resistance when you need an image that absolutely plays anywhere — at the cost of file size.",
    ],
    faqs: [
      {
        q: "What about animated WEBP files?",
        a:
          "Only the first frame is converted. JPG has no concept of animation. If you need animated output, look for a WEBP-to-GIF converter instead.",
      },
      {
        q: "WEBP with alpha — what happens?",
        a:
          "JPG can't hold an alpha channel. We composite the transparent areas onto a white background before encoding to JPG. To preserve transparency, convert to PNG.",
      },
      ...SHARED_IMAGE_FAQS,
    ],
  },
  {
    slug: "png-to-jpg",
    input: "png",
    output: "jpg",
    title: "PNG to JPG Converter — Free, No Upload, Private",
    description:
      "Convert PNG to JPG in your browser. Free, no upload, no account. Shrinks large lossless screenshots and photos to portable JPG.",
    keywords: [
      "png to jpg converter",
      "png to jpeg",
      "png converter",
      "png to jpg no upload",
      "compress png",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "PNG to JPG Converter",
    tagline:
      "Shrink large lossless PNGs into portable JPGs — privately, in your browser.",
    whyConvertParagraphs: [
      "PNG stores every pixel losslessly — perfect for screenshots, UI assets, and anything with sharp edges or text. The downside is file size: a high-resolution photo saved as PNG can be 10-20× larger than the same photo as JPG.",
      "Converting to JPG is the right move when the image is a photo (gradients, fine detail) and you don't need transparency. For screenshots of text, UI, or line art, PNG stays the better choice — JPG's lossy compression introduces visible ringing artifacts on sharp edges.",
    ],
    faqs: [
      {
        q: "Should I really convert screenshots to JPG?",
        a:
          "Usually no. JPG compression introduces visible artifacts on sharp edges and text — exactly what screenshots have. PNG keeps screenshots pixel-perfect. JPG only makes sense for photos with smooth gradients.",
      },
      {
        q: "What happens to PNG transparency?",
        a:
          "JPG doesn't support transparency. Transparent areas get composited onto a white background before JPG encoding. If you need to keep transparency, don't convert to JPG — keep the PNG or use WEBP.",
      },
      {
        q: "How much smaller will the JPG be?",
        a:
          "For typical photos: 5-15× smaller at visually transparent quality (our default 92% JPG quality). For screenshots / text / line art: only 2-3× smaller, with worse visible quality.",
      },
      ...SHARED_IMAGE_FAQS,
    ],
  },
  {
    slug: "png-to-webp",
    input: "png",
    output: "webp",
    title: "PNG to WEBP Converter — Free, No Upload, Private",
    description:
      "Convert PNG to WEBP in your browser. Free, no upload. Modernize web images — smaller files, transparency preserved.",
    keywords: [
      "png to webp converter",
      "png to webp free",
      "png to webp no upload",
      "modernize images",
      "smaller png",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "PNG to WEBP Converter",
    tagline:
      "Modernize PNG images to smaller WEBP — privately, in your browser. Transparency preserved.",
    whyConvertParagraphs: [
      "WEBP supports both lossy and lossless compression with alpha — the best of PNG and JPG combined. For web delivery it's the modern default: typically 25-50% smaller than PNG with the same visual quality, transparency preserved.",
      "If you control where the image will be served (your own website, a modern CMS, a mobile app), WEBP is almost always the right choice. The only reason to stick with PNG is compatibility with very old tools.",
    ],
    faqs: [
      {
        q: "Is WEBP lossless or lossy?",
        a:
          "Both modes exist. The browser's canvas.toBlob('image/webp') uses lossy compression at our default quality. Lossless WEBP requires a specialized encoder (not exposed via canvas).",
      },
      {
        q: "Will transparency be preserved?",
        a:
          "Yes — WEBP fully supports alpha. The transparency from your PNG carries through to WEBP intact.",
      },
      ...SHARED_IMAGE_FAQS,
    ],
  },
  {
    slug: "jpg-to-webp",
    input: "jpg",
    output: "webp",
    title: "JPG to WEBP Converter — Free, No Upload, Private",
    description:
      "Convert JPG to WEBP in your browser. Free, no upload. Modernize photo files — typically 25-35% smaller at similar quality.",
    keywords: [
      "jpg to webp converter",
      "jpeg to webp",
      "jpg to webp free",
      "jpg to webp no upload",
      "compress jpg",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "JPG to WEBP Converter",
    tagline:
      "Shrink JPG photos with WEBP's modern compression — privately, in your browser.",
    whyConvertParagraphs: [
      "WEBP's lossy mode is ~25-35% smaller than JPG at visually similar quality. For web delivery — product photos, blog images, social previews — that translates directly into faster page loads.",
      "The trade-off is the same as any modernization: WEBP needs a relatively modern browser or app to display. If the image will be embedded somewhere you don't control (old email clients, Microsoft Office, certain print workflows), JPG remains the safer choice.",
    ],
    faqs: [
      {
        q: "Is there any quality loss converting JPG → WEBP?",
        a:
          "Yes — both are lossy. The double-encoding introduces a small additional loss. At our default quality (~85% WEBP) it's usually visually transparent on photos. If you have the original (PNG or RAW), encoding that to WEBP gives a cleaner result than re-encoding a JPG.",
      },
      {
        q: "Does WEBP support animated images like GIF?",
        a:
          "Animated WEBP exists but isn't produced by browser canvas.toBlob (single-frame only). Use a dedicated animated-WEBP tool if you need animation.",
      },
      ...SHARED_IMAGE_FAQS,
    ],
  },
];

export function getImageConverter(slug: string): ImageConverterConfig | null {
  return IMAGE_CONVERTERS.find((c) => c.slug === slug) ?? null;
}

export function getImageConverterFormat(slug: string) {
  const c = getImageConverter(slug);
  return c ? IMAGE_FORMATS[c.input] : null;
}

export function getRelatedImageConverters(
  slug: string,
  n: number = 4,
): ImageConverterConfig[] {
  const current = getImageConverter(slug);
  if (!current) return IMAGE_CONVERTERS.slice(0, n);
  const others = IMAGE_CONVERTERS.filter((c) => c.slug !== slug);
  // Prefer same input (different output) first, then same output (different
  // input), then everything else.
  const sameInput = others.filter((c) => c.input === current.input);
  const sameOutput = others.filter(
    (c) => c.output === current.output && c.input !== current.input,
  );
  const rest = others.filter(
    (c) => c.input !== current.input && c.output !== current.output,
  );
  return [...sameInput, ...sameOutput, ...rest].slice(0, n);
}
