import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type {
  ConversionMode,
  ConversionResult,
  LogLine,
  ProgressUpdate,
  Stage,
} from "./types";
import type { FormatConfig } from "./formats";

/**
 * Runs ffmpeg.wasm directly. FFmpeg internally spawns its own Worker for the
 * heavy decode/encode work, so the UI thread is not blocked during conversion.
 *
 * The engine is format-agnostic: pass a FormatConfig (from lib/formats.ts) and
 * it picks the right input extension and remux args. The output is always MP4.
 * Adding a new input format = adding an entry in FORMATS — no engine changes.
 */

const FFMPEG_VERSION = "0.12.10";
const CORE_MT_BASE = `https://unpkg.com/@ffmpeg/core-mt@${FFMPEG_VERSION}/dist/esm`;
const CORE_ST_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_VERSION}/dist/esm`;

/**
 * The FFmpeg class spawns its own internal Web Worker. When that worker file
 * is bundled by Webpack/Turbopack, the dynamic `import(coreURL)` it contains
 * gets replaced with a require() stub that throws at runtime ("Cannot find
 * module 'blob:...'"). To prevent bundling, we serve the FFmpeg class worker
 * from `/public/ffmpeg/worker.js` and tell FFmpeg.load() to use it directly.
 * Must be an absolute URL — `import.meta.url` is rewritten by the bundler to
 * a `file://` URL, so a leading `/` would resolve to `file:///ffmpeg/...`.
 */
function getClassWorkerURL(): string {
  return `${self.location.origin}/ffmpeg/worker.js`;
}

const OUTPUT = "output.mp4";

export interface EngineCallbacks {
  onLog?: (line: LogLine) => void;
  onProgress?: (p: ProgressUpdate) => void;
}

export interface ConvertOptions {
  /** Source format descriptor. Determines MEMFS filename + remux args. */
  format: FormatConfig;
}

function deriveOutputName(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, "") || "video";
  return `${base}.mp4`;
}

export class ConverterEngine {
  private ffmpeg: FFmpeg | null = null;
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;
  private logHandlers = new Set<(l: LogLine) => void>();
  private active: { cb: EngineCallbacks } | null = null;

  /* ---------- engine load ---------- */

  load(cb: EngineCallbacks = {}): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.loadingPromise) {
      if (cb.onLog) this.logHandlers.add(cb.onLog);
      return this.loadingPromise;
    }

    if (cb.onLog) this.logHandlers.add(cb.onLog);
    this.loadingPromise = this.doLoad().finally(() => {
      this.loadingPromise = null;
    });
    return this.loadingPromise;
  }

  private emitLog(level: LogLine["level"], message: string) {
    const line: LogLine = { ts: Date.now(), level, message };
    for (const h of this.logHandlers) h(line);
    this.active?.cb.onLog?.(line);
  }

  private async doLoad(): Promise<void> {
    this.ffmpeg = new FFmpeg();
    this.ffmpeg.on("log", ({ message }) => {
      this.emitLog("ffmpeg", message);
      this.active?.cb.onLog?.({ ts: Date.now(), level: "ffmpeg", message });
    });

    const hasSAB =
      typeof SharedArrayBuffer !== "undefined" &&
      (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;

    if (hasSAB) {
      try {
        this.emitLog("info", "Loading ffmpeg (multi-thread)…");
        await this.ffmpeg.load({
          classWorkerURL: getClassWorkerURL(),
          coreURL: await toBlobURL(`${CORE_MT_BASE}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${CORE_MT_BASE}/ffmpeg-core.wasm`, "application/wasm"),
          workerURL: await toBlobURL(
            `${CORE_MT_BASE}/ffmpeg-core.worker.js`,
            "text/javascript",
          ),
        });
        this.loaded = true;
        this.emitLog("info", "ffmpeg ready (multi-thread)");
        return;
      } catch (err) {
        this.emitLog(
          "warn",
          `MT load failed (${(err as Error).message}); falling back to single-thread`,
        );
      }
    } else {
      this.emitLog("warn", "SharedArrayBuffer unavailable; using single-thread core");
    }

    this.emitLog("info", "Loading ffmpeg (single-thread)…");
    await this.ffmpeg.load({
      classWorkerURL: getClassWorkerURL(),
      coreURL: await toBlobURL(`${CORE_ST_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_ST_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    this.loaded = true;
    this.emitLog("info", "ffmpeg ready (single-thread)");
  }

  /* ---------- conversion pipeline ---------- */

  private attachProgress(stage: "remuxing" | "encoding") {
    const ff = this.ffmpeg!;
    const handler = ({ progress, time }: { progress: number; time: number }) => {
      const ratio = Math.max(0, Math.min(1, progress));
      this.active?.cb.onProgress?.({
        stage,
        ratio,
        mediaTimeSec: Number.isFinite(time) ? time / 1_000_000 : undefined,
      });
    };
    ff.on("progress", handler);
    return () => ff.off("progress", handler);
  }

  private async runRemux(format: FormatConfig, inputName: string): Promise<number> {
    this.active?.cb.onProgress?.({ stage: "remuxing", ratio: 0 });
    const detach = this.attachProgress("remuxing");
    try {
      // Only map video + audio streams (the `?` suffix makes each mapping
      // optional so audio-less or video-less inputs still succeed). MPEG-TS
      // commonly carries extra data streams like timed_id3, KLV, or SCTE-35
      // cues that MP4 doesn't accept — including them via `-map 0` causes a
      // hard-fail of the remux and forces a needless re-encode.
      return await this.ffmpeg!.exec([
        "-i", inputName,
        "-map", "0:v?",
        "-map", "0:a?",
        "-c", "copy",
        ...format.remuxExtraArgs,
        "-movflags", "+faststart",
        "-f", "mp4",
        OUTPUT,
      ]);
    } finally {
      detach();
    }
  }

  private async runEncode(inputName: string): Promise<number> {
    this.active?.cb.onProgress?.({ stage: "encoding", ratio: 0 });
    const detach = this.attachProgress("encoding");
    try {
      return await this.ffmpeg!.exec([
        "-i", inputName,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-f", "mp4",
        OUTPUT,
      ]);
    } finally {
      detach();
    }
  }

  private async tryReadOutput(): Promise<Uint8Array | null> {
    try {
      const data = await this.ffmpeg!.readFile(OUTPUT);
      if (typeof data === "string") return null;
      return data as Uint8Array;
    } catch {
      return null;
    }
  }

  private async cleanup(inputName: string) {
    for (const f of [inputName, OUTPUT]) {
      try {
        await this.ffmpeg!.deleteFile(f);
      } catch {
        /* ignore */
      }
    }
  }

  async convert(
    file: File,
    options: ConvertOptions,
    cb: EngineCallbacks = {},
  ): Promise<ConversionResult> {
    if (this.active) throw new Error("A conversion is already in progress");
    if (!this.loaded) await this.load(cb);
    if (!this.ffmpeg) throw new Error("Engine not loaded");

    this.active = { cb };
    const startedAt = performance.now();
    const inputBytes = file.size;
    const inputName = `input.${options.format.ffmpegInputExt}`;

    try {
      this.emitStage(cb, "reading-file", 0);
      const bytes = await fetchFile(file);
      await this.ffmpeg.writeFile(inputName, bytes);
      this.emitStage(cb, "reading-file", 1);

      // For formats we know never remux successfully (e.g. webm/mpeg), skip
      // straight to encode — saves the user 1–3 seconds of false-start time.
      const shouldTryRemux = options.format.remuxLikelihood !== "none";

      let mode: ConversionMode = "remux";
      let code = -1;
      let out: Uint8Array | null = null;

      if (shouldTryRemux) {
        code = await this.runRemux(options.format, inputName);
        out = code === 0 ? await this.tryReadOutput() : null;
      } else {
        this.emitLog(
          "info",
          `${options.format.displayName} codecs aren't valid in MP4 — going straight to encode.`,
        );
      }

      if (!out || out.byteLength < 1024) {
        if (shouldTryRemux) {
          this.emitLog(
            "warn",
            `Remux did not produce a valid MP4 (exit=${code}); re-encoding…`,
          );
          try {
            await this.ffmpeg.deleteFile(OUTPUT);
          } catch {
            /* may not exist */
          }
        }
        mode = "encode";
        code = await this.runEncode(inputName);
        out = code === 0 ? await this.tryReadOutput() : null;
        if (!out || out.byteLength < 1024) {
          throw new Error(
            `Conversion failed (encoder exit=${code}). The file may be corrupt or use an unsupported codec.`,
          );
        }
      }

      this.emitStage(cb, "writing-output", 1);

      const buffer = (out.buffer as ArrayBuffer).slice(
        out.byteOffset,
        out.byteOffset + out.byteLength,
      );
      const blob = new Blob([buffer], { type: "video/mp4" });

      return {
        mode,
        blob,
        filename: deriveOutputName(file),
        durationMs: performance.now() - startedAt,
        inputBytes,
        outputBytes: blob.size,
      };
    } finally {
      this.active = null;
      await this.cleanup(inputName);
    }
  }

  private emitStage(cb: EngineCallbacks, stage: Stage, ratio: number) {
    cb.onProgress?.({ stage, ratio });
  }

  dispose() {
    try {
      this.ffmpeg?.terminate();
    } catch {
      /* noop */
    }
    this.ffmpeg = null;
    this.loaded = false;
    this.loadingPromise = null;
    this.logHandlers.clear();
    this.active = null;
  }
}

let singleton: ConverterEngine | null = null;
export function getEngine(): ConverterEngine {
  if (!singleton) singleton = new ConverterEngine();
  return singleton;
}
