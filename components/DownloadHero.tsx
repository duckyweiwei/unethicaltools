import { FeatureBadges } from "./FeatureBadges";

/**
 * Hero for /download. Distinct from FormatHero — leads with the desktop
 * value prop (no size limit, native ffmpeg) rather than format-specific copy.
 */
export function DownloadHero() {
  return (
    <section className="relative pt-12 sm:pt-20 pb-10 sm:pb-14 text-center">
      <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-7 fade-in">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Native app · macOS · Windows
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.05] fade-in">
        Same converter. Any file size.
      </h1>

      <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-text-muted)] fade-in">
        Install the desktop app when your file is larger than the browser&apos;s
        4&nbsp;GB memory limit. Uses native ffmpeg — your files still never
        leave your computer.
      </p>

      <div className="mt-8 flex justify-center fade-in">
        <FeatureBadges />
      </div>
    </section>
  );
}
