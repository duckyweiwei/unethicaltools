import type { Metadata } from "next";
import { TranscribeConverter } from "@/components/TranscribeConverter";
import { StructuredData } from "@/components/StructuredData";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import {
  breadcrumbSchema,
  webApplicationSchema,
} from "@/lib/structured-data";
import type { ConverterConfig } from "@/lib/converters";

export const metadata: Metadata = {
  title:
    "Transcribe Video to Text — Free Whisper Transcription, No Upload",
  description:
    "Drop any video and get a transcript with word-level timestamps. Download TXT, SRT, VTT, or JSON. Whisper-base.en runs locally in your browser — no upload, no account, no quota.",
  keywords: [
    "video to text transcriber",
    "free video transcription",
    "whisper in browser",
    "video to srt free",
    "video to vtt free",
    "video to subtitles",
    "no upload transcribe",
    "private video transcript",
    "subtitle generator free",
    "whisper word timestamps",
  ],
  alternates: { canonical: absoluteUrl("/transcribe") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/transcribe"),
    title: "Transcribe Video to Text — Free, Local, No Upload",
    description:
      "Local Whisper transcription with SRT, VTT, TXT, and JSON export.",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "Transcribe Video to Text — Free, Local, No Upload",
    description:
      "Local Whisper transcription with SRT, VTT, TXT, and JSON export.",
  },
};

/**
 * `webApplicationSchema()` is converter-shaped — feed it a minimal config
 * so we can reuse the same JSON-LD generator instead of forking it.
 */
const SCHEMA_STUB: ConverterConfig = {
  slug: "transcribe",
  input: "mp4",
  output: "mp4",
  title: "Transcribe Video to Text — Free, Local, No Upload",
  description:
    "Local Whisper transcription with SRT, VTT, TXT, and JSON export.",
  keywords: [],
  h1: "Video to text transcriber",
  tagline:
    "Drop any video, get a transcript with word-level timestamps. Whisper runs in your browser, no upload.",
  whyConvertParagraphs: [],
  remuxOutlook: "",
  faqs: [],
};

export default function TranscribePage() {
  return (
    <>
      <StructuredData
        data={[
          webApplicationSchema(SCHEMA_STUB),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Video to text", path: "/transcribe" },
          ]),
        ]}
      />

      <section className="relative pt-12 sm:pt-20 pb-10 sm:pb-14 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
          </span>
          New · in-browser Whisper transcription
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Video to text transcriber
        </h1>

        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Drop any video, get a transcript with word-level timestamps.
          Whisper runs in your browser. No upload, no account.
        </p>
      </section>

      <TranscribeConverter />

      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gradient">
          How it works
        </h2>
        <p className="mt-3 text-[var(--color-text-muted)]">
          Same on-device promise as the rest of the site: nothing leaves
          your machine.
        </p>
        <ol className="mt-8 grid gap-3 text-left">
          <Step n="1" title="Drop a video or audio file">
            Any format the converter accepts — TS, MOV, MKV, WEBM, AVI,
            FLV, MPEG, MP4, plus audio-only WAV / MP3 / M4A.
          </Step>
          <Step n="2" title="Audio extracted to PCM">
            ffmpeg.wasm pulls the audio track to 16 kHz mono — Whisper&rsquo;s
            input format. No upload.
          </Step>
          <Step n="3" title="On-device transcription">
            transformers.js runs Whisper-base.en in your browser, on
            WebGPU when available. ~80 MB model, cached after first visit.
            Returns each word with a precise timestamp.
          </Step>
          <Step n="4" title="Download what you need">
            Plain text, SRT, VTT, or JSON — all generated locally and
            handed back as in-browser blob downloads.
          </Step>
        </ol>
      </section>
    </>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl glass p-4 sm:p-5 flex gap-4">
      <span className="shrink-0 h-8 w-8 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 flex items-center justify-center text-xs font-mono text-[var(--color-text)]">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium tracking-tight text-[var(--color-text)] mb-1">
          {title}
        </div>
        <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {children}
        </div>
      </div>
    </li>
  );
}
