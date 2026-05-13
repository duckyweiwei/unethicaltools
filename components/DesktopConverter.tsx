"use client";

import Link from "next/link";
import { FORMATS } from "@/lib/formats";
import type { ConverterConfig } from "@/lib/converters";
import { VideoConverter } from "./VideoConverter";

/**
 * Per-format desktop screen. Shown when the user navigates from DesktopHub
 * to /<slug>. No SEO copy, no FAQ, no related links — just a back button,
 * a format header, and the shared VideoConverter UI.
 */
export function DesktopConverter({ config }: { config: ConverterConfig }) {
  const format = FORMATS[config.input];
  const tone =
    format.remuxLikelihood === "high"
      ? { label: "Instant remux", cls: "text-emerald-300/90 border-emerald-400/25" }
      : format.remuxLikelihood === "medium"
        ? { label: "Mixed", cls: "text-cyan-300/90 border-cyan-400/25" }
        : { label: "Re-encodes", cls: "text-amber-300/90 border-amber-400/25" };

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-3 px-6 py-3 border-b border-[var(--color-border)]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <BackIcon />
          All converters
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tracking-tight">
            {format.displayName} → MP4
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${tone.cls}`}
          >
            {tone.label}
          </span>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-text-dim)]">
          Native
        </span>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Convert {format.displayName} to MP4
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {config.remuxOutlook}
            </p>
            <div
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-dim)]"
              title="Typical conversion time for a 1 GB file with native ffmpeg"
            >
              <ClockIcon />
              <span>
                Typical for 1 GB:{" "}
                <span className="text-[var(--color-text-muted)]">
                  {format.typical1GBTime.desktop}
                </span>
              </span>
            </div>
          </div>

          <VideoConverter inputFormat={format} />
        </div>
      </section>
    </main>
  );
}

function BackIcon() {
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
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-60"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
