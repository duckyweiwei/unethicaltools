import type { Metadata } from "next";
import { BleepConverter } from "@/components/BleepConverter";
import { StructuredData } from "@/components/StructuredData";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import {
  breadcrumbSchema,
  webApplicationSchema,
} from "@/lib/structured-data";
import type { ConverterConfig } from "@/lib/converters";

export const metadata: Metadata = {
  title:
    "Bleep Profanity in Video — Free, No Upload, Private, No Sign Up",
  description:
    "Auto-detect and mute profanity in any video, locally in your browser. No upload, no account, no quota. Whisper transcribes on-device, ffmpeg mutes the offending words, you download a clean MP4 + a timestamped log.",
  keywords: [
    "bleep video",
    "censor profanity video",
    "auto bleep video free",
    "bleepify alternative",
    "mute swear words video",
    "remove profanity video free",
    "no upload bleep tool",
    "private profanity censor",
    "browser bleep tool",
    "free no signup bleep",
  ],
  alternates: { canonical: absoluteUrl("/bleep") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/bleep"),
    title: "Bleep Profanity in Video — Free, No Upload",
    description:
      "Auto-detect and mute profanity in any video, locally in your browser.",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "Bleep Profanity in Video — Free, No Upload",
    description:
      "Auto-detect and mute profanity in any video, locally in your browser.",
  },
};

/**
 * `webApplicationSchema()` is converter-shaped — give it a minimal config so
 * it can render a JSON-LD entry without us adding a separate schema fn.
 * The `slug`, `input`, etc. fields go unused by this page's renderer.
 */
const SCHEMA_STUB: ConverterConfig = {
  slug: "bleep",
  input: "mp4",
  output: "mp4",
  title: "Bleep Profanity in Video — Free, No Upload",
  description:
    "Auto-detect and mute profanity in any video, locally in your browser.",
  keywords: [],
  h1: "Bleep profanity in video",
  tagline:
    "Auto-detect and mute swear words in any video. Local Whisper transcription, no upload, no account.",
  whyConvertParagraphs: [],
  remuxOutlook: "",
  faqs: [],
};

export default function BleepPage() {
  return (
    <>
      <StructuredData
        data={[
          webApplicationSchema(SCHEMA_STUB),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Auto-bleep video", path: "/bleep" },
          ]),
        ]}
      />

      <section className="relative pt-12 sm:pt-20 pb-10 sm:pb-14 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          Building · phase 2 of 6 — audio extraction
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Bleep profanity in video
        </h1>

        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Auto-detect and mute swear words in any video. Local Whisper
          transcription, no upload, no account.
        </p>
      </section>

      <BleepConverter />

      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gradient">
          How it'll work
        </h2>
        <p className="mt-3 text-[var(--color-text-muted)]">
          Same architectural promise as the converter: nothing leaves your
          device.
        </p>
        <ol className="mt-8 grid gap-3 text-left">
          <Step n="1" title="Drop a video">
            Any format the converter already accepts (TS, MOV, MKV, WEBM,
            AVI, FLV, MPEG, MP4).
          </Step>
          <Step n="2" title="Audio extracted to PCM">
            ffmpeg.wasm pulls the audio track to 16 kHz mono — Whisper's
            input format. No upload.
          </Step>
          <Step n="3" title="On-device transcription">
            transformers.js runs Whisper-tiny in your browser. ~40 MB model,
            cached after first visit. Returns each word with a precise
            timestamp.
          </Step>
          <Step n="4" title="Profanity matched">
            Each word is checked against a curated wordlist (~400 terms).
            You can add custom words and toggle which ones to censor.
          </Step>
          <Step n="5" title="Mute pass">
            ffmpeg applies an audio filter that silences the flagged
            timestamp ranges. Video stream is copied unchanged — no
            re-encoding, no quality loss.
          </Step>
          <Step n="6" title="Download">
            Get a clean MP4 + a markdown log of every bleep with its
            timestamp.
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
