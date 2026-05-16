/**
 * Extract a video file's audio track to 16 kHz mono Float32 PCM via the
 * shared ffmpeg.wasm engine. Output is the exact format Whisper consumes.
 *
 * Reuses the same ConverterClient singleton the video converter uses, so
 * ffmpeg only loads once even if a user uses both tools in the same session.
 */
import { getConverter } from "../converter-client";
import type { LogLine } from "../types";

export interface ExtractResult {
  pcm: Float32Array;
  sampleRate: 16000;
  durationSec: number;
}

export interface ExtractCallbacks {
  onLog?: (line: LogLine) => void;
  onProgress?: (ratio: number) => void;
}

export async function extractAudio(
  file: File,
  cb: ExtractCallbacks = {},
): Promise<ExtractResult> {
  const client = getConverter();
  await client.load({ onLog: cb.onLog });
  return client.extractAudioForWhisper(file, {
    onLog: cb.onLog,
    onProgress: (p) => {
      if (cb.onProgress && typeof p.ratio === "number") cb.onProgress(p.ratio);
    },
  });
}
