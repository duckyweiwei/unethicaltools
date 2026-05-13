import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/components/StructuredData";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { breadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: `About — ${SITE_NAME}`,
  description:
    "unethicaletools makes small utilities that run on your device. No accounts, no uploads, no telemetry, no subscriptions. Software that respects you — by architecture, not by promise.",
  alternates: { canonical: absoluteUrl("/about") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/about"),
    title: `About ${SITE_NAME}`,
    description:
      "Software that respects you — by architecture, not by promise. No accounts, no uploads, no tracking.",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title: `About ${SITE_NAME}`,
    description:
      "Software that respects you — by architecture, not by promise.",
  },
};

const CONTRASTS: Array<{ norm: string; us: string }> = [
  {
    norm: "Account required to use the free tier",
    us: "No account, ever — there's nothing to sign up for",
  },
  {
    norm: "File uploaded to a server for processing",
    us: "File never leaves your device. The conversion runs in your browser via WebAssembly",
  },
  {
    norm: "Analytics on what you do with the tool",
    us: "Zero analytics on your file activity — we don't know what you converted",
  },
  {
    norm: "Subscription with feature gates",
    us: "Free tier is the only tier — no paywall, no Pro upsell",
  },
  {
    norm: "\"Sign up to download your result\"",
    us: "Convert → download. No friction between you and your file",
  },
  {
    norm: "Cookie consent banners + 30-minute privacy policies",
    us: "No cookies, no consent forms — nothing to disclose because nothing is collected",
  },
  {
    norm: "Watermarks on free output",
    us: "Output is bit-perfect (remux) or visually lossless (encode)",
  },
];

export default function AboutPage() {
  return (
    <>
      <StructuredData
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />

      <section className="relative pt-12 sm:pt-20 pb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          The brand, briefly
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          What is unethicaletools?
        </h1>
        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Software that respects you — by architecture, not by promise.
        </p>
      </section>

      {/* The pitch */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-12">
        <div className="glass rounded-3xl p-6 sm:p-8 space-y-4 text-[var(--color-text-muted)] leading-relaxed">
          <p>
            <span className="text-[var(--color-text)] font-medium">
              unethicaletools
            </span>{" "}
            is a small catalog of utility software that runs on your device.
            No accounts. No uploads. No subscriptions. No telemetry. No
            dark patterns. The video converter on this site is the first one.
          </p>
          <p>
            The name is deliberate. By every conventional SaaS metric — engagement,
            retention, conversion, data capture — these tools are{" "}
            <span className="text-[var(--color-text)]">unethical</span>:
          </p>
          <ul className="pl-1 space-y-1.5">
            <Bullet>They make no money from you.</Bullet>
            <Bullet>They don't get to study your behavior.</Bullet>
            <Bullet>They don't compound engagement over time.</Bullet>
            <Bullet>They don't lock you into anything.</Bullet>
          </ul>
          <p>
            From inside any growth-focused product team, that's a terrible
            business. From your perspective — the person actually using the
            tool — it's fine. Better than fine. It's how software is supposed
            to work.
          </p>
        </div>
      </section>

      {/* What this means concretely */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-16 sm:mt-20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
            In practice
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
            What changes when you don't optimize for capture
          </h2>
        </div>

        <ul className="space-y-2">
          {CONTRASTS.map((row, i) => (
            <li
              key={i}
              className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-start rounded-2xl glass p-4 sm:p-5"
            >
              <div className="text-sm text-[var(--color-text-muted)]">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-1">
                  Industry norm
                </div>
                {row.norm}
              </div>
              <div className="hidden sm:flex items-center justify-center text-[var(--color-text-dim)]">
                →
              </div>
              <div className="text-sm text-[var(--color-text)]">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-mono mb-1">
                  What we do
                </div>
                {row.us}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Catalog */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-16 sm:mt-20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
            What's shipping
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
            The catalog
          </h2>
        </div>

        <div className="glass rounded-3xl p-6 sm:p-7 mb-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-base font-medium tracking-tight text-[var(--color-text)]">
              Local Video Converter
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-400/30 text-emerald-300/90">
              live
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            TS · MOV · MKV · WEBM · AVI · FLV · MPEG → MP4. Runs fully
            in-browser via{" "}
            <a
              href="https://ffmpegwasm.netlify.app/"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-text)] hover:underline"
            >
              ffmpeg.wasm
            </a>
            . A native macOS / Windows app exists for files over the browser's
            4&nbsp;GB memory ceiling.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/"
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors"
            >
              Use the converter
            </Link>
            <Link
              href="/download"
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Desktop app
            </Link>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 sm:p-7 opacity-70">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-base font-medium tracking-tight text-[var(--color-text-muted)]">
              More tools, same architecture
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-dim)]">
              coming
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            We're picking the next ones based on what people ask for on the
            suggestions page. If there's a utility you keep ending up using
            some sketchy web tool for — tell us.
          </p>
          <div className="mt-4">
            <Link
              href="/suggestions"
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors inline-flex"
            >
              Suggest a tool →
            </Link>
          </div>
        </div>
      </section>

      {/* Verify, don't trust */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-16 sm:mt-20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
            Don't trust us
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
            Verify it yourself
          </h2>
        </div>

        <div className="glass rounded-3xl p-6 sm:p-8 space-y-4 text-[var(--color-text-muted)] leading-relaxed">
          <p>
            The whole point of architecture-based privacy is that you don't
            have to take anyone's word for anything. Here's how to confirm
            the no-upload claim takes about 30 seconds:
          </p>
          <ol className="space-y-2.5 pl-5 list-decimal">
            <li>Open this site in Chrome.</li>
            <li>Hit{" "}
              <code className="font-mono text-[var(--color-text)]">
                ⌥⌘I
              </code>{" "}
              (Mac) /{" "}
              <code className="font-mono text-[var(--color-text)]">
                F12
              </code>{" "}
              (Windows) → Network tab.
            </li>
            <li>Pick a video and convert it.</li>
            <li>
              The only requests you'll see are: the page load and a one-time
              download of the ffmpeg.wasm engine (~30 MB, cached after the
              first time). Your file never appears in the Network tab,
              because it's never sent.
            </li>
          </ol>
          <p>
            If that ever changes, you'd see it the same way — in the Network
            tab. That's what we mean by architecture vs. policy.
          </p>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-16 sm:mt-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gradient">
          That's it. Go convert something.
        </h2>
        <div className="mt-6 inline-flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow"
          >
            See the converters
          </Link>
          <Link
            href="/suggestions"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            Suggest the next tool
          </Link>
        </div>
      </section>
    </>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-2 h-1 w-1 rounded-full bg-[var(--color-accent)] shrink-0" />
      <span>{children}</span>
    </li>
  );
}
