import type { Metadata } from "next";
import { DownloadHero } from "@/components/DownloadHero";
import { DownloadCards } from "@/components/DownloadCards";
import { DownloadInfo } from "@/components/DownloadInfo";
import { StructuredData } from "@/components/StructuredData";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { breadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: `Download — ${SITE_NAME} for macOS & Windows`,
  description:
    "Download the native macOS or Windows app for converting large video files locally. No 4 GB browser limit. Same private, no-upload conversion.",
  alternates: { canonical: absoluteUrl("/download") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/download"),
    title: `Download ${SITE_NAME}`,
    description:
      "Native macOS and Windows app for converting large video files locally. No 4 GB limit.",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `Download ${SITE_NAME}`,
    description:
      "Native macOS and Windows app for converting large video files locally.",
  },
};

export default function DownloadPage() {
  return (
    <>
      <StructuredData
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Download", path: "/download" },
        ])}
      />
      <DownloadHero />
      <DownloadCards />
      <DownloadInfo />
    </>
  );
}
