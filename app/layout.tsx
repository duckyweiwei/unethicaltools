import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL, TWITTER_HANDLE } from "@/lib/site";
import { DesktopBodyClass } from "@/components/DesktopBodyClass";
import { DesktopShell } from "@/components/DesktopShell";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";
import { WebAnalytics } from "@/components/WebAnalytics";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Private Browser Video Converter (No Upload)`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Convert video to MP4 locally in your browser. No upload, no sign up, no watermark. Your files never leave your computer.",
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  keywords: [
    "video converter",
    "no upload",
    "private converter",
    "browser converter",
    "local conversion",
    "ffmpeg wasm",
    "convert to mp4",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Private Browser Video Converter`,
    description:
      "Convert video to MP4 locally in your browser. Files never leave your computer.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Private Browser Video Converter`,
    description:
      "Convert video to MP4 locally in your browser. Files never leave your computer.",
    ...(TWITTER_HANDLE ? { creator: TWITTER_HANDLE, site: TWITTER_HANDLE } : {}),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <DesktopBodyClass />
        {/*
         * Dual-render: the website tree and the desktop app are both mounted
         * on every route. CSS toggles which one is visible via body.desktop —
         * set at runtime by DesktopBodyClass when inside Tauri.
         *
         * Website chrome (background, nav, footer) lives here in the layout
         * so it persists across route navigations — only the page content
         * inside PageTransition unmounts + fades when the user changes tabs.
         * Each individual page returns just its sections (no nav/footer).
         */}
        <div className="web-only">
          <AnimatedBackground />
          <SiteNav />
          <main className="relative min-h-screen w-full">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </div>
        <div className="desktop-only">
          <DesktopShell />
        </div>
        {/*
         * Vercel Web Analytics. Privacy-friendly (no cookies, no fingerprint),
         * aggregate-only — fits the brand. The component itself short-circuits
         * inside the Tauri webview so desktop users aren't counted.
         */}
        <WebAnalytics />
      </body>
    </html>
  );
}
