export type ConversionMode = "remux" | "encode";

export type Stage =
  | "idle"
  | "loading-engine"
  | "reading-file"
  | "remuxing"
  | "encoding"
  | "applying-filter"
  | "writing-output"
  | "done"
  | "error";

export interface ProgressUpdate {
  stage: Stage;
  /** 0–1 of current ffmpeg pass */
  ratio: number;
  /** Current media time processed (seconds) */
  mediaTimeSec?: number;
}

export interface ConversionResult {
  mode: ConversionMode;
  /**
   * Browser mode: the converted MP4 as a Blob, served via Object URL for
   * download. Desktop mode: an empty placeholder — the real bytes live on
   * disk at `outputPath`, which ResultView uses for the Save flow.
   */
  blob: Blob;
  filename: string;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  /**
   * Desktop only: absolute path to the converted file on disk (in the OS
   * temp dir). When set, ResultView shows a "Save MP4…" button that opens
   * a native save dialog and copies this file to the chosen destination.
   */
  outputPath?: string;
}

export type LogLine = {
  ts: number;
  level: "info" | "warn" | "error" | "ffmpeg";
  message: string;
};

