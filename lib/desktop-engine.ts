import type {
  ConversionResult,
  LogLine,
  ProgressUpdate,
  Stage,
} from "./types";
import type { FormatConfig } from "./formats";
import { getTauriApis } from "./desktop-bridge";

/**
 * Desktop counterpart to ConverterEngine. Runs native ffmpeg via Tauri IPC
 * and writes the output to a temp file on disk — never holds it in JS memory.
 *
 * UX flow (different from browser):
 *  1. user drops or picks a file
 *  2. we convert directly to a temp path under $TEMP
 *  3. ResultView shows "Save MP4…" — the actual save is deferred to the user
 *     (native save dialog → copy from temp to chosen destination)
 *
 * This mirrors how native apps handle exports — no upfront commitment to a
 * save location, no auto-write to a guess of where they wanted it.
 */

export interface DesktopEngineCallbacks {
  onLog?: (line: LogLine) => void;
  onProgress?: (p: ProgressUpdate) => void;
}

interface ConvertEventPayload {
  stage: "remuxing" | "encoding" | "done";
  mediaTimeSec?: number;
}

interface LogEventPayload {
  level: "info" | "warn" | "error" | "ffmpeg";
  message: string;
}

interface ConvertResultPayload {
  mode: "remux" | "encode";
  outputPath: string;
  durationMs: number;
}

export class DesktopEngine {
  private loaded = true;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async load(_cb: DesktopEngineCallbacks = {}): Promise<void> {
    // Native ffmpeg sidecar — no engine to load.
  }

  async convert(
    file: File,
    options: { format: FormatConfig },
    cb: DesktopEngineCallbacks = {},
  ): Promise<ConversionResult> {
    if (!this.loaded) throw new Error("Engine not loaded");
    const { invoke, listen } = await getTauriApis();

    // Get the input path — either native (dropped via Tauri's drag-drop event,
    // which attaches `.path` to the File) or staged to disk via plugin-fs.
    const inputPath = await stageFileToDisk(file);

    // Output goes to a deterministic temp path — never asks the user where to
    // save here. The user picks a destination via the Save dialog only after
    // conversion succeeds (handled by ResultView).
    const { tempDir, join } = await import("@tauri-apps/api/path");
    const dir = await tempDir();
    const baseName =
      file.name.replace(/\.[^.]+$/, "") || `video-${Date.now()}`;
    const outputPath = await join(dir, `localvc-out-${Date.now()}-${baseName}.mp4`);

    const stageMap: Record<string, Stage> = {
      remuxing: "remuxing",
      encoding: "encoding",
      done: "writing-output",
    };

    const unsubProgress = await listen<ConvertEventPayload>(
      "ffmpeg-progress",
      ({ payload }) => {
        cb.onProgress?.({
          stage: stageMap[payload.stage] ?? "remuxing",
          ratio: 0,
          mediaTimeSec: payload.mediaTimeSec,
        });
      },
    );
    const unsubLog = await listen<LogEventPayload>(
      "ffmpeg-log",
      ({ payload }) => {
        cb.onLog?.({ ts: Date.now(), level: payload.level, message: payload.message });
      },
    );

    try {
      cb.onProgress?.({ stage: "reading-file", ratio: 1 });
      const result = await invoke<ConvertResultPayload>("convert_video", {
        args: {
          inputPath,
          outputPath,
          formatId: options.format.id,
          tryRemux: options.format.remuxLikelihood !== "none",
        },
      });

      cb.onProgress?.({ stage: "writing-output", ratio: 1 });

      // Read the actual file size from disk so ResultView shows accurate stats.
      let outputBytes = 0;
      try {
        const { stat } = await import("@tauri-apps/plugin-fs");
        const s = await stat(result.outputPath);
        outputBytes = Number(s.size ?? 0);
      } catch {
        /* non-fatal — display will fall back to "—" */
      }

      const filename = `${baseName}.mp4`;
      // Browser ResultView creates Object URLs from this blob; desktop view
      // ignores the blob and shows Save/Open buttons using outputPath instead.
      const placeholderBlob = new Blob([], { type: "video/mp4" });

      return {
        mode: result.mode,
        blob: placeholderBlob,
        filename,
        durationMs: result.durationMs,
        inputBytes: file.size,
        outputBytes,
        outputPath: result.outputPath,
      };
    } finally {
      unsubProgress();
      unsubLog();
    }
  }

  dispose() {
    /* Per-job processes; nothing to clean. */
  }
}

/**
 * Write the browser File's bytes to a temp path the native side can read.
 *
 * Tauri's native drag-drop attaches a `path` property to dropped File objects
 * — when present, we skip the copy entirely and pass the original path to
 * ffmpeg, which is dramatically faster for large files.
 */
async function stageFileToDisk(file: File): Promise<string> {
  const maybePath = (file as unknown as { path?: string }).path;
  if (typeof maybePath === "string" && maybePath.length > 0) {
    return maybePath;
  }
  const [{ writeFile }, { tempDir, join }] = await Promise.all([
    import("@tauri-apps/plugin-fs"),
    import("@tauri-apps/api/path"),
  ]);
  const dir = await tempDir();
  const dest = await join(dir, `localvc-in-${Date.now()}-${file.name}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(dest, bytes);
  return dest;
}
