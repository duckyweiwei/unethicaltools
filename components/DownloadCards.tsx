"use client";

/**
 * Per-platform download cards. The actual installer URLs are wired up at
 * build time once the Tauri build artifacts are uploaded to a release host
 * (GitHub Releases, S3, etc.). Until then, the buttons surface a clear
 * "coming soon" state instead of dead links.
 */

interface BuildLinks {
  macUniversal?: string; // .dmg
  windowsX64?: string; // .msi or .exe
}

const BUILD_LINKS: BuildLinks = {
  // TODO: replace with real release URLs after first Tauri build is published.
};

export function DownloadCards() {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-8">
      <ul className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <PlatformCard
          platform="macOS"
          subtitle="11 Big Sur or newer · Universal (Apple Silicon + Intel)"
          icon={<AppleIcon />}
          href={BUILD_LINKS.macUniversal}
          fileLabel="LocalVideoConverter.dmg"
        />
        <PlatformCard
          platform="Windows"
          subtitle="Windows 10 or 11 · 64-bit"
          icon={<WindowsIcon />}
          href={BUILD_LINKS.windowsX64}
          fileLabel="LocalVideoConverter-Setup.msi"
        />
      </ul>
    </section>
  );
}

function PlatformCard({
  platform,
  subtitle,
  icon,
  href,
  fileLabel,
}: {
  platform: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  fileLabel: string;
}) {
  const available = Boolean(href);
  return (
    <li className="rounded-3xl glass p-6 sm:p-8 flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-white/[0.04] border border-[var(--color-border)] text-[var(--color-text)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-medium tracking-tight">{platform}</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm text-[var(--color-text-muted)] mb-6">
        <li className="flex items-start gap-2">
          <Check />
          <span>Native ffmpeg — no 4 GB memory limit</span>
        </li>
        <li className="flex items-start gap-2">
          <Check />
          <span>Multi-core encoding (much faster than browser WASM)</span>
        </li>
        <li className="flex items-start gap-2">
          <Check />
          <span>Native file open / save dialogs</span>
        </li>
        <li className="flex items-start gap-2">
          <Check />
          <span>Same private, local-only conversion</span>
        </li>
      </ul>

      <div className="mt-auto">
        {available ? (
          <a
            href={href}
            className="group inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow"
          >
            <DownloadIcon />
            Download for {platform}
          </a>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled
              aria-disabled
              className="inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-[var(--color-text-muted)] border border-[var(--color-border)] bg-white/[0.02] cursor-not-allowed"
            >
              Build pending
            </button>
            <p className="text-[10px] text-[var(--color-text-dim)] text-center font-mono">
              {fileLabel}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

function AppleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.45L9.9 2.1V11.65H0V3.45zm11.1 1.55L24 3.21V11.65H11.1V5zM0 12.85h9.9V22.4L0 21.05V12.85zm11.1 0H24V20.8L11.1 22.4V12.85z" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-1 text-emerald-300/80 shrink-0"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
