/**
 * Browser-side Whisper transcription facade.
 *
 * All real work happens in a Web Worker (`whisper.worker.ts`). This module
 * spawns/reuses the worker and relays messages so the rest of the app sees
 * the same `transcribeToWords(pcm, opts) → Promise<TranscribeResult>` API
 * regardless of where inference runs. The worker keeps the main thread
 * free so the UI doesn't jank during multi-minute inference passes.
 *
 * The model id is part of the worker's identity — switching the picker
 * terminates and respawns the worker so the old WebGPU session (and the
 * old, no-longer-wanted ONNX model) is released. Same-model repeat calls
 * reuse the existing worker, so the model only loads once per session.
 */
import type { TranscribedWord } from "./types";
import { MODEL_IDS, type WhisperModelChoice } from "./model-pref";

/**
 * Progress events surfaced to the UI:
 *   - `loading`: model download/init. Real progress from transformers.js's
 *     `progress_total` event.
 *   - `ready`: model loaded; carries device + cache-hit flag.
 *   - `vad-done`: speech regions detected.
 *   - `transcribing`: per-region inference progress.
 *   - `done`: pipeline complete.
 */
export type WhisperProgress =
  | { kind: "loading"; ratio: number; file?: string; loadedBytes?: number; totalBytes?: number }
  | { kind: "ready"; device: "webgpu" | "wasm"; fromCache: boolean }
  | { kind: "vad-done"; totalRegions: number; speechSec: number; totalSec: number; speechFraction: number }
  | { kind: "transcribing"; region: number; totalRegions: number; regionStartSec: number; regionEndSec: number }
  | { kind: "done" };

export interface TranscribeOptions {
  onProgress?: (p: WhisperProgress) => void;
  /** Opt out of VAD even on long audio. Default: VAD on for audio ≥ 30 s. */
  disableVad?: boolean;
  /** Which Whisper size to use. Default 'base' (most accurate of our two). */
  model?: WhisperModelChoice;
}

export interface TranscribeResult {
  words: TranscribedWord[];
  fullText: string;
  device: "webgpu" | "wasm";
  vad?: { totalRegions: number; speechSec: number; totalSec: number; speechFraction: number };
}

let workerInstance: Worker | null = null;
let workerModelId: string | null = null;

/**
 * Spawn a worker, or reuse the existing one when the model is unchanged.
 * Different model ⇒ terminate old worker (clearing its WebGPU session)
 * and spin up a fresh one.
 */
function getWorker(modelId: string): Worker {
  if (workerInstance && workerModelId === modelId) return workerInstance;
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  // `new URL(...) + { type: 'module' }` is the Next.js / webpack 5 way of
  // bundling a Web Worker. The dev server compiles whisper.worker.ts as a
  // separate chunk and serves it from a blob: URL.
  workerInstance = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
    type: "module",
  });
  workerModelId = modelId;
  return workerInstance;
}

export async function transcribeToWords(
  pcm: Float32Array,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const modelId = MODEL_IDS[opts.model ?? "base"];
  const worker = getWorker(modelId);

  // Transfer the caller's buffer directly (not a copy). For a 34-min file
  // this saves ~130 MB of transient main-thread allocation. The caller's
  // Float32Array view becomes detached after this — that's safe because by
  // contract `transcribeToWords` consumes the PCM, callers don't reuse it.
  return new Promise<TranscribeResult>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type: string; payload: unknown };
      switch (data.type) {
        case "progress":
          opts.onProgress?.(data.payload as WhisperProgress);
          return;
        case "result":
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          resolve(data.payload as TranscribeResult);
          return;
        case "error":
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          reject(new Error((data.payload as { message: string }).message));
          return;
      }
    };
    const onError = (ev: ErrorEvent) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      reject(new Error(`Whisper worker crashed: ${ev.message || "unknown"}`));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage(
      {
        type: "transcribe",
        payload: { pcm, modelId, disableVad: !!opts.disableVad },
      },
      [pcm.buffer],
    );
  });
}

/**
 * Terminate the Whisper worker, releasing its WebGPU session and the
 * in-memory ONNX model. The next `transcribeToWords` call cold-loads the
 * pipeline again (but model files come from the browser's HTTP cache, so
 * it's seconds — not the original ~80 MB download).
 *
 * Call this when the user is done with the tool, or wire to a UI button
 * so they can free GPU + heap explicitly. Returns whether anything was
 * actually disposed (so the UI can skip showing the control if nothing
 * is loaded yet).
 */
export function disposeWhisper(): boolean {
  if (!workerInstance) return false;
  workerInstance.terminate();
  workerInstance = null;
  workerModelId = null;
  return true;
}

export function isWhisperLoaded(): boolean {
  return workerInstance !== null;
}
