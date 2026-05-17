"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DropZone } from "./DropZone";
import { FORMATS } from "@/lib/formats";
import { extractAudio } from "@/lib/bleep/audio-extract";
import { transcribeToWords, type WhisperProgress } from "@/lib/bleep/whisper";
import {
  estimateTranscribeRange,
  formatElapsedShort,
  formatEtaRange,
} from "@/lib/bleep/eta";
import { ModelPicker, useModelChoice } from "./ModelPicker";
import { MemoryControls } from "./MemoryControls";
import { groupIntoCues, type Cue } from "@/lib/transcribe/cues";
import { toPlainText, toSRT, toVTT, toJSON } from "@/lib/transcribe/export";
import type { TranscribedWord } from "@/lib/bleep/types";
import { formatBytes, formatDuration } from "@/lib/format";

/**
 * Video-to-text transcriber. Same underlying pipeline as the bleep tool
 * — ffmpeg.wasm pulls audio to 16 kHz mono PCM, whisper-base.en runs in
 * the browser (WebGPU when available) — but the output is the full
 * transcript and four download formats: TXT, SRT, VTT, JSON.
 */
type View = "select" | "processing" | "transcribed" | "error";

interface ProcessingState {
  /** 0-1; negative = indeterminate (pulse). */
  ratio: number;
  stage: string;
  detail?: string;
}

interface TranscriptResult {
  words: TranscribedWord[];
  fullText: string;
  cues: Cue[];
  device: "webgpu" | "wasm";
  audioDurationSec: number;
  extractElapsedMs: number;
  transcribeElapsedMs: number;
  vad?: { totalRegions: number; speechSec: number; totalSec: number; speechFraction: number };
}

interface VadProgress {
  /** Total speech-region count detected, set on `vad-done`. */
  totalRegions: number;
  /** 1-indexed region currently being transcribed. */
  region: number;
  speechSec: number;
  totalSec: number;
}

interface DownloadFile {
  url: string;
  filename: string;
  size: number;
}

interface Downloads {
  txt: DownloadFile;
  srt: DownloadFile;
  vtt: DownloadFile;
  json: DownloadFile;
}

export function TranscribeConverter() {
  const [view, setView] = useState<View>("select");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ ratio: 0, stage: "Idle" });
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [downloads, setDownloads] = useState<Downloads | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Surfaced live during processing so the UI can show "Xm audio, ~Y min on
  // WebGPU" while inference runs (transformers.js can't emit per-chunk
  // progress for Whisper, so the next-best signal is elapsed + scale).
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [transcribeDevice, setTranscribeDevice] = useState<"webgpu" | "wasm" | null>(null);
  const [vadProgress, setVadProgress] = useState<VadProgress | null>(null);
  const [modelChoice, setModelChoice] = useModelChoice();
  const transcribeElapsedMs = useElapsedMs(processing.stage === "Transcribing");

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    // Free any earlier preview URL — we're starting a new pipeline run.
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setView("processing");
    setError(null);
    setResult(null);
    setDownloads(null);
    setAudioDurationSec(null);
    setTranscribeDevice(null);
    setVadProgress(null);
    setProcessing({ ratio: 0, stage: "Loading ffmpeg.wasm" });

    try {
      /* ---------- extract audio ---------- */
      const tExtract0 = performance.now();
      const extract = await extractAudio(f, {
        onLog: (line) => {
          if (line.message.includes("Duration") || line.message.includes("Stream #")) {
            setProcessing((p) => ({ ...p, stage: "Extracting audio" }));
          }
        },
        onProgress: (ratio) => {
          setProcessing({ ratio, stage: "Extracting audio" });
        },
      });
      const extractMs = performance.now() - tExtract0;
      setAudioDurationSec(extract.durationSec);
      console.log("[transcribe] extracted", {
        durationSec: extract.durationSec.toFixed(2),
        elapsedMs: extractMs.toFixed(0),
      });

      /* ---------- whisper ---------- */
      setProcessing({ ratio: 0, stage: "Loading Whisper model", detail: "Preparing model" });
      const tTranscribe0 = performance.now();
      const { words, fullText, device, vad } = await transcribeToWords(extract.pcm, {
        model: modelChoice,
        onProgress: (p: WhisperProgress) => {
          if (p.kind === "loading") {
            const mb = p.totalBytes
              ? `${(p.loadedBytes! / 1024 / 1024).toFixed(1)} / ${(p.totalBytes / 1024 / 1024).toFixed(1)} MB`
              : undefined;
            setProcessing({ ratio: p.ratio, stage: "Loading Whisper model", detail: mb ?? "Downloading model files" });
          } else if (p.kind === "ready") {
            setTranscribeDevice(p.device);
            setProcessing({
              ratio: -1,
              stage: "Detecting speech",
              detail: p.fromCache
                ? `Loaded from cache on ${p.device.toUpperCase()}`
                : `Whisper ready on ${p.device.toUpperCase()}`,
            });
          } else if (p.kind === "vad-done") {
            setVadProgress({
              totalRegions: p.totalRegions,
              region: 0,
              speechSec: p.speechSec,
              totalSec: p.totalSec,
            });
            const pct = Math.round(p.speechFraction * 100);
            setProcessing({
              ratio: 0,
              stage: "Transcribing",
              detail: `Found ${p.totalRegions} speech region${p.totalRegions === 1 ? "" : "s"} (${pct}% of audio is speech)`,
            });
          } else if (p.kind === "transcribing") {
            setVadProgress((prev) =>
              prev
                ? { ...prev, region: p.region, totalRegions: p.totalRegions }
                : { totalRegions: p.totalRegions, region: p.region, speechSec: 0, totalSec: 0 },
            );
            const isMulti = p.totalRegions > 1;
            setProcessing({
              ratio: isMulti ? (p.region - 1) / p.totalRegions : -1,
              stage: "Transcribing",
              detail: isMulti
                ? `Region ${p.region} of ${p.totalRegions} on ${(transcribeDevice ?? "wasm").toUpperCase()}`
                : `Inference running on ${(transcribeDevice ?? "wasm").toUpperCase()}`,
            });
          }
        },
      });
      const transcribeMs = performance.now() - tTranscribe0;
      console.log("[transcribe] done", { words: words.length, device, elapsedMs: transcribeMs.toFixed(0) });

      /* ---------- group + build exports ---------- */
      const cues = groupIntoCues(words);
      const baseName = (f.name.replace(/\.[^.]+$/, "") || "transcript")
        .replace(/[^\w.\-]+/g, "_")
        .slice(0, 80);

      const make = (content: string, type: string, ext: string): DownloadFile => {
        const blob = new Blob([content], { type });
        return {
          url: URL.createObjectURL(blob),
          filename: `${baseName}.${ext}`,
          size: blob.size,
        };
      };

      const r: TranscriptResult = {
        words,
        fullText,
        cues,
        device,
        audioDurationSec: extract.durationSec,
        extractElapsedMs: extractMs,
        transcribeElapsedMs: transcribeMs,
        vad,
      };

      setResult(r);
      setDownloads({
        txt: make(toPlainText(cues), "text/plain", "txt"),
        srt: make(toSRT(cues), "application/x-subrip", "srt"),
        vtt: make(toVTT(cues), "text/vtt", "vtt"),
        json: make(
          toJSON({ sourceName: f.name, audioDurationSec: extract.durationSec, device, words, cues }),
          "application/json",
          "json",
        ),
      });
      setView("transcribed");
    } catch (err) {
      console.error("[transcribe] failed:", err);
      setError((err as Error).message ?? String(err));
      setView("error");
    }
  }, []);

  // Free blob URLs on replace / unmount.
  useEffect(() => {
    if (!downloads) return;
    const urls = [downloads.txt.url, downloads.srt.url, downloads.vtt.url, downloads.json.url];
    return () => urls.forEach(URL.revokeObjectURL);
  }, [downloads]);

  const handleReset = useCallback(() => {
    setView("select");
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult(null);
    setDownloads(null);
    setError(null);
    setAudioDurationSec(null);
    setTranscribeDevice(null);
    setVadProgress(null);
    setProcessing({ ratio: 0, stage: "Idle" });
  }, []);

  // Final cleanup: free the source preview URL on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // Intentionally empty — we only want the unmount cleanup; in-flight URL
    // swaps are revoked by setPreviewUrl callers above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6">
      {view === "select" && (
        <>
          <ModelPicker value={modelChoice} onChange={setModelChoice} />
          <DropZone onFile={handleFile} inputFormat={FORMATS.mp4} genericMode />
          <MemoryControls />
        </>
      )}

      {view === "processing" && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
            {processing.stage}
          </div>
          <h3 className="text-xl font-medium tracking-tight truncate">
            {file.name}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {formatBytes(file.size)}
          </p>
          <ProgressBar ratio={processing.ratio} />
          {processing.detail && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)] font-mono">
              {processing.detail}
            </p>
          )}
          {processing.stage === "Transcribing" && audioDurationSec && transcribeDevice && (
            <LiveInferenceStats
              elapsedMs={transcribeElapsedMs}
              audioSec={audioDurationSec}
              device={transcribeDevice}
              vad={vadProgress}
            />
          )}
          <p className="mt-3 text-[11px] text-[var(--color-text-dim)] font-mono">
            Audio is extracted with ffmpeg.wasm, then whisper-base.en runs
            entirely in your browser (WebGPU when available). First model
            run downloads ~80 MB; later runs use the cached copy.
          </p>
        </div>
      )}

      {view === "transcribed" && result && downloads && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-emerald-300/90 font-mono mb-2">
            Transcribed
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            {result.words.length.toLocaleString()} words, {result.cues.length.toLocaleString()} cues
          </h3>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row label="Source" value={file.name} truncate />
            <Row label="Audio" value={formatDuration(result.audioDurationSec * 1000)} />
            <Row label="Extract" value={`${(result.extractElapsedMs / 1000).toFixed(1)} s`} />
            <Row label="Transcribe" value={`${(result.transcribeElapsedMs / 1000).toFixed(1)} s · ${result.device.toUpperCase()}`} />
          </dl>

          {result.vad && (
            <p className="mt-3 text-[11px] text-[var(--color-text-dim)] font-mono">
              VAD pre-filter: {result.vad.totalRegions} speech region
              {result.vad.totalRegions === 1 ? "" : "s"} ·{" "}
              {formatDuration(result.vad.speechSec * 1000)} of speech ·{" "}
              skipped {formatDuration(Math.max(0, (result.vad.totalSec - result.vad.speechSec)) * 1000)}{" "}
              of silence ({Math.round((1 - result.vad.speechFraction) * 100)}%
              {" "}of the audio).
            </p>
          )}

          <TranscriptPlayer
            previewUrl={previewUrl}
            sourceMime={file.type}
            cues={result.cues}
            fullText={result.fullText}
          />

          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <DownloadCard label="Plain text" ext="TXT" file={downloads.txt} />
            <DownloadCard label="SubRip subtitles" ext="SRT" file={downloads.srt} />
            <DownloadCard label="WebVTT subtitles" ext="VTT" file={downloads.vtt} />
            <DownloadCard label="JSON · word timestamps" ext="JSON" file={downloads.json} />
          </div>

          <p className="mt-5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            SRT / VTT can be dropped into YouTube, Premiere, Final Cut, or
            any player that supports sidecar subtitles. JSON includes
            per-word timestamps if you want to build your own UI on top.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Transcribe another file
            </button>
          </div>
        </div>
      )}

      {view === "error" && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in border-rose-400/20">
          <div className="text-xs uppercase tracking-wider text-rose-300/90 font-mono mb-2">
            {processing.stage} failed
          </div>
          <p className="text-sm text-[var(--color-text-muted)] break-words">{error}</p>
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

/**
 * Ticks every 500 ms while `active` is true, returning elapsed milliseconds
 * since the most recent transition to active. Resets to 0 each time it
 * goes inactive so the next run starts fresh.
 */
function useElapsedMs(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const start = performance.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(performance.now() - start);
    }, 500);
    return () => window.clearInterval(id);
  }, [active]);
  return elapsed;
}

function LiveInferenceStats({
  elapsedMs,
  audioSec,
  device,
  vad,
}: {
  elapsedMs: number;
  audioSec: number;
  device: "webgpu" | "wasm";
  /** Present when the VAD pre-filter has finished; null while still in
   *  the "Detecting speech" stage or on the no-VAD short-audio path. */
  vad: VadProgress | null;
}) {
  // ETA: scale by the speech fraction so we don't over-estimate when most
  // of the audio is silence (Whisper isn't being called on those windows).
  const effectiveAudioSec =
    vad && vad.totalSec > 0 ? vad.speechSec : audioSec;
  const eta = useMemo(
    () => formatEtaRange(estimateTranscribeRange(effectiveAudioSec, device)),
    [effectiveAudioSec, device],
  );
  return (
    <div className="mt-2 text-[11px] text-[var(--color-text-dim)] font-mono leading-relaxed">
      <div>
        <span className="text-[var(--color-text-muted)]">Elapsed</span>{" "}
        {formatElapsedShort(elapsedMs)} ·{" "}
        <span className="text-[var(--color-text-muted)]">Audio</span>{" "}
        {formatDuration(audioSec * 1000)} ·{" "}
        <span className="text-[var(--color-text-muted)]">Typical</span>{" "}
        {eta} on {device.toUpperCase()}
      </div>
      {vad && vad.totalRegions > 0 && (
        <div>
          <span className="text-[var(--color-text-muted)]">VAD</span>{" "}
          {vad.region > 0
            ? `region ${vad.region} / ${vad.totalRegions}`
            : `${vad.totalRegions} regions`}
          {vad.totalSec > 0 && (
            <>
              {" "}·{" "}
              <span className="text-[var(--color-text-muted)]">Speech</span>{" "}
              {formatDuration(vad.speechSec * 1000)} /{" "}
              {formatDuration(vad.totalSec * 1000)} ·{" "}
              skipping {Math.round((1 - vad.speechSec / Math.max(1, vad.totalSec)) * 100)}% silence
            </>
          )}
        </div>
      )}
      <div className="opacity-70">
        {vad && vad.totalRegions > 1
          ? "Whisper runs once per speech region; silence is never paid for."
          : "whisper-base.en processes 30-second windows sequentially; the UI can’t show per-window progress, but it’s still working."}
      </div>
    </div>
  );
}

function TranscriptPlayer({
  previewUrl,
  sourceMime,
  cues,
  fullText,
}: {
  previewUrl: string | null;
  sourceMime: string;
  cues: readonly Cue[];
  fullText: string;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const cueListRef = useRef<HTMLDivElement | null>(null);
  const cueRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [currentSec, setCurrentSec] = useState(0);

  const isAudio = useMemo(
    () => (sourceMime ? sourceMime.startsWith("audio/") : false),
    [sourceMime],
  );

  // Active-cue lookup via binary search would be overkill — cues are usually
  // O(hundreds) and the timeupdate event fires only a few times per second.
  const activeIdx = useMemo(() => {
    for (let i = 0; i < cues.length; i++) {
      if (currentSec >= cues[i].startSec && currentSec < cues[i].endSec) return i;
    }
    return -1;
  }, [cues, currentSec]);

  // Auto-scroll the active cue into view, but only if the list is the thing
  // the user is looking at (avoid yanking the page when they've scrolled
  // away to read elsewhere). Using `nearest` keeps it gentle.
  useEffect(() => {
    if (activeIdx < 0) return;
    const el = cueRefs.current[activeIdx];
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  const seekTo = useCallback((sec: number) => {
    const m = mediaRef.current;
    if (!m) return;
    m.currentTime = Math.max(0, sec);
    void m.play();
  }, []);

  const onTimeUpdate = useCallback(() => {
    const m = mediaRef.current;
    if (m) setCurrentSec(m.currentTime);
  }, []);

  return (
    <div className="mt-5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
        Preview &amp; transcript
      </div>

      {previewUrl ? (
        isAudio ? (
          <audio
            ref={(el) => { mediaRef.current = el; }}
            src={previewUrl}
            controls
            preload="metadata"
            onTimeUpdate={onTimeUpdate}
            className="w-full"
            aria-label="Source audio preview"
          />
        ) : (
          <video
            ref={(el) => { mediaRef.current = el; }}
            src={previewUrl}
            controls
            preload="metadata"
            onTimeUpdate={onTimeUpdate}
            className="w-full rounded-xl border border-[var(--color-border)] bg-black/40"
            aria-label="Source video preview"
          />
        )
      ) : null}

      <div
        ref={cueListRef}
        className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white/[0.02] divide-y divide-white/[0.04]"
      >
        {cues.length === 0 && (
          <div className="px-3 py-4 text-sm italic text-[var(--color-text-dim)]">
            {fullText.trim() || "(empty transcript)"}
          </div>
        )}
        {cues.map((c, i) => (
          <button
            key={i}
            ref={(el) => { cueRefs.current[i] = el; }}
            type="button"
            onClick={() => seekTo(c.startSec)}
            className={[
              "w-full flex items-baseline gap-3 px-3 py-2 text-left transition-colors",
              i === activeIdx
                ? "bg-[var(--color-accent)]/15 text-[var(--color-text)]"
                : "hover:bg-white/[0.02] text-[var(--color-text-muted)]",
            ].join(" ")}
            aria-current={i === activeIdx ? "true" : undefined}
          >
            <span className="font-mono text-[10px] tabular-nums whitespace-nowrap text-[var(--color-text-dim)] w-12 shrink-0">
              {formatTimecode(c.startSec)}
            </span>
            <span className="text-sm leading-relaxed flex-1 min-w-0">
              {c.text}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-text-dim)] font-mono">
        Click any cue to seek the preview.
      </p>
    </div>
  );
}

function formatTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function DownloadCard({
  label,
  ext,
  file,
}: {
  label: string;
  ext: string;
  file: DownloadFile;
}) {
  return (
    <a
      href={file.url}
      download={file.filename}
      className="block rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] p-4 transition-colors group"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono">
          {label}
        </div>
        <div className="text-[10px] font-mono text-[var(--color-text-dim)]">{ext}</div>
      </div>
      <div className="mt-1 text-sm font-mono text-[var(--color-text)] truncate" title={file.filename}>
        {file.filename}
      </div>
      <div className="text-xs text-[var(--color-text-muted)] mt-1">
        {formatBytes(file.size)}
      </div>
    </a>
  );
}

function ProgressBar({ ratio }: { ratio: number }) {
  const indeterminate = ratio < 0;
  return (
    <div className="mt-5 h-2 rounded-full bg-white/[0.04] border border-[var(--color-border)] overflow-hidden">
      {indeterminate ? (
        <div className="h-full accent-gradient-bg animate-pulse" style={{ width: "100%" }} />
      ) : (
        <div
          className="h-full accent-gradient-bg transition-[width] duration-200"
          style={{ width: `${Math.max(2, ratio * 100).toFixed(0)}%` }}
        />
      )}
    </div>
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
