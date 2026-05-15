"use client";

import { useEffect, useState } from "react";
import { formatBytes, estimateConversionTime } from "@/lib/format";
import type { FormatConfig } from "@/lib/formats";
import { isDesktop } from "@/lib/desktop-bridge";
import {
  canAllocateForFile,
  estimateMaxFileSizeBytes,
  shouldProbe,
} from "@/lib/memory";

/**
 * Per-GB conversion-time priors used by estimateConversionTime() in
 * FilePreview to tailor an estimate to the user's actual file. These mirror
 * the per-format `typical1GBTime` strings but in numeric form so they can be
 * scaled with the file size. Remux paths are roughly constant (I/O bound),
 * so we just return the underlying typical range — the helper handles
 * unit normalization (s → min → hr).
 */
const PER_GB: Record<
  FormatConfig["id"],
  { browser: { min: number; max: number; unit: "s" | "min" }; desktop: { min: number; max: number; unit: "s" | "min" } }
> = {
  ts:   { browser: { min: 10, max: 30, unit: "s" }, desktop: { min: 5, max: 15, unit: "s" } },
  mov:  { browser: { min: 10, max: 30, unit: "s" }, desktop: { min: 5, max: 15, unit: "s" } },
  mkv:  { browser: { min: 10, max: 30, unit: "s" }, desktop: { min: 5, max: 15, unit: "s" } },
  flv:  { browser: { min: 10, max: 30, unit: "s" }, desktop: { min: 5, max: 15, unit: "s" } },
  mp4:  { browser: { min: 10, max: 30, unit: "s" }, desktop: { min: 5, max: 15, unit: "s" } },
  webm: { browser: { min: 15, max: 90, unit: "min" }, desktop: { min: 2, max: 15, unit: "min" } },
  avi:  { browser: { min: 10, max: 40, unit: "min" }, desktop: { min: 2, max: 8, unit: "min" } },
  mpeg: { browser: { min: 10, max: 25, unit: "min" }, desktop: { min: 2, max: 5, unit: "min" } },
};

export interface FilePreviewProps {
  file: File;
  /** Format actually detected on the file (drives codec expectations). */
  format: FormatConfig;
  /** Format the user originally landed on. Used for cross-format notices. */
  pageFormat: FormatConfig;
  onClear: () => void;
  onConvert: () => void;
  disabled?: boolean;
}

const REMUX_HINT: Record<FormatConfig["remuxLikelihood"], string> = {
  high: "Likely instant remux — original quality preserved.",
  medium: "May remux instantly. Falls back to re-encode if codecs aren't MP4-compatible.",
  none: "Will re-encode (codecs incompatible with MP4). Expect minutes, not seconds.",
};

export function FilePreview({
  file,
  format,
  pageFormat,
  onClear,
  onConvert,
  disabled,
}: FilePreviewProps) {
  const lastModified = file.lastModified
    ? new Date(file.lastModified).toLocaleString()
    : "—";
  const tooBig = file.size > 2 * 1024 ** 3;
  const crossFormat = format.id !== pageFormat.id;

  const perGB = PER_GB[format.id];
  const eta = perGB
    ? estimateConversionTime(
        file.size,
        isDesktop() ? perGB.desktop : perGB.browser,
      )
    : null;

  /**
   * Memory probe — runs once per file when the file's near the heuristic
   * ceiling. Three states:
   *   null:    still checking (or skipped because too small to bother)
   *   true:    allocation succeeded — conversion will likely fit
   *   false:   allocation failed — warn user before they hit Convert
   *
   * Skipped entirely in the Tauri app (native ffmpeg, no browser ceiling).
   */
  const [memCheck, setMemCheck] = useState<boolean | null>(null);
  const [staticMax, setStaticMax] = useState<number | null>(null);

  useEffect(() => {
    if (isDesktop()) return;
    setStaticMax(estimateMaxFileSizeBytes());
    if (!shouldProbe(file.size)) {
      setMemCheck(true); // file is comfortably small, no need to test
      return;
    }
    let cancelled = false;
    canAllocateForFile(file.size).then((ok) => {
      if (!cancelled) setMemCheck(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const probeFailed = memCheck === false;
  const probeBorderline = staticMax != null && file.size > staticMax * 0.7;

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
      <div className="flex items-start gap-5">
        <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl glass-strong">
          <FilmIcon />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-mono">
              Ready to convert
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]">
              {format.displayName} → MP4
            </span>
          </div>
          <h3
            className="truncate text-xl font-medium tracking-tight"
            title={file.name}
          >
            {file.name}
          </h3>
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
            <Row label="Size" value={formatBytes(file.size)} />
            <Row
              label="Type"
              value={file.type || format.mimeTypes[0] || "video"}
            />
            <Row
              label="Est. time"
              value={eta ?? "—"}
              className="col-span-2 sm:col-span-1"
            />
            <Row
              label="Modified"
              value={lastModified}
              className="col-span-2 sm:col-span-3"
            />
          </dl>

          <p
            className={[
              "mt-4 text-xs",
              format.remuxLikelihood === "high"
                ? "text-emerald-300/90"
                : format.remuxLikelihood === "medium"
                  ? "text-cyan-300/90"
                  : "text-amber-300/90",
            ].join(" ")}
          >
            {REMUX_HINT[format.remuxLikelihood]}
          </p>

          {crossFormat && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              You're on the {pageFormat.displayName} → MP4 page, but we detected
              a {format.displayName} file. We'll use the {format.displayName}{" "}
              pipeline so you still get the best path.
            </p>
          )}

          {/* Memory warning hierarchy (most severe wins):
            *  1. Probe definitively failed → red, blocks user mentally
            *  2. File over heuristic ceiling but probe succeeded → yellow caution
            *  3. Static "over 2 GB" fallback for when probe didn't run
            *  Hidden entirely on desktop (Tauri uses native ffmpeg). */}
          {!isDesktop() && probeFailed && (
            <p className="mt-3 text-xs text-rose-300/90">
              ⚠ Your browser couldn&apos;t allocate enough memory for this file
              ({formatBytes(file.size)}). Conversion will likely fail with an
              out-of-memory error. Close other tabs and retry, or use the{" "}
              <a href="/download" className="underline hover:text-rose-200">
                desktop app
              </a>
              .
            </p>
          )}
          {!isDesktop() && !probeFailed && probeBorderline && (
            <p className="mt-3 text-xs text-amber-300/90">
              This file is near your browser&apos;s memory ceiling
              {staticMax ? ` (~${formatBytes(staticMax)})` : ""}. If conversion
              stalls or crashes, close other tabs and retry, or use the{" "}
              <a href="/download" className="underline hover:text-amber-200">
                desktop app
              </a>
              .
            </p>
          )}
          {!isDesktop() && !probeFailed && !probeBorderline && tooBig && (
            <p className="mt-3 text-xs text-amber-300/90">
              Files over 2 GB may stress browser memory. If conversion fails,
              try a shorter clip.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
        >
          Choose different file
        </button>
        <button
          type="button"
          onClick={onConvert}
          disabled={disabled}
          className="group relative inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Convert to MP4</span>
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <dt className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono">
        {label}
      </dt>
      <dd className="text-[var(--color-text)] truncate" title={value}>
        {value}
      </dd>
    </div>
  );
}

function FilmIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-text)]"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <line x1="7" y1="3" x2="7" y2="21" />
      <line x1="17" y1="3" x2="17" y2="21" />
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="2" y1="15" x2="22" y2="15" />
    </svg>
  );
}

function ArrowRightIcon() {
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
      className="transition-transform group-hover:translate-x-0.5"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
