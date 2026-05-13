"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConversionResult } from "@/lib/types";
import { formatBytes, formatDuration } from "@/lib/format";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; path: string }
  | { kind: "error"; message: string };

/**
 * Two modes:
 *   - Browser: `result.blob` holds the bytes → render a regular <a download>
 *     anchor backed by an Object URL.
 *   - Desktop: `result.outputPath` points to a temp file → render "Save MP4…"
 *     which opens a native save dialog and copies the temp file to the user's
 *     chosen destination. No upfront commitment to a save location.
 */
export function ResultView({
  result,
  onReset,
}: {
  result: ConversionResult;
  onReset: () => void;
}) {
  const isDesktopResult = Boolean(result.outputPath);
  const [url, setUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    // Browser-mode only: create an Object URL for the Blob.
    if (isDesktopResult) return;
    const u = URL.createObjectURL(result.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result.blob, isDesktopResult]);

  const ratio = useMemo(() => {
    if (!result.inputBytes) return null;
    return result.outputBytes / result.inputBytes;
  }, [result.inputBytes, result.outputBytes]);

  const handleDesktopSave = useCallback(async () => {
    if (!result.outputPath) return;
    setSaveState({ kind: "saving" });
    try {
      const [{ save }, { copyFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);
      const dest = await save({
        defaultPath: result.filename,
        filters: [{ name: "MP4 video", extensions: ["mp4"] }],
      });
      if (!dest) {
        setSaveState({ kind: "idle" });
        return;
      }
      await copyFile(result.outputPath, dest as string);
      setSaveState({ kind: "saved", path: dest as string });
    } catch (err) {
      setSaveState({
        kind: "error",
        message: (err as Error).message ?? "Save failed",
      });
    }
  }, [result.outputPath, result.filename]);

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
      <div className="flex items-start gap-5">
        <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 border border-emerald-400/30">
          <SuccessCheck />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-emerald-300/90 font-mono">
            Conversion complete
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            {isDesktopResult
              ? "Your MP4 is ready"
              : "Your MP4 is ready to download"}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {result.mode === "remux"
              ? "Remuxed with zero quality loss."
              : "Re-encoded with H.264 + AAC for compatibility."}
          </p>

          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Output" value={formatBytes(result.outputBytes)} />
            <Row label="Source" value={formatBytes(result.inputBytes)} />
            <Row
              label="Size ratio"
              value={ratio == null ? "—" : `${(ratio * 100).toFixed(0)}%`}
            />
            <Row label="Took" value={formatDuration(result.durationMs)} />
          </dl>

          {saveState.kind === "saved" && (
            <p className="mt-4 text-xs text-emerald-300/90 break-all font-mono">
              Saved to {saveState.path}
            </p>
          )}
          {saveState.kind === "error" && (
            <p className="mt-4 text-xs text-rose-300/90">
              Save failed: {saveState.message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          Convert another
        </button>

        {isDesktopResult ? (
          <button
            type="button"
            onClick={handleDesktopSave}
            disabled={saveState.kind === "saving"}
            className="group inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <SaveIcon />
            <span>
              {saveState.kind === "saving"
                ? "Saving…"
                : saveState.kind === "saved"
                  ? "Save to another location"
                  : "Save MP4…"}
            </span>
          </button>
        ) : (
          url && (
            <a
              href={url}
              download={result.filename}
              className="group inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow"
            >
              <DownloadIcon />
              <span>Download {result.filename}</span>
            </a>
          )
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono">
        {label}
      </dt>
      <dd className="text-[var(--color-text)] font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function SuccessCheck() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="draw-check text-emerald-300"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
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

function SaveIcon() {
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
