import Link from "next/link";
import { FeatureBadges } from "./FeatureBadges";

/**
 * Landing-page hero. Drives users into the converter grid below — distinct
 * from FormatHero which appears above the converter on /[slug] pages.
 */
export function Hero() {
  return (
    <section className="relative pt-12 sm:pt-20 pb-10 sm:pb-14 text-center">
      <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="badge-web">100% client-side · ffmpeg.wasm</span>
        <span className="badge-desktop">Native ffmpeg · no size limit</span>
      </div>

      <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
        Local Video Converter
      </h1>

      <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
        Convert videos privately in your browser.{" "}
        <span className="text-[var(--color-text)]">
          Your files never leave your computer.
        </span>
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 fade-in">
        <FeatureBadges />
      </div>

      <div className="mt-8 flex justify-center fade-in">
        <Link
          href="#converters"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow"
        >
          Pick a format
          <ArrowDown />
        </Link>
      </div>
    </section>
  );
}

function ArrowDown() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}
