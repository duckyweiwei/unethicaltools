import type { Metadata } from "next";
import { AnalyticsGate } from "@/components/shell/AnalyticsGate";
import { Providers } from "@/components/shell/Providers";
import "./globals.css";

const DESCRIPTION =
  "Upload a multiple-choice PDF and get an interactive quiz of the exact same questions — extracted deterministically, never rewritten by a model.";

export const metadata: Metadata = {
  metadataBase: new URL("https://unethicaltools.com"),
  title: {
    default: "unethicaltools — your PDF practice test, now a clickable quiz",
    template: "%s · unethicaltools",
  },
  description: DESCRIPTION,
  applicationName: "unethicaltools",
  openGraph: {
    type: "website",
    url: "https://unethicaltools.com",
    siteName: "unethicaltools",
    title: "Your PDF practice test, now a quiz you can click through",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Your PDF practice test, now a quiz you can click through",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <Providers>{children}</Providers>
        <AnalyticsGate />
      </body>
    </html>
  );
}
