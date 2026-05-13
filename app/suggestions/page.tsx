import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/components/StructuredData";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { breadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: `Suggestions & Feedback — ${SITE_NAME}`,
  description:
    "Suggest a new format, report a bug, or share an idea. Privacy-first: submissions go through your own mail app — nothing is sent to any server from this page.",
  alternates: { canonical: absoluteUrl("/suggestions") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/suggestions"),
    title: `Suggestions — ${SITE_NAME}`,
    description:
      "Suggest a new format, report a bug, or share an idea. Sent via your own mail app — no server in the middle.",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title: `Suggestions — ${SITE_NAME}`,
    description: "Share a format request, bug report, or feature idea.",
  },
  // This page is intentionally light on SEO weight (no FAQ schema, low
  // crawl priority in the sitemap) — it exists for users who already
  // landed on the site, not as an organic search target.
  robots: { index: true, follow: true },
};

export default function SuggestionsPage() {
  return (
    <>
      <StructuredData
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Suggestions", path: "/suggestions" },
        ])}
      />

      <section className="relative pt-12 sm:pt-20 pb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
          <SparkleIcon />
          Help shape the next version
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
          Suggestions & feedback
        </h1>
        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
          Need a format we don't support yet? Hit a bug? Got an idea that would
          make this less painful?{" "}
          <span className="text-[var(--color-text)]">
            We read every submission.
          </span>
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-4 sm:px-6">
        <SuggestionsPanel />
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-20 sm:mt-28">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
            How submissions are handled
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
            No server, no tracking, no account
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
          <InfoCard
            title="Opens your mail app"
            body="Hitting Submit composes a mailto: link with everything pre-filled. Your mail client takes over from there — we don't see the message until you press Send."
            icon={<MailIcon />}
          />
          <InfoCard
            title="Nothing is stored here"
            body="This page has no form-handling endpoint. There's no Formspree, no analytics, no server-side logging of what you typed."
            icon={<ShieldIcon />}
          />
          <InfoCard
            title="What we look for first"
            body="Concrete format requests (input + output), reproducible bugs with a sample-file description, and feature ideas with the use-case behind them."
            icon={<EyeIcon />}
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-20 sm:mt-28 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gradient">
          Already have a specific format in mind?
        </h2>
        <p className="mt-3 text-[var(--color-text-muted)]">
          Browse what's supported today — your request might already be live.
        </p>
        <div className="mt-6 inline-flex">
          <Link
            href="/#converters"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow"
          >
            See all converters
          </Link>
        </div>
      </section>

    </>
  );
}

function InfoCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl glass p-6">
      <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/[0.04] border border-[var(--color-border)] mb-4 text-[var(--color-text)]">
        {icon}
      </div>
      <h3 className="text-base font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function SparkleIcon() {
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
      className="text-amber-300"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
