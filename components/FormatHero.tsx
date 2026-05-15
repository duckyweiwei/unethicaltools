import { FeatureBadges } from "./FeatureBadges";
import { DeviceMemoryStat } from "./DeviceMemoryStat";
import type { ConverterConfig } from "@/lib/converters";
import { FORMATS } from "@/lib/formats";

/**
 * Per-format hero. Same visual treatment as the original Hero, but reads its
 * content from the ConverterConfig so each /[slug] page has unique copy.
 *
 * Shows the typical 1 GB conversion time inline so a user landing on this
 * page knows what to expect before dropping a file. FilePreview later
 * tailors that estimate to the user's actual file size.
 */
export function FormatHero({ config }: { config: ConverterConfig }) {
  const format = FORMATS[config.input];
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

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
        {config.h1}
      </h1>

      <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
        {config.tagline}
      </p>

      <div
        className="mt-5 inline-flex items-center gap-2 text-xs font-mono text-[var(--color-text-dim)] fade-in"
        title="Estimated time to convert a 1 GB file in a browser tab (single-thread ffmpeg.wasm)"
      >
        <ClockIcon />
        <span>
          Typical for 1 GB:{" "}
          <span className="text-[var(--color-text-muted)]">
            <span className="badge-web">{format.typical1GBTime.browser}</span>
            <span className="badge-desktop">{format.typical1GBTime.desktop}</span>
          </span>
        </span>
      </div>

      {/* Per-device max-file-size hint, populated from navigator.deviceMemory.
        * Mounts client-side after hydration, hidden in the Tauri app. */}
      <div className="block">
        <DeviceMemoryStat />
      </div>

      <div className="mt-8 flex justify-center fade-in">
        <FeatureBadges />
      </div>
    </section>
  );
}

function ClockIcon() {
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
      className="opacity-60"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
