import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/components/StructuredData";
import { breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { IMAGE_CONVERTERS } from "@/lib/image-converters";
import { IMAGE_FORMATS } from "@/lib/image-formats";

export const metadata: Metadata = {
  title: `Image Converter — Free, Private, No Upload · ${SITE_NAME}`,
  description:
    "Every image format converter on unethical tools, one page. Convert HEIC, AVIF, WEBP, PNG, or JPG between each other. Runs in your browser — no upload, no account, no quota.",
  alternates: { canonical: absoluteUrl("/image-converter") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/image-converter"),
    title: `Image Converter — ${SITE_NAME}`,
    description:
      "Convert HEIC, AVIF, WEBP, PNG, or JPG between each other. Runs in your browser.",
    siteName: SITE_NAME,
  },
};

export default function ImageConverterHubPage() {
  return (
    <>
      <StructuredData
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Image Converter", path: "/image-converter" },
          ]),
        ]}
      />

      <section className="relative pt-12 sm:pt-20 pb-6 sm:pb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          {IMAGE_CONVERTERS.length} conversions, all in your browser
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Image Converter
        </h1>

        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Pick a conversion. Same privacy guarantee as the rest of the site —
          your images never leave your device.
        </p>
      </section>

      <section
        id="image-converters"
        className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 sm:mt-16"
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {IMAGE_CONVERTERS.map((c) => {
            const inF = IMAGE_FORMATS[c.input];
            const outF = IMAGE_FORMATS[c.output];
            const tone =
              inF.losslessness === "lossless"
                ? { label: "From lossless", cls: "border-emerald-400/25 text-emerald-300/90" }
                : { label: "From lossy", cls: "border-amber-400/25 text-amber-300/90" };
            return (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}`}
                  className="group block h-full rounded-2xl glass p-5 transition-all hover:border-[var(--color-border-strong)] hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-white/[0.04] border border-[var(--color-border)] text-[var(--color-text)] font-mono text-[10px] leading-none">
                        .{inF.extensions[0]}
                      </span>
                      <span className="text-base font-medium tracking-tight text-[var(--color-text)] truncate">
                        {inF.displayName} → {outF.displayName}
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
