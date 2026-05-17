/**
 * Rough Whisper-base.en wall-clock estimates given an audio duration and
 * the device the model is running on.
 *
 * These are observational bounds, not promises — actual speed varies with
 * GPU/CPU class, browser, audio content (silence is faster), and what else
 * the user has open. The wide range is intentional so callers don't lean
 * on a single number that often misses.
 *
 *   WebGPU on Apple Silicon: ~5–15× realtime  → 0.07–0.20 × audio duration
 *   WebGPU on integrated GPU: closer to 3×    → 0.20–0.35
 *   WASM single-thread:       ~0.3–1.0×       → 1.0–3.0 × audio duration
 *
 * We collapse those to two regimes and a single per-regime range below.
 */

export interface EtaRange {
  /** Low end of the estimate, in seconds. */
  loSec: number;
  /** High end of the estimate, in seconds. */
  hiSec: number;
}

const RATIOS = {
  webgpu: { lo: 0.1, hi: 0.3 },
  wasm: { lo: 1.0, hi: 3.0 },
} as const;

export function estimateTranscribeRange(
  audioSec: number,
  device: "webgpu" | "wasm",
): EtaRange {
  const r = RATIOS[device];
  return {
    loSec: audioSec * r.lo,
    hiSec: audioSec * r.hi,
  };
}

/**
 * Format a {lo, hi} range for display. Picks minutes when both ends are
 * over a minute, seconds otherwise. Collapses to a single number when lo
 * and hi round to the same display value.
 */
export function formatEtaRange(r: EtaRange): string {
  const lo = Math.max(0, r.loSec);
  const hi = Math.max(lo, r.hiSec);
  const useMin = hi >= 60;
  if (useMin) {
    const loMin = Math.max(1, Math.round(lo / 60));
    const hiMin = Math.max(loMin, Math.round(hi / 60));
    return loMin === hiMin ? `~${loMin} min` : `~${loMin}–${hiMin} min`;
  }
  const loS = Math.max(1, Math.round(lo));
  const hiS = Math.max(loS, Math.round(hi));
  return loS === hiS ? `~${loS} s` : `~${loS}–${hiS} s`;
}

/** "2m 14s" / "47s" / "1h 03m" — for live elapsed counters. */
export function formatElapsedShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}
