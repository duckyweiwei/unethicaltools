import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormatHero } from "@/components/FormatHero";
import { VideoConverter } from "@/components/VideoConverter";
import { AudioConverter } from "@/components/AudioConverter";
import { FormatExplainer } from "@/components/FormatExplainer";
import { FAQ } from "@/components/FAQ";
import { RelatedConverters } from "@/components/RelatedConverters";
import { StructuredData } from "@/components/StructuredData";
import {
  CONVERTERS,
  getConverter,
  getRelatedConverters,
} from "@/lib/converters";
import {
  AUDIO_CONVERTERS,
  getAudioConverter,
  getRelatedAudioConverters,
  type AudioConverterConfig,
} from "@/lib/audio-converters";
import {
  IMAGE_CONVERTERS,
  getImageConverter,
  getRelatedImageConverters,
  type ImageConverterConfig,
} from "@/lib/image-converters";
import { FORMATS } from "@/lib/formats";
import { AUDIO_FORMATS } from "@/lib/audio-formats";
import { IMAGE_FORMATS } from "@/lib/image-formats";
import { ImageConverter } from "@/components/ImageConverter";
import {
  breadcrumbSchema,
  faqPageSchema,
  webApplicationSchema,
} from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/site";

/**
 * Single dynamic route handles both video (`*-to-mp4`) and audio
 * (`*-to-mp3`) converters. Static-params pulls from both registries so
 * the build pre-renders every slug.
 */
export function generateStaticParams() {
  return [
    ...CONVERTERS.map((c) => ({ converter: c.slug })),
    ...AUDIO_CONVERTERS.map((c) => ({ converter: c.slug })),
    ...IMAGE_CONVERTERS.map((c) => ({ converter: c.slug })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ converter: string }>;
}): Promise<Metadata> {
  const { converter } = await params;
  const config =
    getConverter(converter) ??
    getAudioConverter(converter) ??
    getImageConverter(converter);
  if (!config) return {};

  const url = absoluteUrl(`/${config.slug}`);
  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: config.title,
      description: config.description,
      siteName: "unethical tools",
    },
    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.description,
    },
  };
}

export default async function ConverterPage({
  params,
}: {
  params: Promise<{ converter: string }>;
}) {
  const { converter } = await params;
  const videoConfig = getConverter(converter);
  if (videoConfig) {
    const format = FORMATS[videoConfig.input];
    const related = getRelatedConverters(videoConfig.slug, 6);
    const jsonLd = [
      webApplicationSchema(videoConfig),
      faqPageSchema(videoConfig.faqs),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: `${format.displayName} → MP4`, path: `/${videoConfig.slug}` },
      ]),
    ];
    return (
      <>
        <StructuredData data={jsonLd} />
        <FormatHero config={videoConfig} />
        <VideoConverter inputFormat={format} />
        <FormatExplainer config={videoConfig} format={format} />
        <FAQ items={videoConfig.faqs} title={`${format.displayName} to MP4 — FAQ`} />
        <RelatedConverters items={related} />
      </>
    );
  }

  const audioConfig = getAudioConverter(converter);
  if (audioConfig) return <AudioConverterPage config={audioConfig} />;

  const imageConfig = getImageConverter(converter);
  if (imageConfig) return <ImageConverterPage config={imageConfig} />;

  notFound();
}

/**
 * Per-format audio page. Doesn't reuse FormatHero / FormatExplainer /
 * RelatedConverters yet — those are video-shaped. A simpler inline layout
 * keeps the audio family shippable today; we can promote to shared
 * components later once the audio catalog grows.
 */
function AudioConverterPage({ config }: { config: AudioConverterConfig }) {
  const format = AUDIO_FORMATS[config.input];
  const related = getRelatedAudioConverters(config.slug, 4);
  const jsonLd = [
    faqPageSchema(config.faqs),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Audio Converter", path: "/audio-converter" },
      { name: `${format.displayName} → MP3`, path: `/${config.slug}` },
    ]),
  ];

  return (
    <>
      <StructuredData data={jsonLd} />

      <section className="relative pt-12 sm:pt-20 pb-8 sm:pb-10 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-6 fade-in">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {format.losslessness === "lossless"
            ? "Lossless source · MP3 target"
            : "Lossy source · MP3 target"}
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          {config.h1}
        </h1>
        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          {config.tagline}
        </p>
      </section>

      <AudioConverter inputFormat={format} />

      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-16">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gradient text-center mb-6">
          Why convert {format.displayName} to MP3?
        </h2>
        <div className="space-y-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {config.whyConvertParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <FAQ items={config.faqs} title={`${format.displayName} to MP3 — FAQ`} />

      {related.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-16">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-gradient text-center mb-6">
            Other audio formats
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {related.map((r) => {
              const f = AUDIO_FORMATS[r.input];
              return (
                <li key={r.slug}>
                  <a
                    href={`/${r.slug}`}
                    className="block rounded-2xl glass p-4 transition-colors hover:border-[var(--color-border-strong)]"
                  >
                    <div className="text-sm font-medium tracking-tight text-[var(--color-text)]">
                      {f.displayName} → MP3
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)] line-clamp-2">
                      {r.tagline}
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * Per-format image converter page. Same minimal layout as audio — hero +
 * tool + why-paragraphs + FAQ + related-formats grid.
 */
function ImageConverterPage({ config }: { config: ImageConverterConfig }) {
  const inputFormat = IMAGE_FORMATS[config.input];
  const outputFormat = IMAGE_FORMATS[config.output];
  const outputMime = outputFormat.outputMime!;
  const related = getRelatedImageConverters(config.slug, 4);
  const jsonLd = [
    faqPageSchema(config.faqs),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Image Converter", path: "/image-converter" },
      { name: `${inputFormat.displayName} → ${outputFormat.displayName}`, path: `/${config.slug}` },
    ]),
  ];

  return (
    <>
      <StructuredData data={jsonLd} />

      <section className="relative pt-12 sm:pt-20 pb-8 sm:pb-10 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-6 fade-in">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {inputFormat.displayName} → {outputFormat.displayName} · in-browser
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          {config.h1}
        </h1>
        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          {config.tagline}
        </p>
      </section>

      <ImageConverter
        inputFormat={inputFormat}
        outputMime={outputMime}
        outputLabel={outputFormat.displayName}
      />

      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-16">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gradient text-center mb-6">
          Why convert {inputFormat.displayName} to {outputFormat.displayName}?
        </h2>
        <div className="space-y-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {config.whyConvertParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <FAQ items={config.faqs} title={`${inputFormat.displayName} to ${outputFormat.displayName} — FAQ`} />

      {related.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-16">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-gradient text-center mb-6">
            Other image conversions
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {related.map((r) => {
              const inF = IMAGE_FORMATS[r.input];
              const outF = IMAGE_FORMATS[r.output];
              return (
                <li key={r.slug}>
                  <a
                    href={`/${r.slug}`}
                    className="block rounded-2xl glass p-4 transition-colors hover:border-[var(--color-border-strong)]"
                  >
                    <div className="text-sm font-medium tracking-tight text-[var(--color-text)]">
                      {inF.displayName} → {outF.displayName}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)] line-clamp-2">
                      {r.tagline}
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
