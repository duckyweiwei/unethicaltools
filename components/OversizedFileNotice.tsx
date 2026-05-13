"use client";

import Link from "next/link";
import { formatBytes } from "@/lib/format";
import type { FormatConfig } from "@/lib/formats";

export interface OversizedFileNoticeProps {
  file: File;
  format: FormatConfig;
  onClear: () => void;
  /**
   * Hard ceiling — files at-or-above this size will crash the browser tab
   * (32-bit WASM addressing limit). Default 4 GB.
   */
  hardLimitBytes?: number;
}

const FOUR_GB = 4 * 1024 ** 3;

/**
 * Shown in place of FilePreview when the file is bigger than what ffmpeg.wasm
 * can address (4 GB hard ceiling). The browser path would either throw a
 * RangeError on File.arrayBuffer() or, more commonly, crash the tab outright
 * — neither is a good outcome. Direct the user to the desktop app instead.
 */
export function OversizedFileNotice({
  file,
  format,
  onClear,
  hardLimitBytes = FOUR_GB,
}: OversizedFileNoticeProps) {
  const overBy = file.size - hardLimitBytes;
  return (
    <div className="glass rounded-3xl p-6 sm:p-8 border-amber-400/20 fade-in">
      <div className="flex items-start gap-5">
        <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/30">
          <WarnIcon />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-amber-300/90 font-mono">
              Too large for browser conversion
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-300/90">
              {formatBytes(file.size)}
            </span>
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            This file is bigger than the browser&apos;s memory limit
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
            {file.name} is{" "}
            <span className="text-[var(--color-text)] font-medium">
              {formatBytes(file.size)}
            </span>
            , which is{" "}
            <span className="text-amber-300/90">
              {formatBytes(overBy)} over the 4 GB ceiling
            </span>{" "}
            that ffmpeg.wasm can address. Trying to convert it here will almost
            certainly crash this tab — you&apos;ll lose any state and won&apos;t
            get an MP4.
          </p>
          <p className="mt-3 text-sm text-[var(--color-text-muted)] leading-relaxed">
            The desktop app uses{" "}
            <span className="text-[var(--color-text)]">native ffmpeg</span>{" "}
            instead of WebAssembly, so it has{" "}
            <span className="text-[var(--color-text)]">no addressing limit</span>{" "}
            and your file still never leaves your machine.
          </p>

          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
              Why this happens
            </div>
            <ul className="space-y-1.5 text-xs text-[var(--color-text-muted)]">
              <li className="flex gap-2">
                <Dot />
                <span>
                  ffmpeg.wasm runs in a 32-bit WebAssembly module — total
                  addressable memory is capped at 4 GB.
                </span>
              </li>
              <li className="flex gap-2">
                <Dot />
                <span>
                  Your file ({format.displayName}) needs to live in that memory
                  alongside the output and ffmpeg&apos;s working buffers.
                </span>
              </li>
              <li className="flex gap-2">
                <Dot />
                <span>
                  Even if it loaded, Chrome would likely OOM-kill the tab before
                  the conversion completes.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
        <button
          type="button"
          onClick={onClear}
          className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          Choose smaller file
        </button>
        <Link
          href="/download"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow"
        >
          <DownloadIcon />
          <span>Install desktop app (no size limit)</span>
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

function WarnIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-300"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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
