"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DropZone } from "./DropZone";
import { FORMATS } from "@/lib/formats";
import { extractAudio } from "@/lib/bleep/audio-extract";
import { transcribeToWords, type WhisperProgress } from "@/lib/bleep/whisper";
import { matchProfanity, normalizeWord, type MatchEntry } from "@/lib/bleep/match";
import { DEFAULT_PROFANITY_SET } from "@/lib/bleep/wordlist";
import { applyMute } from "@/lib/bleep/apply-mute";
import { buildMuteLog } from "@/lib/bleep/mute-log";
import {
  estimateTranscribeRange,
  formatElapsedShort,
  formatEtaRange,
} from "@/lib/bleep/eta";
import { ModelPicker, useModelChoice } from "./ModelPicker";
import { MemoryControls } from "./MemoryControls";
import type { BleepRange, BleepStage, TranscribedWord } from "@/lib/bleep/types";
import { formatBytes, formatDuration } from "@/lib/format";

/**
 * Bleep tool orchestrator. Phase 5 scope: drop file → extract audio → run
 * Whisper for word-level timestamps → match against profanity wordlist →
 * review/toggle → apply ffmpeg mute filter → download bleeped MP4 + log.
 *
 * State machine: select → processing → reviewing → muting → muted → error.
 */
type View = "select" | "processing" | "reviewing" | "muting" | "muted" | "error";

const MUTE_PAD_SEC = 0.05;

interface ProcessingState {
  /** 0-1. Negative = indeterminate (pulse). */
  ratio: number;
  detail?: string;
}

interface TranscriptResult {
  words: TranscribedWord[];
  fullText: string;
  device: "webgpu" | "wasm";
  audioDurationSec: number;
  extractElapsedMs: number;
  transcribeElapsedMs: number;
}

interface MutedResult {
  videoUrl: string;
  videoFilename: string;
  videoSize: number;
  logUrl: string;
  logFilename: string;
  appliedRanges: BleepRange[];
  elapsedMs: number;
}

interface VadProgress {
  totalRegions: number;
  /** 1-indexed region currently being transcribed; 0 = just finished VAD scan. */
  region: number;
  speechSec: number;
  totalSec: number;
}

/** Tracks the user's enabled/disabled choice per match by stable id. */
type EnabledMap = Record<string, boolean>;

export function BleepConverter() {
  const [view, setView] = useState<View>("select");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<BleepStage>("idle");
  const [processing, setProcessing] = useState<ProcessingState>({ ratio: 0 });
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [enabled, setEnabled] = useState<EnabledMap>({});
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [muted, setMuted] = useState<MutedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Live progress info surfaced during the long-running transcribe step.
  // transformers.js can't emit per-chunk callbacks for Whisper, so this is
  // the next-best signal that things are still alive.
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [transcribeDevice, setTranscribeDevice] = useState<"webgpu" | "wasm" | null>(null);
  const [vadProgress, setVadProgress] = useState<VadProgress | null>(null);
  const [modelChoice, setModelChoice] = useModelChoice();
  const transcribeElapsedMs = useElapsedMs(stage === "transcribing");

  const enabledCount = useMemo(
    () => matches.filter((m) => enabled[m.id] !== false).length,
    [matches, enabled],
  );

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setView("processing");
    setError(null);
    setTranscript(null);
    setMatches([]);
    setEnabled({});
    setCustomWords([]);
    setCustomDraft("");
    setAudioDurationSec(null);
    setTranscribeDevice(null);
    setVadProgress(null);
    setProcessing({ ratio: 0 });
    setStage("loading-engine");

    try {
      /* ---------- extract audio ---------- */
      const tExtract0 = performance.now();
      const extract = await extractAudio(f, {
        onLog: (line) => {
          if (line.message.includes("Duration") || line.message.includes("Stream #")) {
            setStage((s) => (s === "loading-engine" ? "extracting-audio" : s));
          }
        },
        onProgress: (ratio) => {
          setProcessing({ ratio });
          setStage((s) => (s === "loading-engine" && ratio > 0 ? "extracting-audio" : s));
        },
      });
      const extractMs = performance.now() - tExtract0;
      setAudioDurationSec(extract.durationSec);
      console.log("[bleep] extracted", {
        durationSec: extract.durationSec.toFixed(2),
        elapsedMs: extractMs.toFixed(0),
      });

      /* ---------- transcribe ---------- */
      setStage("loading-model");
      setProcessing({ ratio: 0, detail: "Preparing Whisper" });
      const tTranscribe0 = performance.now();
      const { words, fullText, device } = await transcribeToWords(extract.pcm, {
        model: modelChoice,
        onProgress: (p: WhisperProgress) => {
          if (p.kind === "loading") {
            setStage("loading-model");
            const mb = p.totalBytes
              ? `${(p.loadedBytes! / 1024 / 1024).toFixed(1)} / ${(p.totalBytes / 1024 / 1024).toFixed(1)} MB`
              : undefined;
            setProcessing({ ratio: p.ratio, detail: mb ?? "Downloading model files" });
          } else if (p.kind === "ready") {
            setStage("transcribing");
            setTranscribeDevice(p.device);
            setProcessing({
              ratio: -1,
              detail: p.fromCache
                ? `Loaded from cache on ${p.device.toUpperCase()}`
                : `Whisper ready on ${p.device.toUpperCase()}`,
            });
          } else if (p.kind === "vad-done") {
            setStage("transcribing");
            setVadProgress({
              totalRegions: p.totalRegions,
              region: 0,
              speechSec: p.speechSec,
              totalSec: p.totalSec,
            });
            const pct = Math.round(p.speechFraction * 100);
            setProcessing({
              ratio: 0,
              detail: `Found ${p.totalRegions} speech region${p.totalRegions === 1 ? "" : "s"} (${pct}% of audio is speech)`,
            });
          } else if (p.kind === "transcribing") {
            setStage("transcribing");
            setVadProgress((prev) =>
              prev
                ? { ...prev, region: p.region, totalRegions: p.totalRegions }
                : { totalRegions: p.totalRegions, region: p.region, speechSec: 0, totalSec: 0 },
            );
            const isMulti = p.totalRegions > 1;
            setProcessing({
              ratio: isMulti ? (p.region - 1) / p.totalRegions : -1,
              detail: isMulti
                ? `Region ${p.region} of ${p.totalRegions} on ${(transcribeDevice ?? "wasm").toUpperCase()}`
                : `Inference running on ${(transcribeDevice ?? "wasm").toUpperCase()}`,
            });
          }
        },
      });
      const transcribeMs = performance.now() - tTranscribe0;
      console.log("[bleep] transcribed", {
        words: words.length,
        device,
        elapsedMs: transcribeMs.toFixed(0),
      });

      /* ---------- match profanity ---------- */
      setStage("matching");
      setProcessing({ ratio: -1, detail: "Scanning for profanity" });
      const initialMatches = matchProfanity(words, {
        wordlist: DEFAULT_PROFANITY_SET,
      });
      const initialEnabled: EnabledMap = {};
      for (const m of initialMatches) initialEnabled[m.id] = true;

      console.log("[bleep] matched", {
        matchCount: initialMatches.length,
        sample: initialMatches.slice(0, 5).map((m) => `${m.range.text}@${m.range.startSec.toFixed(2)}`),
      });

      setTranscript({
        words,
        fullText,
        device,
        audioDurationSec: extract.durationSec,
        extractElapsedMs: extractMs,
        transcribeElapsedMs: transcribeMs,
      });
      setMatches(initialMatches);
      setEnabled(initialEnabled);
      setStage("reviewing");
      setView("reviewing");
    } catch (err) {
      console.error("[bleep] pipeline failed:", err);
      setError((err as Error).message ?? String(err));
      setStage("error");
      setView("error");
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));
  }, []);

  const handleAddCustom = useCallback(() => {
    const draft = normalizeWord(customDraft);
    if (!draft) {
      setCustomDraft("");
      return;
    }
    if (customWords.includes(draft)) {
      setCustomDraft("");
      return;
    }
    if (!transcript) return;

    const nextCustom = [...customWords, draft];
    setCustomWords(nextCustom);
    setCustomDraft("");

    const fresh = matchProfanity(transcript.words, {
      wordlist: DEFAULT_PROFANITY_SET,
      customWords: nextCustom,
    });

    // Carry forward enabled state from old matches; default newly-added
    // custom matches to enabled.
    const nextEnabled: EnabledMap = {};
    for (const m of fresh) {
      nextEnabled[m.id] =
        m.id in enabled ? enabled[m.id] : true;
    }
    setMatches(fresh);
    setEnabled(nextEnabled);
  }, [customDraft, customWords, enabled, transcript]);

  const handleToggleAll = useCallback((next: boolean) => {
    const update: EnabledMap = {};
    for (const m of matches) update[m.id] = next;
    setEnabled(update);
  }, [matches]);

  const handleApplyMute = useCallback(async () => {
    if (!file || !transcript) return;
    const ranges = matches
      .filter((m) => enabled[m.id] !== false)
      .map((m) => m.range);
    if (ranges.length === 0) return;

    setView("muting");
    setStage("applying-filter");
    setProcessing({ ratio: 0, detail: "Preparing audio mute filter" });
    setError(null);

    try {
      const t0 = performance.now();
      const result = await applyMute(file, ranges, {
        padSec: MUTE_PAD_SEC,
        onProgress: (p) => {
          if (p.stage === "applying-filter") {
            setStage("applying-filter");
            setProcessing({
              ratio: typeof p.ratio === "number" ? p.ratio : -1,
              detail:
                typeof p.mediaTimeSec === "number"
                  ? `Processed ${formatDuration(p.mediaTimeSec * 1000)} / ${formatDuration(transcript.audioDurationSec * 1000)}`
                  : "ffmpeg running",
            });
          } else if (p.stage === "reading-file") {
            setProcessing({ ratio: p.ratio ?? 0, detail: "Loading source file" });
          } else if (p.stage === "writing-output") {
            setStage("writing-output");
            setProcessing({ ratio: 1, detail: "Finalizing MP4" });
          }
        },
      });
      const elapsedMs = performance.now() - t0;

      const markdown = buildMuteLog({
        sourceName: file.name,
        ranges,
        audioDurationSec: transcript.audioDurationSec,
        padSec: MUTE_PAD_SEC,
      });
      const logBlob = new Blob([markdown], { type: "text/markdown" });
      const logBase = result.filename.replace(/\.mp4$/i, "") || "bleeped";

      console.log("[bleep] muted", {
        ranges: ranges.length,
        inputBytes: result.inputBytes,
        outputBytes: result.outputBytes,
        elapsedMs: elapsedMs.toFixed(0),
      });

      setMuted({
        videoUrl: URL.createObjectURL(result.blob),
        videoFilename: result.filename,
        videoSize: result.outputBytes,
        logUrl: URL.createObjectURL(logBlob),
        logFilename: `${logBase}.md`,
        appliedRanges: ranges,
        elapsedMs,
      });
      setStage("done");
      setView("muted");
    } catch (err) {
      console.error("[bleep] mute failed:", err);
      setError((err as Error).message ?? String(err));
      setStage("error");
      setView("error");
    }
  }, [file, transcript, matches, enabled]);

  // Free the Blob URLs when the muted result is replaced or unmounted.
  useEffect(() => {
    if (!muted) return;
    const { videoUrl, logUrl } = muted;
    return () => {
      URL.revokeObjectURL(videoUrl);
      URL.revokeObjectURL(logUrl);
    };
  }, [muted]);

  const handleReset = useCallback(() => {
    setView("select");
    setFile(null);
    setTranscript(null);
    setMatches([]);
    setEnabled({});
    setCustomWords([]);
    setCustomDraft("");
    setMuted(null);
    setError(null);
    setAudioDurationSec(null);
    setTranscribeDevice(null);
    setVadProgress(null);
    setProcessing({ ratio: 0 });
    setStage("idle");
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

      {(view === "processing" || view === "muting") && file && (
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
          <ProgressBar ratio={processing.ratio} />
          {processing.detail && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)] font-mono">
              {processing.detail}
            </p>
          )}
          {stage === "transcribing" && audioDurationSec && transcribeDevice && (
            <LiveInferenceStats
              elapsedMs={transcribeElapsedMs}
              audioSec={audioDurationSec}
              device={transcribeDevice}
              vad={vadProgress}
            />
          )}
          <p className="mt-3 text-[11px] text-[var(--color-text-dim)] font-mono">
            {view === "muting"
              ? "ffmpeg.wasm is stream-copying the video and re-encoding only the audio with the mute filter. Length-of-video step, not size-of-file."
              : "Phase 5 transcribes locally with whisper-base.en, matches the text against a curated wordlist, then mutes the enabled ranges with ffmpeg. First model run downloads ~80 MB; later runs are instant."}
          </p>
        </div>
      )}

      {view === "reviewing" && transcript && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-emerald-300/90 font-mono mb-2">
            Review matches
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            {matches.length === 0
              ? "No profanity detected"
              : `${matches.length} match${matches.length === 1 ? "" : "es"} found — ${enabledCount} enabled`}
          </h3>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row label="Source" value={file.name} truncate />
            <Row label="Audio" value={formatDuration(transcript.audioDurationSec * 1000)} />
            <Row label="Words" value={`${transcript.words.length.toLocaleString()}`} />
            <Row
              label="Pipeline"
              value={`${((transcript.extractElapsedMs + transcript.transcribeElapsedMs) / 1000).toFixed(1)} s · ${transcript.device.toUpperCase()}`}
            />
          </dl>

          <TranscriptView words={transcript.words} matches={matches} enabled={enabled} />

          {matches.length > 0 && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono">
                  Matches ({matches.length})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAll(true)}
                    className="text-[10px] font-mono text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
                  >
                    Enable all
                  </button>
                  <span className="text-[10px] text-[var(--color-text-dim)]">·</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    className="text-[10px] font-mono text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
                  >
                    Disable all
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white/[0.02] divide-y divide-white/[0.04]">
                {matches.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    enabled={enabled[m.id] !== false}
                    onToggle={() => handleToggle(m.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
              Add custom word
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddCustom();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                placeholder="e.g. darn"
                className="flex-1 min-w-0 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3 py-2 text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-border-strong)]"
              />
              <button
                type="submit"
                disabled={!customDraft.trim()}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </form>
            {customWords.length > 0 && (
              <p className="mt-2 text-[11px] text-[var(--color-text-dim)] font-mono">
                Custom: {customWords.join(", ")}
              </p>
            )}
          </div>

          <p className="mt-5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            Toggle matches you don&rsquo;t want muted. Phase 5 will pass the
            enabled ranges to ffmpeg as an audio mute filter, then hand back
            a clean MP4 + a timestamped log.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleApplyMute}
              disabled={enabledCount === 0}
              className="px-4 py-2.5 rounded-xl accent-gradient-bg text-sm text-[#0b0b0c] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {enabledCount === 0
                ? "Nothing to mute"
                : `Continue to mute (${enabledCount})`}
            </button>
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

      {view === "muted" && muted && file && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in">
          <div className="text-xs uppercase tracking-wider text-emerald-300/90 font-mono mb-2">
            Bleeped
          </div>
          <h3 className="text-xl font-medium tracking-tight">
            {muted.appliedRanges.length} range{muted.appliedRanges.length === 1 ? "" : "s"} muted
          </h3>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row label="Source" value={file.name} truncate />
            <Row label="Output" value={muted.videoFilename} truncate />
            <Row label="Output size" value={formatBytes(muted.videoSize)} />
            <Row label="Mute pass" value={`${(muted.elapsedMs / 1000).toFixed(1)} s`} />
          </dl>

          <video
            src={muted.videoUrl}
            controls
            preload="metadata"
            className="mt-5 w-full rounded-xl border border-[var(--color-border)] bg-black/40"
            aria-label="Preview of bleeped output"
          />

          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <a
              href={muted.videoUrl}
              download={muted.videoFilename}
              className="block rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] p-4 transition-colors group"
            >
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-1">
                Download · MP4
              </div>
              <div className="text-sm font-mono text-[var(--color-text)] truncate" title={muted.videoFilename}>
                {muted.videoFilename}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                {formatBytes(muted.videoSize)} · video copy · AAC audio
              </div>
            </a>
            <a
              href={muted.logUrl}
              download={muted.logFilename}
              className="block rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] p-4 transition-colors group"
            >
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-1">
                Download · Markdown log
              </div>
              <div className="text-sm font-mono text-[var(--color-text)] truncate" title={muted.logFilename}>
                {muted.logFilename}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                {muted.appliedRanges.length} bleep
                {muted.appliedRanges.length === 1 ? "" : "s"} with timestamps + source
              </div>
            </a>
          </div>

          <p className="mt-5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            Video stream was copied unchanged — no re-encoding, no quality
            loss. Audio was re-encoded to AAC 192k with the mute filter
            applied. Both files are generated locally in your browser.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              Bleep another file
            </button>
          </div>
        </div>
      )}

      {view === "error" && (
        <div className="glass rounded-3xl p-6 sm:p-8 fade-in border-rose-400/20">
          <div className="text-xs uppercase tracking-wider text-rose-300/90 font-mono mb-2">
            {stageLabel(stage)} failed
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

function TranscriptView({
  words,
  matches,
  enabled,
}: {
  words: TranscribedWord[];
  matches: MatchEntry[];
  enabled: EnabledMap;
}) {
  // Build a lookup: wordIdx → match (one match per word at most).
  const byIdx = useMemo(() => {
    const map = new Map<number, MatchEntry>();
    for (const m of matches) map.set(m.wordIdx, m);
    return map;
  }, [matches]);

  return (
    <div className="mt-5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
        Transcript
      </div>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3 text-sm leading-relaxed">
        {words.length === 0 && (
          <span className="italic text-[var(--color-text-dim)]">(empty)</span>
        )}
        {words.map((w, i) => {
          const match = byIdx.get(i);
          if (!match) {
            return (
              <span key={i} className="text-[var(--color-text-muted)]">
                {w.text}{" "}
              </span>
            );
          }
          const isOn = enabled[match.id] !== false;
          return (
            <span
              key={i}
              className={
                isOn
                  ? "px-1 mx-px rounded bg-rose-400/15 text-rose-200 border border-rose-400/30 font-medium"
                  : "px-1 mx-px rounded bg-white/[0.03] text-[var(--color-text-dim)] border border-white/[0.05] line-through"
              }
              title={`${match.range.startSec.toFixed(2)}–${match.range.endSec.toFixed(2)}s · ${match.range.source}`}
            >
              {w.text.trim()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MatchRow({
  match,
  enabled,
  onToggle,
}: {
  match: MatchEntry;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors">
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
      />
      <span
        className={[
          "font-mono text-sm flex-1 min-w-0 truncate",
          enabled ? "text-[var(--color-text)]" : "text-[var(--color-text-dim)] line-through",
        ].join(" ")}
      >
        {match.range.text}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[var(--color-text-dim)] whitespace-nowrap">
        {formatTimecode(match.range.startSec)}
      </span>
      <span
        className={[
          "text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap",
          match.range.source === "wordlist"
            ? "bg-amber-400/10 border border-amber-400/25 text-amber-300/90"
            : "bg-sky-400/10 border border-sky-400/25 text-sky-300/90",
        ].join(" ")}
      >
        {match.range.source}
      </span>
    </label>
  );
}

/**
 * Ticks every 500 ms while `active` is true. Resets to 0 each transition so
 * each long-running stage gets its own timer.
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
  vad: VadProgress | null;
}) {
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

function stageLabel(s: BleepStage): string {
  switch (s) {
    case "loading-engine": return "Loading ffmpeg.wasm";
    case "extracting-audio": return "Extracting audio";
    case "loading-model": return "Loading Whisper model";
    case "transcribing": return "Transcribing speech";
    case "matching": return "Matching wordlist";
    case "reviewing": return "Reviewing matches";
    case "applying-filter": return "Applying mute filter";
    case "writing-output": return "Finalizing";
    case "done": return "Done";
    case "error": return "Error";
    default: return "Working";
  }
}

function formatTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
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
