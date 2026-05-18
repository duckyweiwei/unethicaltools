import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/components/StructuredData";
import { breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { CONVERTERS } from "@/lib/converters";
import { AUDIO_CONVERTERS } from "@/lib/audio-converters";
import { IMAGE_CONVERTERS } from "@/lib/image-converters";

/**
 * Chooser page for the unified "Converters" nav tab. The three category
 * hubs (video / audio / image) still exist at their parallel-named URLs
 * (/video-converter, /audio-converter, /image-converter) — this page just
 * gives users one entry point that branches into them.
 *
 * Per-format pages (/wav-to-mp3, /ts-to-mp4, /heic-to-jpg, …) are
 * unchanged. The nav's `Converters` tab highlights on this page AND on
 * any of the three category hubs AND on any per-format slug.
 */
export const metadata: Metadata = {
  title: `Converters — Video, Audio, Image · ${SITE_NAME}`,
  description:
    "Pick a converter category: video (TS / MOV / MKV / WEBM → MP4), audio (WAV / FLAC / M4A → MP3), or image (HEIC / AVIF / WEBP → JPG). All run in your browser — no upload, no account.",
  alternates: { canonical: absoluteUrl("/converters") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/converters"),
    title: `Converters — ${SITE_NAME}`,
    description:
      "Pick a converter category: video, audio, or image. All run in your browser, no upload.",
    siteName: SITE_NAME,
  },
};

interface CategoryEntry {
  href: string;
  title: string;
  blurb: string;
  badge: string;
  Icon: () => React.ReactElement;
  /** Color accent used in the icon square + badge ring. */
  tone: "violet" | "amber" | "sky";
}

const CATEGORIES: CategoryEntry[] = [
  {
    href: "/video-converter",
    title: "Video Converter",
    blurb:
      "Convert TS, MOV, MKV, WEBM, AVI, FLV, or MPEG into universal MP4. Remux when the codecs allow it (instant), re-encode otherwise — all in your browser.",
    badge: `${CONVERTERS.length} formats → MP4`,
    Icon: VideoIcon,
    tone: "violet",
  },
  {
    href: "/audio-converter",
    title: "Audio Converter",
    blurb:
      "Convert WAV, FLAC, M4A, OGG, WMA, or AIFF into portable MP3 (~190 kbps VBR). Same ffmpeg.wasm engine as the video converter, audio-only path.",
    badge: `${AUDIO_CONVERTERS.length} formats → MP3`,
    Icon: AudioIcon,
    tone: "amber",
  },
  {
    href: "/image-converter",
    title: "Image Converter",
    blurb:
      "Convert HEIC, AVIF, WEBP, PNG, or JPG between each other. Canvas-based for the common formats; lazy-loaded libheif WebAssembly for HEIC.",
    badge: `${IMAGE_CONVERTERS.length} conversions`,
    Icon: ImageIcon,
    tone: "sky",
  },
];

const TONE_CLASSES: Record<CategoryEntry["tone"], { wrap: string; badge: string }> = {
  violet: {
    wrap: "bg-violet-400/10 border border-violet-400/30 text-violet-300",
    badge: "border-violet-400/25 text-violet-300/90",
  },
  amber: {
    wrap: "bg-amber-400/10 border border-amber-400/30 text-amber-300",
    badge: "border-amber-400/25 text-amber-300/90",
  },
  sky: {
    wrap: "bg-sky-400/10 border border-sky-400/30 text-sky-300",
    badge: "border-sky-400/25 text-sky-300/90",
  },
};

export default function ConvertersChooserPage() {
  return (
    <>
      <StructuredData
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Converters", path: "/converters" },
          ]),
        ]}
      />

      <section className="relative pt-12 sm:pt-20 pb-6 sm:pb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          Pick a category
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Converters
        </h1>

        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Three families. Same privacy guarantee across all of them — your
          files never leave your device.
        </p>
      </section>

      <section
        id="converter-categories"
        className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 sm:mt-16"
      >
        <ul className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {CATEGORIES.map((cat) => {
            const tone = TONE_CLASSES[cat.tone];
            return (
              <li key={cat.href}>
                <Link
                  href={cat.href}
                  className="group block h-full rounded-2xl glass p-6 sm:p-7 transition-all hover:border-[var(--color-border-strong)] hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span
                      className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ${tone.wrap}`}
                    >
                      <cat.Icon />
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border whitespace-nowrap ${tone.badge}`}
                    >
                      {cat.badge}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)] mb-2">
                    {cat.title}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {cat.blurb}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
                    Browse
                    <ArrowIcon />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function VideoIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform group-hover:translate-x-0.5"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
