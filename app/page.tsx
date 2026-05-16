import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { BleepHub } from "@/components/BleepHub";
import { ConverterHub } from "@/components/ConverterHub";
import { InfoSection } from "@/components/InfoSection";
import { AboutBrand } from "@/components/AboutBrand";
import { StructuredData } from "@/components/StructuredData";
import { CONVERTERS } from "@/lib/converters";
import { FORMATS } from "@/lib/formats";
import { websiteSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

const formatList = CONVERTERS.map((c) => FORMATS[c.input].displayName).join(", ");

export const metadata: Metadata = {
  title: `${SITE_NAME} — Private Browser Video Converter (No Upload)`,
  description: `Convert ${formatList} to MP4 locally in your browser. No upload, no account, no watermark — files never leave your computer.`,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/"),
    title: `${SITE_NAME} — Private Browser Video Converter`,
    description: `Convert ${formatList} to MP4 locally in your browser.`,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Private Browser Video Converter`,
    description: `Convert ${formatList} to MP4 locally in your browser.`,
  },
};

export default function HomePage() {
  return (
    <>
      <StructuredData
        data={[
          websiteSchema(),
          breadcrumbSchema([{ name: "Home", path: "/" }]),
        ]}
      />
      <Hero />
      <BleepHub />
      <ConverterHub />
      <InfoSection />
      <AboutBrand />
    </>
  );
}
