"use client";

import { useCallback, useState } from "react";
import { DropZone } from "./DropZone";
import { FORMATS } from "@/lib/formats";
import { extractAudio, type ExtractResult } from "@/lib/bleep/audio-extract";
import type { BleepStage, BleepProgress } from "@/lib/bleep/types";
import { formatBytes, formatDuration } from "@/lib/format";

/**
 * Bleep tool orchestrator. Phase 2 scope: drop file → extract audio →
 * show stats. Phases 3+ chain Whisper transcription, profanity matching,
 * and the mute filter. State machine grows over phases.
 *
 * Reuses the converter's DropZone + format auto-detection. The "input
 * format" prop is required by DropZone but actually unused here since
 * we accept any video format we can extract audio from.
 */
type View = "select" | "extracting" | "extracted" | "error";

export function BleepConverter() {
  const [view, setView] = useState<View>("select");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<BleepStage>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setView("extracting");
    setError(null);
    setResult(null);
    setProgress(0);
    setStage("loading-engine");

    try {
      console.log("[bleep] starting extraction for", f.name, formatBytes(f.size));
      const t0 = performance.now();
      const r = await extractAudio(f, {
        onLog: (line) => {
          // Heuristic: ffmpeg log lines about "Duration" or "Stream" tell us
          // we've moved past engine load into the actual extract step.
          if (line.message.includes("Duration") || line.message.includes("Stream #")) {
            setStage("extracting-audio");
          }
        },
        onProgress: (ratio) => {
          setProgress(ratio);
          if (ratio > 0 && stage === "loading-engine") setStage("extracting-audio");
        },
      });
      const elapsedMs = performance.now() - t0;

      console.log("[bleep] extracted", {
        durationSec: r.durationSec.toFixed(2),
        sampleRate: r.sampleRate,
        samples: r.pcm.length,
        sizeBytes: r.pcm.byteLength,
        sizeMB: (r.pcm.byteLength / 1024 / 1024).toFixed(2),
        elapsedMs: elapsedMs.toFixed(0),
      });

      setResult(r);
      setStage("done");
      setView("extracted");
    } catch (err) {
      console.error("[bleep] extraction failed:", err);
      setError((err as Error).message ?? String(err));
      setStage("error");
      setView("error");
    }
  }, [stage]);

  const handleReset = useCallback(() => {
    setView("select");
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setStage("idle");
  }, []);

  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6">
      {view === "select" && (
        <DropZone
          onFile={handleFile}
          inputFormat={FORMATS.mp4}
          genericMode
        />
      )}

      {view === "extracting" && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
            {stageLabel(stage)}
          </div>
          <h3 className="text-xl font-medium tracking-tight truncate">
            {file.name}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {formatBytes(file.size)}
          </p>
          <div className="mt-5 h-2 rounded-full bg-white/[0.04] border border-[var(--color-border)] overflow-hidden">
            <div
              className="h-full accent-gradient-bg transition-[width] duration-200"
              style={{ width: `${Math.max(2, progress * 100).toFixed(0)}%` }}
            />
          </div>
          <p className="mt-3 text-[11px] text-[var(--color-text-dim)] font-mono">
            Phase 2 only extracts audio. Transcription + bleeping ship in
            phases 3–5. See the browser console for raw output.
          </p>
        </div>
      )}

      {view === "extracted" && result && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-emerald-300/90 font-mono mb-2">
            Audio extracted
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            Phase 2 worked end-to-end
          </h3>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row label="Source" value={file.name} truncate />
            <Row label="Source size" value={formatBytes(file.size)} />
            <Row label="Audio duration" value={formatDuration(result.durationSec * 1000)} />
            <Row label="Sample rate" value={`${result.sampleRate} Hz`} />
            <Row label="PCM samples" value={result.pcm.length.toLocaleString()} />
            <Row label="PCM size" value={formatBytes(result.pcm.byteLength)} />
          </dl>

          <p className="mt-5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            ffmpeg.wasm extracted the audio track to 16 kHz mono float32 PCM
            — the exact input format Whisper expects. Phase 3 will feed this
            buffer to whisper-tiny via transformers.js to get word-level
            timestamps.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Try another file
            </button>
          </div>
        </div>
      )}

      {view === "error" && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in border-rose-400/20">
          <div className="text-xs uppercase tracking-wider text-rose-300/90 font-mono mb-2">
            Extraction failed
          </div>
          <p className="text-sm text-[var(--color-text-muted)] break-words">
            {error}
          </p>
          <div className="mt-5">
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

function stageLabel(s: BleepStage): string {
  switch (s) {
    case "loading-engine": return "Loading ffmpeg.wasm";
    case "extracting-audio": return "Extracting audio";
    case "writing-output": return "Finalizing";
    default: return "Working";
  }
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
