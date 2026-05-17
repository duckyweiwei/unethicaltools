import type { Metadata } from "next";
import { AllToolsList } from "@/components/AllToolsList";
import { StructuredData } from "@/components/StructuredData";
import { breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { CONVERTERS } from "@/lib/converters";

export const metadata: Metadata = {
  title: `Video Converter — Free, Private, No Upload · ${SITE_NAME}`,
  description:
    "Every format converter on unethical tools, one page. Convert TS, MOV, MKV, WEBM, AVI, FLV, or MPEG to MP4. Runs in your browser — no upload, no account, no quota.",
  alternates: { canonical: absoluteUrl("/converters") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/converters"),
    title: `Video Converter — ${SITE_NAME}`,
    description:
      "Convert TS, MOV, MKV, WEBM, AVI, FLV, or MPEG to MP4. Runs in your browser.",
    siteName: SITE_NAME,
  },
};

const CONVERTER_HREFS = CONVERTERS.map((c) => `/${c.slug}`);

export default function ConvertersPage() {
  return (
    <>
      <StructuredData
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Video Converter", path: "/converters" },
          ]),
        ]}
      />

      <section className="relative pt-12 sm:pt-20 pb-6 sm:pb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          {CONVERTERS.length} formats, one engine
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Video Converter
        </h1>

        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Pick your input format. Same engine, same privacy guarantee — MP4
          conversion happens locally with no upload.
        </p>
      </section>

      <AllToolsList showHeading={false} only={CONVERTER_HREFS} />
    </>
  );
}
