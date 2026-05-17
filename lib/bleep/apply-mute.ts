/**
 * Browser-side facade that runs the mute pass:
 *   ranges → ffmpeg filter → muted MP4 blob + filename.
 *
 * Mirrors the shape of `audio-extract.ts` so the BleepConverter component
 * doesn't have to reach into ConverterClient / ConverterEngine directly.
 */
import { getConverter } from "../converter-client";
import { buildMuteFilter, type MuteFilterOptions } from "./mute-filter";
import type { LogLine, ProgressUpdate } from "../types";
import type { BleepRange } from "./types";

export interface ApplyMuteResult {
  blob: Blob;
  filename: string;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
}

export interface ApplyMuteOptions extends MuteFilterOptions {
  onLog?: (line: LogLine) => void;
  onProgress?: (p: ProgressUpdate) => void;
}

export async function applyMute(
  file: File,
  ranges: readonly BleepRange[],
  opts: ApplyMuteOptions = {},
): Promise<ApplyMuteResult> {
  const filter = buildMuteFilter(ranges, { padSec: opts.padSec });
  if (!filter) {
    throw new Error("No mute ranges to apply");
  }

  const client = getConverter();
  await client.load({ onLog: opts.onLog });
  return client.applyAudioMuteFilter(
    file,
    { filter },
    { onLog: opts.onLog, onProgress: opts.onProgress },
  );
}
