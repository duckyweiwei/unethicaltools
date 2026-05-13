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

  dispose(): void {
    this.engineInstance?.dispose();
    this.engineInstance = null;
    this.enginePromise = null;
  }
}

let singleton: ConverterClient | null = null;
export function getConverter(): ConverterClient {
  if (!singleton) singleton = new ConverterClient();
  return singleton;
}
