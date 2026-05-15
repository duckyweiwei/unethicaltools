/**
 * Browser memory estimation + probing for the converter.
 *
 * Two layers of estimation:
 *
 *  1. STATIC: `estimateMaxFileSizeBytes()` reads `navigator.deviceMemory` and
 *     applies a conservative ratio. Cheap, runs on page load, never fails —
 *     used to set expectations in FormatHero. Doesn't reflect what other
 *     tabs are currently using.
 *
 *  2. DYNAMIC: `canAllocateForFile()` actually attempts to allocate the
 *     memory ffmpeg.wasm will need for THIS specific file. Reflects real
 *     headroom right now (other tabs, OS pressure, etc.). More accurate but
 *     allocates briefly — should only run when borderline.
 *
 * The 2.5× multiplier accounts for: source file in MEMFS + output file in
 * MEMFS + ffmpeg's working buffers (decoded frames, lookahead, etc).
 */

/** 32-bit WebAssembly addressing limit. ffmpeg.wasm can never exceed this. */
const HARD_CAP_BYTES = 4 * 1024 ** 3;

/** Empirical ratio: ffmpeg needs ~2.5× the source size in working memory. */
const FFMPEG_OVERHEAD_MULTIPLIER = 2.5;

/** Browser-reported total system RAM in GB. Null on Firefox/Safari. */
export function getDeviceMemoryGB(): number | null {
  if (typeof navigator === "undefined") return null;
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof dm === "number" ? dm : null;
}

/**
 * Static estimate of the largest file size the browser can probably convert.
 * Roughly: (40% of system RAM as the browser's usable budget) / overhead.
 *
 * Why 0.4: a typical desktop user runs a few apps + a few browser tabs.
 * The browser can comfortably allocate ~40% of system RAM to one tab on a
 * mid-spec machine. Lower would be over-cautious; higher would over-promise
 * for users with crowded systems.
 *
 * Returns conservative defaults when `deviceMemory` is unavailable
 * (Firefox/Safari) — better to under-promise than to over-promise.
 */
export function estimateMaxFileSizeBytes(): number {
  const dm = getDeviceMemoryGB();
  if (dm == null) {
    // Browser doesn't expose deviceMemory — assume entry-level laptop.
    return 1 * 1024 ** 3;
  }
  const safeBudgetForFile = (dm * 0.4 * 1024 ** 3) / FFMPEG_OVERHEAD_MULTIPLIER;
  return Math.min(safeBudgetForFile, HARD_CAP_BYTES - 512 * 1024 ** 2);
}

/**
 * Try to allocate enough memory for `fileSizeBytes` worth of conversion.
 * Returns true if the browser successfully gave us the memory (and we
 * immediately released it), false if it threw.
 *
 * Use sparingly — the probe briefly holds 1–4 GB. Don't call for small
 * files; the test itself isn't free.
 *
 * Run on a borderline-sized drop: anything over ~50% of the static estimate.
 */
export async function canAllocateForFile(fileSizeBytes: number): Promise<boolean> {
  const needed = Math.ceil(fileSizeBytes * FFMPEG_OVERHEAD_MULTIPLIER);
  // Hard ceiling — never bother probing beyond what could possibly succeed.
  if (needed > HARD_CAP_BYTES) return false;
  try {
    // Single allocation. The buffer is unreferenced as soon as `void` evaluates,
    // so V8 frees it on the next GC cycle (typically µs after this returns).
    void new ArrayBuffer(needed);
    // Yield once so the GC has a chance to run before we report success.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return true;
  } catch {
    return false;
  }
}

/** True when a file is large enough that running the probe is worthwhile. */
export function shouldProbe(fileSizeBytes: number): boolean {
  // ~50% of what the heuristic says is safe. Below that, allocation always works.
  return fileSizeBytes >= estimateMaxFileSizeBytes() * 0.5;
}
