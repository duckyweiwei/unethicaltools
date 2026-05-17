import type {
  ConversionResult,
  LogLine,
  ProgressUpdate,
} from "./types";
import type { FormatConfig } from "./formats";
import { isDesktop } from "./desktop-bridge";

export interface ConverterCallbacks {
  onProgress?: (p: ProgressUpdate) => void;
  onLog?: (line: LogLine) => void;
}

/**
 * Runtime-aware facade. In the browser it lazy-imports the WASM engine; in
 * Tauri it lazy-imports the native IPC engine. Both expose identical
 * load/convert/dispose surfaces so the React UI is environment-agnostic.
 *
 * The lazy split also keeps the engine code out of the landing chunk —
 * neither engine module is parsed until the user clicks Convert.
 */

type AnyEngine = {
  load(cb?: ConverterCallbacks): Promise<void>;
  convert(
    file: File,
    formatOrOptions: FormatConfig | { format: FormatConfig },
    cb?: ConverterCallbacks,
  ): Promise<ConversionResult>;
  /**
   * Optional — only the WASM engine implements it (the desktop engine has no
   * use for it; bleep tool runs only in the browser since whisper-tiny needs
   * the WASM/WebGPU runtime). Returning unknown lets us skip the type
   * gymnastics across the engine union.
   */
  extractAudioForWhisper?: (
    file: File,
    cb?: ConverterCallbacks,
  ) => Promise<{ pcm: Float32Array; sampleRate: 16000; durationSec: number }>;
  /** Browser-only — same reason as extractAudioForWhisper. */
  applyAudioMuteFilter?: (
    file: File,
    options: { filter: string },
    cb?: ConverterCallbacks,
  ) => Promise<{ blob: Blob; filename: string; durationMs: number; inputBytes: number; outputBytes: number }>;
  dispose(): void;
};

export class ConverterClient {
  private enginePromise: Promise<AnyEngine> | null = null;
  private engineInstance: AnyEngine | null = null;

  private async ensureEngine(): Promise<AnyEngine> {
    if (this.engineInstance) return this.engineInstance;
    if (!this.enginePromise) {
      this.enginePromise = isDesktop()
        ? import("./desktop-engine").then((m) => new m.DesktopEngine() as AnyEngine)
        : import("./converter-engine").then(
            (m) => new m.ConverterEngine() as AnyEngine,
          );
    }
    this.engineInstance = await this.enginePromise;
    return this.engineInstance;
  }

  async load(cb: ConverterCallbacks = {}): Promise<void> {
    const engine = await this.ensureEngine();
    await engine.load(cb);
  }

  async convert(
    file: File,
    format: FormatConfig,
    cb: ConverterCallbacks = {},
  ): Promise<ConversionResult> {
    const engine = await this.ensureEngine();
    // Both engines accept either shape — DesktopEngine expects { format },
    // ConverterEngine accepts the same. Pass through as object form for
    // consistency.
    return engine.convert(file, { format }, cb);
  }

  /**
   * Extract audio for Whisper. Browser-only — throws if called inside the
   * Tauri desktop app since the bleep tool ships browser-first.
   */
  async extractAudioForWhisper(
    file: File,
    cb: ConverterCallbacks = {},
  ): Promise<{ pcm: Float32Array; sampleRate: 16000; durationSec: number }> {
    const engine = await this.ensureEngine();
    if (!engine.extractAudioForWhisper) {
      throw new Error("Audio extraction is not supported on this runtime");
    }
    return engine.extractAudioForWhisper(file, cb);
  }

  /**
   * Apply an ffmpeg audio-only mute filter to `file`. Browser-only.
   * Caller builds the filter via `buildMuteFilter()` from
   * lib/bleep/mute-filter.
   */
  async applyAudioMuteFilter(
    file: File,
    options: { filter: string },
    cb: ConverterCallbacks = {},
  ) {
    const engine = await this.ensureEngine();
    if (!engine.applyAudioMuteFilter) {
      throw new Error("Audio mute filtering is not supported on this runtime");
    }
    return engine.applyAudioMuteFilter(file, options, cb);
  }

  dispose(): void {
    this.engineInstance?.dispose();
    this.engineInstance = null;
    this.enginePromise = null;
  }

  /** Has the ffmpeg.wasm engine been loaded in this session yet? */
  isLoaded(): boolean {
    return this.engineInstance !== null;
  }
}

let singleton: ConverterClient | null = null;
export function getConverter(): ConverterClient {
  if (!singleton) singleton = new ConverterClient();
  return singleton;
}
