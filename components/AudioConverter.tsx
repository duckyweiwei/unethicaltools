"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConverter } from "@/lib/converter-client";
import type { ConversionResult, LogLine } from "@/lib/types";
import { formatBytes, formatDuration } from "@/lib/format";
import {
  detectAudioFormatFromFile,
  type AudioFormatConfig,
} from "@/lib/audio-formats";

/**
 * UI for the Audio Converter tool — sister of VideoConverter, but
 * single-target (MP3) and lighter on edge cases (audio files rarely hit
 * the WASM 4 GB ceiling, so OversizedFileNotice / MemoryErrorView aren't
 * mirrored here).
 *
 * State machine: select → selected → converting → (done | error).
 * Reuses the same ConverterClient singleton + ffmpeg.wasm engine as the
 * video converter via the engine's new `convertAudio` method.
 */
type View = "select" | "selected" | "converting" | "done" | "error";

export interface AudioConverterProps {
  inputFormat: AudioFormatConfig;
}

export function AudioConverter({ inputFormat }: AudioConverterProps) {
  const [view, setView] = useState<View>("select");
  const [file, setFile] = useState<File | null>(null);
  const [detected, setDetected] = useState<AudioFormatConfig | null>(null);
  const [detail, setDetail] = useState<string>("");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Tick an elapsed counter while converting so long files don't look hung.
  const startedAtRef = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (view !== "converting") return;
    startedAtRef.current = performance.now();
    setElapsedMs(0);
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, [view]);

  // Free the result blob URL on replace / unmount.
  useEffect(() => {
    if (!downloadUrl) return;
    return () => URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const acceptAttr = useMemo(() => {
    const exts = inputFormat.extensions.map((e) => `.${e}`).join(",");
    const mimes = inputFormat.mimeTypes.join(",");
    // Always include audio/* so the picker shows neighboring formats too —
    // we detect the real format from the dropped file and warn if it differs.
    return `${exts},${mimes},audio/*`;
  }, [inputFormat]);

  const handleFile = useCallback(
    (f: File) => {
      setWarning(null);
      const det = detectAudioFormatFromFile(f);
      if (det && det.id !== inputFormat.id) {
        setWarning(
          `Detected a .${det.extensions[0]} file (${det.displayName}). Converting using the ${det.displayName} pipeline instead of ${inputFormat.displayName}.`,
        );
      } else if (!det) {
        setWarning(
          `That doesn't look like a recognized audio format. ffmpeg will reject it if unsupported.`,
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

  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

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
    setDetail("Loading ffmpeg.wasm");
    setError(null);

    try {
      const client = getConverter();
      await client.load({
        onLog: (line: LogLine) => {
          if (line.message.includes("Duration") || line.message.includes("Stream #")) {
            setDetail("Decoding audio");
          }
        },
      });
      setDetail(`Encoding to MP3 from ${fmtToUse.displayName}`);
      const r = await client.convertAudio(
        file,
        { ffmpegInputExt: fmtToUse.ffmpegInputExt },
        {
          onProgress: ({ stage, ratio, mediaTimeSec }) => {
            if (stage === "encoding" && typeof mediaTimeSec === "number") {
              setDetail(
                `Encoding · ${formatDuration(mediaTimeSec * 1000)} processed`,
              );
            } else if (stage === "writing-output") {
              setDetail("Finalizing MP3");
            }
            // Ratio isn't always reliable for audio (no known total duration
            // without parsing input first); we omit a progress bar and rely
            // on the detail line + elapsed timer.
            void ratio;
          },
        },
      );
      setResult(r);
      setDownloadUrl(URL.createObjectURL(r.blob));
      setView("done");
    } catch (err) {
      const e = err as Error;
      setError(e.message || String(e));
      setView("error");
    }
  }, [file, detected, inputFormat]);

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
            <AudioIcon />
          </div>
          <h3 className="text-xl sm:text-2xl font-medium tracking-tight">
            {isOver
              ? "Drop it here"
              : `Drop a ${inputFormat.displayName} file or click to browse`}
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Converts to MP3 (VBR ~190 kbps). Files never leave your device.
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
            {formatBytes(file.size)} · {(detected ?? inputFormat).displayName} → MP3
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
              Convert to MP3
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
          <p className="mt-1 text-[11px] text-[var(--color-text-dim)] font-mono">
            Elapsed {formatDuration(elapsedMs)}
          </p>
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
            <Row label="Source size" value={formatBytes(result.inputBytes)} />
            <Row label="Output size" value={formatBytes(result.outputBytes)} />
            <Row
              label="Size change"
              value={`${result.outputBytes < result.inputBytes ? "↓" : "↑"} ${
                Math.round(
                  (1 - result.outputBytes / Math.max(1, result.inputBytes)) * 100,
                )
              }%`}
            />
            <Row label="Encode time" value={`${(result.durationMs / 1000).toFixed(1)} s`} />
            <Row label="Bitrate" value="VBR ~190 kbps" />
          </dl>

          <audio
            src={downloadUrl}
            controls
            preload="metadata"
            className="mt-5 w-full"
            aria-label="Preview of converted MP3"
          />

          <div className="mt-6 flex gap-3">
            <a
              href={downloadUrl}
              download={result.filename}
              className="px-5 py-2.5 rounded-xl accent-gradient-bg text-sm text-[#0b0b0c] font-medium hover:opacity-90 transition-opacity"
            >
              Download MP3
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

function AudioIcon() {
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
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
