import type { Metadata } from "next";
import { AllToolsList } from "@/components/AllToolsList";
import { StructuredData } from "@/components/StructuredData";
import { breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Tools — ${SITE_NAME}`,
  description:
    "Local audio + video tools. Currently the Profanity Censor Tool: drop a video, on-device speech-to-text finds the swear words, ffmpeg mutes them. Runs on your device — free, no upload, no account.",
  alternates: { canonical: absoluteUrl("/tools") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/tools"),
    title: `Tools — ${SITE_NAME}`,
    description:
      "Local audio + video tools. Currently the Profanity Censor Tool.",
    siteName: SITE_NAME,
  },
};

export default function ToolsPage() {
  return (
    <>
      <StructuredData
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/tools" },
          ]),
        ]}
      />

      <section className="relative pt-12 sm:pt-20 pb-6 sm:pb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          On-device
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Tools
        </h1>

        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Local audio + video tools. Nothing leaves your device.
        </p>
      </section>

      <AllToolsList showHeading={false} only={["/bleep"]} />
    </>
  );
}
