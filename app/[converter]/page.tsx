import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormatHero } from "@/components/FormatHero";
import { VideoConverter } from "@/components/VideoConverter";
import { FormatExplainer } from "@/components/FormatExplainer";
import { FAQ } from "@/components/FAQ";
import { RelatedConverters } from "@/components/RelatedConverters";
import { StructuredData } from "@/components/StructuredData";
import {
  CONVERTERS,
  getConverter,
  getRelatedConverters,
} from "@/lib/converters";
import { FORMATS } from "@/lib/formats";
import {
  breadcrumbSchema,
  faqPageSchema,
  webApplicationSchema,
} from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/site";

/**
 * Pre-render every converter at build time. Adding a new entry to
 * lib/converters.ts is enough to ship a new SEO page — no code changes here.
 */
export function generateStaticParams() {
  return CONVERTERS.map((c) => ({ converter: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ converter: string }>;
}): Promise<Metadata> {
  const { converter } = await params;
  const config = getConverter(converter);
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
      siteName: "Local Video Converter",
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
  const config = getConverter(converter);
  if (!config) notFound();

  const format = FORMATS[config.input];
  const related = getRelatedConverters(config.slug, 6);

  const jsonLd = [
    webApplicationSchema(config),
    faqPageSchema(config.faqs),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: `${format.displayName} → MP4`, path: `/${config.slug}` },
    ]),
  ];

  return (
    <>
      <StructuredData data={jsonLd} />
      <FormatHero config={config} />
      <VideoConverter inputFormat={format} />
      <FormatExplainer config={config} format={format} />
      <FAQ items={config.faqs} title={`${format.displayName} to MP4 — FAQ`} />
      <RelatedConverters items={related} />
    </>
  );
}
