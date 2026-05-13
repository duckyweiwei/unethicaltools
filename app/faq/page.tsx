import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/components/FAQ";
import { StructuredData } from "@/components/StructuredData";
import { CONVERTERS, SHARED_FAQS } from "@/lib/converters";
import { FORMATS } from "@/lib/formats";
import {
  breadcrumbSchema,
  faqPageSchema,
} from "@/lib/structured-data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `FAQ — ${SITE_NAME}`,
  description:
    "Frequently asked questions about local browser video conversion. How privacy works, why some files convert instantly while others re-encode, file size limits, mobile support, and more.",
  alternates: { canonical: absoluteUrl("/faq") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/faq"),
    title: `FAQ — ${SITE_NAME}`,
    description:
      "Frequently asked questions about private, local video conversion in your browser.",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title: `FAQ — ${SITE_NAME}`,
    description:
      "Frequently asked questions about private, local video conversion in your browser.",
  },
};

export default function FaqPage() {
  return (
    <>
      <StructuredData
        data={[
          faqPageSchema(SHARED_FAQS),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
        ]}
      />

      <section className="relative pt-12 sm:pt-20 pb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          Questions & answers
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Frequently asked questions
        </h1>
        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          About local conversion in general. For codec-specific quirks of a
          single format, jump to that converter's own FAQ below.
        </p>
      </section>

      {/* Shared FAQs apply to every converter */}
      <FAQ items={SHARED_FAQS} title="About local conversion" />

      {/* Per-format FAQ index — anchor links into each converter page's FAQ */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-20 sm:mt-28">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
            Format-specific
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
            Per-format details
          </h2>
          <p className="mt-3 mx-auto max-w-2xl text-[var(--color-text-muted)]">
            Each format has its own quirks — codecs, bitstream filters, what
            survives a remux. Pick one to read the format-specific FAQ.
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {CONVERTERS.map((c) => {
            const f = FORMATS[c.input];
            return (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}`}
                  className="group block rounded-2xl glass p-5 transition-colors hover:border-[var(--color-border-strong)]"
                >
                  <div className="text-sm font-medium tracking-tight text-[var(--color-text)] mb-1">
                    {f.displayName}{" "}
                    <span className="text-[var(--color-text-dim)]">→</span>{" "}
                    MP4 FAQ
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {c.faqs.length} questions — codec quirks, common issues,
                    what to expect.
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
                    Open FAQ
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
