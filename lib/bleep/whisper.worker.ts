/// <reference lib="webworker" />
/**
 * Whisper inference Web Worker. Owns the transformers.js pipeline + VAD
 * pre-filter so the main thread is never blocked by inference. The main
 * thread only sees:
 *
 *   main → worker:  { type: 'transcribe', pcm, modelId, disableVad }
 *   worker → main:  { type: 'progress', payload: WhisperProgress }
 *                   { type: 'result',   payload: TranscribeResult }
 *                   { type: 'error',    payload: { message: string } }
 *
 * The Float32Array PCM is transferred (not copied) on postMessage so even
 * a 130 MB audio buffer (≈34 min @ 16 kHz mono float32) doesn't double
 * memory. After transfer the main thread's PCM view is detached, which is
 * fine — by then we've already handed it off to inference.
 *
 * Pipeline cache lives in the worker for the worker's lifetime: switching
 * model in the picker terminates and re-spawns the worker from the caller
 * side, which clears the (now unreachable) WebGPU session.
 */
import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";
import { detectSpeechRegions } from "./vad";
import type { TranscribedWord } from "./types";

const SAMPLE_RATE = 16000;
const MIN_VAD_DURATION_SEC = 30;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let device: "webgpu" | "wasm" = "wasm";
let loadedModelId: string | null = null;

function post(message: { type: string; payload: unknown }, transfer: Transferable[] = []) {
  ctx.postMessage(message, transfer);
}

function postProgress(payload: unknown) {
  post({ type: "progress", payload });
}

async function detectDevice(): Promise<"webgpu" | "wasm"> {
  const gpu = (ctx.navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return "wasm";
  try {
    const adapter = await gpu.requestAdapter();
    return adapter ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

async function ensurePipeline(modelId: string): Promise<void> {
  if (asr && loadedModelId === modelId) return;

  // Different model than last time (or first load) — re-init.
  asr = null;
  loadedModelId = null;
  device = await detectDevice();

  let sawDownloadProgress = false;
  const built = await pipeline("automatic-speech-recognition", modelId, {
    device,
    progress_callback: (info: ProgressInfo) => {
      if (info.status === "progress_total") {
        sawDownloadProgress = true;
        postProgress({
          kind: "loading",
          ratio: clamp01(info.progress / 100),
          loadedBytes: info.loaded,
          totalBytes: info.total,
        });
      } else if (info.status === "progress") {
        sawDownloadProgress = true;
        postProgress({
          kind: "loading",
          ratio: clamp01(info.progress / 100),
          file: info.file,
          loadedBytes: info.loaded,
          totalBytes: info.total,
        });
      } else if (info.status === "ready") {
        postProgress({ kind: "ready", device, fromCache: !sawDownloadProgress });
      }
    },
  });
  asr = built;
  loadedModelId = modelId;
}

interface TranscribeRequest {
  pcm: Float32Array;
  modelId: string;
  disableVad: boolean;
}

async function runTranscribe(req: TranscribeRequest): Promise<void> {
  await ensurePipeline(req.modelId);
  if (!asr) throw new Error("Pipeline failed to initialize");

  const pcm = req.pcm;
  const totalSec = pcm.length / SAMPLE_RATE;
  const useVad = !req.disableVad && totalSec >= MIN_VAD_DURATION_SEC;

  if (!useVad) {
    postProgress({
      kind: "transcribing",
      region: 1,
      totalRegions: 1,
      regionStartSec: 0,
      regionEndSec: totalSec,
    });
    const out = await runAsr(pcm);
    const words = extractWords(out, 0);
    postProgress({ kind: "done" });
    post({
      type: "result",
      payload: { words, fullText: out.text ?? "", device },
    });
    return;
  }

  const vad = detectSpeechRegions(pcm, SAMPLE_RATE);
  postProgress({
    kind: "vad-done",
    totalRegions: vad.regions.length,
    speechSec: vad.speechSec,
    totalSec: vad.totalSec,
    speechFraction: vad.speechFraction,
  });

  const allWords: TranscribedWord[] = [];
  const allText: string[] = [];
  for (let i = 0; i < vad.regions.length; i++) {
    const region = vad.regions[i];
    postProgress({
      kind: "transcribing",
      region: i + 1,
      totalRegions: vad.regions.length,
      regionStartSec: region.startSec,
      regionEndSec: region.endSec,
    });
    const startSample = Math.max(0, Math.floor(region.startSec * SAMPLE_RATE));
    const endSample = Math.min(pcm.length, Math.ceil(region.endSec * SAMPLE_RATE));
    if (endSample <= startSample) continue;
    const regionPcm = pcm.subarray(startSample, endSample);
    const out = await runAsr(regionPcm);
    allWords.push(...extractWords(out, region.startSec));
    const text = out.text ?? "";
    if (text.trim()) allText.push(text.trim());
  }

  postProgress({ kind: "done" });
  post({
    type: "result",
    payload: {
      words: allWords,
      fullText: allText.join(" "),
      device,
      vad: {
        totalRegions: vad.regions.length,
        speechSec: vad.speechSec,
        totalSec: vad.totalSec,
        speechFraction: vad.speechFraction,
      },
    },
  });
}

interface AsrOutput {
  text?: string;
  chunks?: Array<{ text?: string; timestamp?: [number | null, number | null] }>;
}

async function runAsr(pcm: Float32Array): Promise<AsrOutput> {
  const result = await asr!(pcm, {
    return_timestamps: "word",
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  return (Array.isArray(result) ? result[0] : result) as AsrOutput;
}

function extractWords(out: AsrOutput, offsetSec: number): TranscribedWord[] {
  const rawChunks = out.chunks ?? [];
  return rawChunks
    .map((c) => {
      const text = (c.text ?? "").trim();
      const start = c.timestamp?.[0];
      const end = c.timestamp?.[1];
      const startSec = (typeof start === "number" ? start : 0) + offsetSec;
      const endSec =
        (typeof end === "number" ? end : (typeof start === "number" ? start : 0)) + offsetSec;
      return { text, startSec, endSec };
    })
    .filter((w) => w.text.length > 0);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

ctx.addEventListener("message", async (e: MessageEvent) => {
  const data = e.data as { type: string; payload?: unknown };
  if (data.type === "transcribe") {
    try {
      await runTranscribe(data.payload as TranscribeRequest);
    } catch (err) {
      post({
        type: "error",
        payload: { message: (err as Error).message ?? String(err) },
      });
    }
  }
});
