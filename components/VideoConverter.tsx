"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getConverter } from "@/lib/converter-client";
import type { ConversionResult, LogLine, Stage } from "@/lib/types";
import { estimateEta } from "@/lib/format";
import type { FormatConfig } from "@/lib/formats";
import { detectFormatFromFile } from "@/lib/formats";
import { DropZone } from "./DropZone";
import { FilePreview } from "./FilePreview";
import { ProgressView } from "./ProgressView";
import { ResultView } from "./ResultView";
import { ErrorView } from "./ErrorView";
import { OversizedFileNotice } from "./OversizedFileNotice";
import { MemoryErrorView } from "./MemoryErrorView";
import { isDesktop } from "@/lib/desktop-bridge";

/** Cheap MIME-type guess for display purposes only — ffmpeg doesn't care. */
function guessMimeFromExt(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "video/mp2t",
    mts: "video/mp2t",
    m2ts: "video/mp2t",
    mov: "video/quicktime",
    qt: "video/quicktime",
    mkv: "video/x-matroska",
    webm: "video/webm",
    avi: "video/x-msvideo",
    flv: "video/x-flv",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
    mp4: "video/mp4",
    m4v: "video/mp4",
  };
  return map[ext] ?? "video/*";
}

/**
 * Hard browser ceiling: 32-bit WASM addressing = 4 GB. The desktop app uses
 * native ffmpeg with no such limit, so we only enforce this in the browser.
 */
const BROWSER_HARD_LIMIT = 4 * 1024 ** 3;

type View = "select" | "selected" | "converting" | "done" | "error" | "memory-error";

/**
 * Distinguishes a browser-memory failure (RangeError, ArrayBuffer allocation,
 * WASM out-of-memory) from a regular ffmpeg error. These get a different
 * error screen that routes the user to the desktop app instead of suggesting
 * "the file may use an unusual codec" — which is misleading for an OOM.
 */
function isMemoryError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message?.toLowerCase() ?? "";
  return (
    err.name === "RangeError" ||
    msg.includes("array buffer allocation") ||
    msg.includes("memory.grow") ||
    msg.includes("out of memory") ||
    msg.includes("maximum supported size")
  );
}

export interface VideoConverterProps {
  /** Input format for this page. Determines accept= filter + ffmpeg args. */
  inputFormat: FormatConfig;
  /** Always "mp4" today, but kept explicit so the engine can grow. */
  outputFormat?: "mp4";
  /**
   * Generic mode (desktop app): present as a universal converter rather than
   * a format-specific one. Format is auto-detected from the dropped file.
   */
  genericMode?: boolean;
}

/**
 * The shared, format-agnostic conversion UI used by every /[converter] page.
 *
 * State machine: select → selected → converting → (done | error).
 * The conversion engine itself is lazy-loaded on first Convert click via
 * ConverterClient, so first-paint of the page stays light.
 */
export function VideoConverter({
  inputFormat,
  genericMode = false,
}: VideoConverterProps) {
  const [view, setView] = useState<View>("select");
  const [file, setFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<FormatConfig | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [ratio, setRatio] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startedAtRef = useRef<number>(0);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    if (view !== "converting") return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [view]);

  // Native Tauri drag-drop. The standard HTML5 ondrop event doesn't fire
  // inside Tauri webviews — the OS sends drops to Tauri's own event channel.
  // We bridge that here: convert a native file path into a File-like with
  // `.path` set, then route through the same handleFile() the click-to-browse
  // and HTML5 drop paths use. The listener is always armed; it just no-ops
  // when the converter isn't in the "select" view.
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    (async () => {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      const fs = await import("@tauri-apps/plugin-fs");
      unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
        if (cancelled) return;
        if (event.payload.type !== "drop") return;
        const path = event.payload.paths?.[0];
        if (!path) return;
        // Statting the file gives us a real size for the FilePreview readout;
        // failure is non-fatal — we just show 0 bytes.
        let size = 0;
        let lastModified = Date.now();
        try {
          const s = await fs.stat(path);
          size = Number(s.size ?? 0);
          if (s.mtime) lastModified = new Date(s.mtime).getTime();
        } catch {
          /* metadata lookup failed; continue with defaults */
        }
        const name = path.split(/[\\/]/).pop() ?? "video";
        // File-like object: real File constructors don't accept a path, so we
        // shape a plain object that has the same surface VideoConverter reads
        // (name, size, type, lastModified) plus `.path` for the desktop engine
        // to use directly. The arrayBuffer() is a never-call placeholder.
        const native = {
          name,
          size,
          type: guessMimeFromExt(name),
          lastModified,
          path,
          arrayBuffer: () =>
            Promise.reject(new Error("native file — read by ffmpeg directly")),
          slice: () => new Blob(),
          stream: () => new ReadableStream({ start: (c) => c.close() }),
          text: () => Promise.resolve(""),
          webkitRelativePath: "",
        } as unknown as File;
        handleFile(native);
      });
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
    // handleFile is stable (defined below with useCallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendLog = useCallback((line: LogLine) => {
    setLogs((prev) => {
      const next = prev.length >= 500 ? prev.slice(-499) : prev;
      return [...next, line];
    });
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      // If the dropped file is a recognized format different from the page's
      // expected input (e.g. user landed on /mkv-to-mp4 but dragged a .mov),
      // we still convert — using the detected format takes precedence over
      // the page's declared input. Cross-format users get the right pipeline.
      const detected = detectFormatFromFile(f);
      setDetectedFormat(detected ?? inputFormat);
      setView("selected");
      setLogs([]);
      setResult(null);
      setErrorMessage(null);
      setStage("idle");
      setRatio(0);
    },
    [inputFormat],
  );

  const handleConvert = useCallback(async () => {
    if (!file) return;
    setView("converting");
    setLogs([]);
    setRatio(0);
    setStage("loading-engine");
    startedAtRef.current = Date.now();

    try {
      const formatToUse = detectedFormat ?? inputFormat;
      const converter = getConverter();
      await converter.load({ onLog: appendLog });
      const r = await converter.convert(file, formatToUse, {
        onLog: appendLog,
        onProgress: ({ stage, ratio }) => {
          setStage(stage);
          setRatio(ratio);
        },
      });
      setResult(r);
      setStage("done");
      setRatio(1);
      setView("done");
    } catch (err) {
      const e = err as Error;
      const msg =
        (e && typeof e.message === "string" && e.message) ||
        String(e) ||
        "Unknown error";
      setErrorMessage(msg);
      setStage("error");
      // Memory failures need a different screen — they can't be solved by
      // "try a different file" of the same size, and the codec hint in the
      // generic ErrorView is actively misleading.
      setView(isMemoryError(err) ? "memory-error" : "error");
    }
  }, [file, detectedFormat, inputFormat, appendLog]);

  const handleReset = useCallback(() => {
    setFile(null);
    setDetectedFormat(null);
    setView("select");
    setLogs([]);
    setResult(null);
    setErrorMessage(null);
    setStage("idle");
    setRatio(0);
  }, []);

  const elapsedMs =
    view === "converting" ? Math.max(0, Date.now() - startedAtRef.current) : 0;
  const etaMs =
    view === "converting" ? estimateEta(startedAtRef.current, ratio) : null;
  void nowTick;

  const formatForUI = detectedFormat ?? inputFormat;

  return (
    <section
      id="converter"
      className="mx-auto max-w-3xl px-4 sm:px-6"
      aria-live="polite"
    >
      {view === "select" && (
        <DropZone
          onFile={handleFile}
          inputFormat={inputFormat}
          genericMode={genericMode}
        />
      )}

      {view === "selected" &&
        file &&
        !isDesktop() &&
        file.size >= BROWSER_HARD_LIMIT && (
          <OversizedFileNotice
            file={file}
            format={formatForUI}
            onClear={handleReset}
            hardLimitBytes={BROWSER_HARD_LIMIT}
          />
        )}

      {view === "selected" &&
        file &&
        (isDesktop() || file.size < BROWSER_HARD_LIMIT) && (
          <FilePreview
            file={file}
            format={formatForUI}
            pageFormat={inputFormat}
            onClear={handleReset}
            onConvert={handleConvert}
          />
        )}

      {view === "converting" && (
        <ProgressView
          stage={stage}
          ratio={ratio}
          etaMs={etaMs}
          elapsedMs={elapsedMs}
          logs={logs}
          mode={
            stage === "encoding"
              ? "encode"
              : stage === "remuxing"
                ? "remux"
                : null
          }
        />
      )}

      {view === "done" && result && (
        <ResultView result={result} onReset={handleReset} />
      )}

      {view === "error" && (
        <ErrorView
          message={errorMessage ?? "Unknown error"}
          onReset={handleReset}
          onRetry={handleConvert}
        />
      )}

      {view === "memory-error" && file && (
        <MemoryErrorView
          file={file}
          format={formatForUI}
          rawError={errorMessage ?? "Unknown allocation error"}
          onReset={handleReset}
          onRetry={handleConvert}
        />
      )}
    </section>
  );
}
