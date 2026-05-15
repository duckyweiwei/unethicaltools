"use client";

import Link from "next/link";
import { formatBytes } from "@/lib/format";
import type { FormatConfig } from "@/lib/formats";

export interface MemoryErrorViewProps {
  file: File;
  format: FormatConfig;
  rawError: string;
  onReset: () => void;
  onRetry: () => void;
}

/**
 * Shown when ffmpeg conversion fails with a memory-allocation error at
 * runtime — distinct from the OversizedFileNotice that fires preflight at
 * the 4 GB hard ceiling. This case is "your file is large enough that THIS
 * browser session can't allocate memory for it right now" rather than "this
 * file physically can't fit in the WASM address space."
 *
 * The fix is the same (desktop app), but the diagnosis is different — the
 * user can sometimes retry successfully after closing other browser tabs.
 */
export function MemoryErrorView({
  file,
  format,
  rawError,
  onReset,
  onRetry,
}: MemoryErrorViewProps) {
  return (
    <div className="glass rounded-3xl p-6 sm:p-8 border-amber-400/20 fade-in">
      <div className="flex items-start gap-5">
        <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/30">
          <MemIcon />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-amber-300/90 font-mono">
              Browser ran out of memory
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-300/90">
              {formatBytes(file.size)} · {format.displayName}
            </span>
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            Your browser couldn&apos;t allocate enough memory for this file
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
            This usually happens with files larger than ~1–1.5 GB when other
            tabs or apps are using significant RAM. ffmpeg.wasm runs in a
            32-bit memory space — it can&apos;t grow past what your browser
            session has available.
          </p>

          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
              Things you can try (fastest fix first)
            </div>
            <ul className="space-y-1.5 text-xs text-[var(--color-text-muted)]">
              <li className="flex gap-2">
                <Dot />
                <span>
                  <span className="text-[var(--color-text)]">
                    Install the desktop app
                  </span>{" "}
                  — uses native ffmpeg with no memory limit. Most reliable for
                  files this size.
                </span>
              </li>
              <li className="flex gap-2">
                <Dot />
                <span>
                  Close other browser tabs (especially video calls, Figma,
                  large web apps) and retry. Frees up RAM the browser can hand
                  to this tab.
                </span>
              </li>
              <li className="flex gap-2">
                <Dot />
                <span>
                  Try a shorter clip — split with a quick app like{" "}
                  <code className="font-mono text-[var(--color-text)]">
                    ffmpeg
                  </code>
                  ,{" "}
                  <a
                    href="https://lossless-cut.dev/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-text)] hover:underline"
                  >
                    LosslessCut
                  </a>
                  , or QuickTime, then convert each part.
                </span>
              </li>
            </ul>
          </div>

          <details className="mt-3">
            <summary className="text-[11px] text-[var(--color-text-dim)] cursor-pointer hover:text-[var(--color-text-muted)] transition-colors">
              Technical details
            </summary>
            <p className="mt-2 text-[11px] font-mono text-[var(--color-text-dim)] break-words">
              {rawError}
            </p>
          </details>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          Choose smaller file
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors"
        >
          Retry
        </button>
        <Link
          href="/download"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow"
        >
          <DownloadIcon />
          <span>Get the desktop app</span>
        </Link>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-300/60 shrink-0" />
  );
}

function MemIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-300"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
      <rect x="8" y="8" width="8" height="8" />
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
