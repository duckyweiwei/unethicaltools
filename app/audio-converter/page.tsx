import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/components/StructuredData";
import { breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { AUDIO_CONVERTERS } from "@/lib/audio-converters";
import { AUDIO_FORMATS } from "@/lib/audio-formats";

export const metadata: Metadata = {
  title: `Audio Converter — Free, Private, No Upload · ${SITE_NAME}`,
  description:
    "Every audio format converter on unethical tools, one page. Convert WAV, FLAC, M4A, OGG, WMA, or AIFF to MP3. Runs in your browser — no upload, no account, no quota.",
  alternates: { canonical: absoluteUrl("/audio-converter") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/audio-converter"),
    title: `Audio Converter — ${SITE_NAME}`,
    description:
      "Convert WAV, FLAC, M4A, OGG, WMA, or AIFF to MP3. Runs in your browser.",
    siteName: SITE_NAME,
  },
};

export default function AudioConverterPage() {
  return (
    <>
      <StructuredData
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Audio Converter", path: "/audio-converter" },
          ]),
        ]}
      />

      <section className="relative pt-12 sm:pt-20 pb-6 sm:pb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          {AUDIO_CONVERTERS.length} formats, one MP3 target
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Audio Converter
        </h1>

        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Pick your input format. Same engine, same privacy guarantee — MP3
          conversion happens locally, no upload, no account.
        </p>
      </section>

      <section
        id="audio-converters"
        className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 sm:mt-16"
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {AUDIO_CONVERTERS.map((c) => {
            const f = AUDIO_FORMATS[c.input];
            const tone =
              f.losslessness === "lossless"
                ? { label: "Lossless source", cls: "border-emerald-400/25 text-emerald-300/90" }
                : { label: "Lossy source", cls: "border-amber-400/25 text-amber-300/90" };
            return (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}`}
                  className="group block h-full rounded-2xl glass p-5 transition-all hover:border-[var(--color-border-strong)] hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-white/[0.04] border border-[var(--color-border)] text-[var(--color-text)] font-mono text-[10px] leading-none">
                        .{f.extensions[0]}
                      </span>
                      <span className="text-base font-medium tracking-tight text-[var(--color-text)] truncate">
                        {f.displayName} → MP3
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border whitespace-nowrap ${tone.cls}`}
                    >
                      {tone.label}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
                    {c.tagline}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
                    Open
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
