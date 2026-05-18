"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectImageFormatFromFile,
  type ImageFormatConfig,
} from "@/lib/image-formats";
import { convertImage, type ImageConvertResult } from "@/lib/image-engine";
import { formatBytes, formatDuration } from "@/lib/format";

/**
 * UI for the Image Converter tool — sister of VideoConverter / AudioConverter
 * but no ffmpeg involved (canvas + libheif-js). Simpler state machine
 * since image conversion is fast and rarely fails.
 *
 * The image bundle is pure-DOM so no Web Worker yet — could be moved into
 * one later if we hit perceptible main-thread jank on very large photos.
 */
type View = "select" | "selected" | "converting" | "done" | "error";

export interface ImageConverterProps {
  inputFormat: ImageFormatConfig;
  outputMime: "image/png" | "image/jpeg" | "image/webp";
  outputLabel: string; // "JPG" / "PNG" / "WEBP" for copy
}

export function ImageConverter({
  inputFormat,
  outputMime,
  outputLabel,
}: ImageConverterProps) {
  const [view, setView] = useState<View>("select");
  const [file, setFile] = useState<File | null>(null);
  const [detected, setDetected] = useState<ImageFormatConfig | null>(null);
  const [detail, setDetail] = useState<string>("");
  const [result, setResult] = useState<ImageConvertResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Free the result blob URL on replace / unmount.
  useEffect(() => {
    if (!downloadUrl) return;
    return () => URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const handleFile = useCallback(
    (f: File) => {
      setWarning(null);
      const det = detectImageFormatFromFile(f);
      if (det && det.id !== inputFormat.id) {
        setWarning(
          `Detected a .${det.extensions[0]} file (${det.displayName}). Converting using the ${det.displayName} pipeline instead of ${inputFormat.displayName}.`,
        );
      } else if (!det) {
        setWarning(
          `That doesn't look like a recognized image format. Conversion may fail.`,
        );
      }
      setFile(f);
      setDetected(det ?? inputFormat);
      setResult(null);
      setDownloadUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setDetail("");
      setView("selected");
    },
    [inputFormat],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleConvert = useCallback(async () => {
    if (!file) return;
    const fmtToUse = detected ?? inputFormat;
    setView("converting");
    setDetail("Reading file");
    setError(null);

    try {
      const r = await convertImage(file, {
        inputFormat: fmtToUse,
        outputMime,
        onProgress: (p) => {
          if (p.stage === "loading-heic-decoder") {
            setDetail("Loading HEIC decoder (~5 MB, first time only)");
          } else if (p.stage === "decoding") {
            setDetail("Decoding image");
          } else if (p.stage === "encoding") {
            setDetail(`Encoding to ${outputLabel}`);
          } else if (p.stage === "reading") {
            setDetail("Reading file");
          }
        },
      });
      setResult(r);
      setDownloadUrl(URL.createObjectURL(r.blob));
      setView("done");
    } catch (err) {
      const e = err as Error;
      setError(e.message || String(e));
      setView("error");
    }
  }, [file, detected, inputFormat, outputMime, outputLabel]);

  const handleReset = useCallback(() => {
    setFile(null);
    setDetected(null);
    setResult(null);
    setDownloadUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError(null);
    setWarning(null);
    setDetail("");
    setView("select");
  }, []);

  const acceptAttr = `${inputFormat.extensions.map((e) => `.${e}`).join(",")},${inputFormat.mimeTypes.join(",")},image/*`;

  return (
    <section
      id="converter"
      className="mx-auto max-w-2xl px-4 sm:px-6"
      aria-live="polite"
    >
      {view === "select" && (
        <div
          className={[
            "relative rounded-3xl glass p-10 sm:p-14 text-center transition-all duration-200 cursor-pointer",
            isOver
              ? "ring-accent border-[var(--color-accent)] scale-[1.005]"
              : "hover:border-[var(--color-border-strong)]",
          ].join(" ")}
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsOver(true);
          }}
          onDragLeave={() => setIsOver(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          aria-label={`Select or drop a ${inputFormat.displayName} file`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={acceptAttr}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl glass-strong">
            <ImageIcon />
          </div>
          <h3 className="text-xl sm:text-2xl font-medium tracking-tight">
            {isOver
              ? "Drop it here"
              : `Drop a ${inputFormat.displayName} file or click to browse`}
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Converts to {outputLabel}. Files never leave your device.
          </p>
        </div>
      )}

      {view === "selected" && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
            Ready to convert
          </div>
          <h3 className="text-xl font-medium tracking-tight truncate" title={file.name}>
            {file.name}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {formatBytes(file.size)} · {(detected ?? inputFormat).displayName} → {outputLabel}
          </p>
          {warning && (
            <p className="mt-3 text-xs text-amber-300/90">{warning}</p>
          )}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleConvert}
              className="px-5 py-2.5 rounded-xl accent-gradient-bg text-sm text-[#0b0b0c] font-medium hover:opacity-90 transition-opacity"
            >
              Convert to {outputLabel}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Choose different file
            </button>
          </div>
        </div>
      )}

      {view === "converting" && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
            Converting
          </div>
          <h3 className="text-xl font-medium tracking-tight truncate" title={file.name}>
            {file.name}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {formatBytes(file.size)}
          </p>
          <div className="mt-5 h-2 rounded-full bg-white/[0.04] border border-[var(--color-border)] overflow-hidden">
            <div className="h-full accent-gradient-bg animate-pulse" style={{ width: "100%" }} />
          </div>
          {detail && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)] font-mono">
              {detail}
            </p>
          )}
        </div>
      )}

      {view === "done" && result && downloadUrl && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-emerald-300/90 font-mono mb-2">
            Converted
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            {result.filename}
          </h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row label="Source" value={file.name} truncate />
            <Row label="Dimensions" value={`${result.width} × ${result.height}`} />
            <Row label="Source size" value={formatBytes(result.inputBytes)} />
            <Row label="Output size" value={formatBytes(result.outputBytes)} />
            <Row
              label="Size change"
              value={`${result.outputBytes < result.inputBytes ? "↓" : "↑"} ${
                Math.round(
                  (Math.abs(result.outputBytes - result.inputBytes) /
                    Math.max(1, result.inputBytes)) *
                    100,
                )
              }%`}
            />
            <Row label="Conversion time" value={formatDuration(result.durationMs)} />
          </dl>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={downloadUrl}
            alt="Preview of converted image"
            className="mt-5 mx-auto block max-h-80 rounded-xl border border-[var(--color-border)] bg-black/40"
          />

          <div className="mt-6 flex gap-3">
            <a
              href={downloadUrl}
              download={result.filename}
              className="px-5 py-2.5 rounded-xl accent-gradient-bg text-sm text-[#0b0b0c] font-medium hover:opacity-90 transition-opacity"
            >
              Download {outputLabel}
            </a>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Convert another file
            </button>
          </div>
        </div>
      )}

      {view === "error" && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in border-rose-400/20">
          <div className="text-xs uppercase tracking-wider text-rose-300/90 font-mono mb-2">
            Conversion failed
          </div>
          <p className="text-sm text-[var(--color-text-muted)] break-words">{error}</p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleConvert}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Choose different file
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono">
        {label}
      </dt>
      <dd
        className={[
          "text-[var(--color-text)] font-mono tabular-nums",
          truncate ? "truncate" : "",
        ].join(" ")}
        title={truncate ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function ImageIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-text)]"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
