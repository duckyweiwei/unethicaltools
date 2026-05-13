/**
 * JSON-LD builders for schema.org structured data. Each function returns a
 * plain object that should be serialized into a <script type="application/ld+json">
 * tag. Rendering happens in components/StructuredData.tsx.
 *
 * Schema coverage:
 *  - WebApplication       — for each converter page (Google "Software App" cards)
 *  - FAQPage              — for each FAQ section (FAQ-rich result)
 *  - BreadcrumbList       — for site navigation breadcrumbs
 *  - WebSite + SearchAction — for the homepage (sitelinks search box)
 */

import type { ConverterConfig, FAQ } from "./converters";
import { SITE_NAME, SITE_URL, absoluteUrl } from "./site";

export type JsonLd = Record<string, unknown>;

export function webApplicationSchema(config: ConverterConfig): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: config.h1,
    url: absoluteUrl(`/${config.slug}`),
    description: config.description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (browser-based)",
    browserRequirements: "Requires JavaScript and WebAssembly. Chrome recommended.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "No Upload — files never leave your device",
      "Private Processing — runs entirely in your browser via ffmpeg.wasm",
      "Fast Conversion — instant remux when codecs allow, encode fallback otherwise",
      "No Sign Up — no account, no email collection, no watermark",
      "Lossless remuxing for compatible codecs (H.264 + AAC)",
      "H.264 + AAC re-encode fallback for unsupported codecs",
      "Real-time progress and ETA",
      "Drag-and-drop interface",
    ],
  };
}

export function faqPageSchema(faqs: FAQ[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

export function breadcrumbSchema(
  items: Array<{ name: string; path: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function websiteSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}
