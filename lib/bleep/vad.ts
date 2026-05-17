/**
 * Energy-based voice activity detection. Pure DSP — no model load, no
 * network, no extra dependency. Walks the PCM in fixed windows, measures
 * RMS per window, marks anything above a dynamic noise floor as speech,
 * then coalesces adjacent windows into regions with a margin on each side.
 *
 * Why energy-based instead of Silero ONNX VAD: zero extra dependencies,
 * ~10× faster, and reliable for the target content (podcasts, talks,
 * streamer clips — i.e. clearly-articulated speech against quieter
 * background). The trade-off is misses on very quiet speech (whispers,
 * distant voice) and false positives on loud non-speech (music, applause).
 * If those edge cases show up in practice we can upgrade to Silero behind
 * the same interface.
 *
 * For the bleep / transcribe tools, the VAD output is fed back to Whisper
 * one region at a time — silence is never paid for, AND we get true
 * per-region progress (the upstream `asr()` call doesn't expose chunk
 * callbacks for Whisper).
 */

export interface SpeechRegion {
  /** Inclusive start time in seconds (already padded by margin). */
  startSec: number;
  /** Exclusive end time in seconds (already padded by margin). */
  endSec: number;
}

export interface VadOptions {
  /** RMS analysis window length in seconds. Default 0.5 s. */
  windowSec?: number;
  /** Multiplier above the dynamic noise floor that counts as speech. Default 3×. */
  thresholdMult?: number;
  /** Absolute minimum RMS that ever counts as speech, regardless of floor.
   *  Prevents promoting pure digital silence noise to "speech". */
  minThreshold?: number;
  /** Padding added on each side of every detected region. Default 0.5 s. */
  marginSec?: number;
  /** Gap (silence) between regions below which they get merged. Default 2 s. */
  maxGapSec?: number;
  /** Drop regions shorter than this after coalescing. Default 0.5 s. */
  minRegionSec?: number;
}

export interface VadStats {
  regions: SpeechRegion[];
  totalSec: number;
  speechSec: number;
  /** 0–1, fraction of audio that contains speech (0.3 = 30% speech). */
  speechFraction: number;
}

export function detectSpeechRegions(
  pcm: Float32Array,
  sampleRate: number,
  opts: VadOptions = {},
): VadStats {
  const windowSec = opts.windowSec ?? 0.5;
  const thresholdMult = opts.thresholdMult ?? 3;
  const minThreshold = opts.minThreshold ?? 0.005;
  const marginSec = opts.marginSec ?? 0.5;
  const maxGapSec = opts.maxGapSec ?? 2;
  const minRegionSec = opts.minRegionSec ?? 0.5;

  const totalSec = pcm.length / sampleRate;
  const windowSize = Math.max(1, Math.floor(sampleRate * windowSec));
  const numWindows = Math.floor(pcm.length / windowSize);

  // Audio too short to window meaningfully — treat as a single speech region.
  if (numWindows < 4) {
    return {
      regions: [{ startSec: 0, endSec: totalSec }],
      totalSec,
      speechSec: totalSec,
      speechFraction: 1,
    };
  }

  // Per-window RMS.
  const rms = new Float64Array(numWindows);
  for (let i = 0; i < numWindows; i++) {
    const off = i * windowSize;
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const s = pcm[off + j];
      sum += s * s;
    }
    rms[i] = Math.sqrt(sum / windowSize);
  }

  // Dynamic noise floor — 20th percentile RMS. Assumes at least 20% of the
  // audio is non-speech. For all-speech audio this can over-estimate the
  // floor; the minThreshold acts as a sanity lower bound.
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.2)];
  const threshold = Math.max(minThreshold, noiseFloor * thresholdMult);

  // Mark windows above threshold.
  const isSpeech: boolean[] = new Array(numWindows);
  for (let i = 0; i < numWindows; i++) isSpeech[i] = rms[i] > threshold;

  // Collapse to raw window-index regions.
  const raw: Array<{ startWin: number; endWin: number }> = [];
  let inSpeech = false;
  let startWin = 0;
  for (let i = 0; i < numWindows; i++) {
    if (isSpeech[i] && !inSpeech) {
      startWin = i;
      inSpeech = true;
    } else if (!isSpeech[i] && inSpeech) {
      raw.push({ startWin, endWin: i });
      inSpeech = false;
    }
  }
  if (inSpeech) raw.push({ startWin, endWin: numWindows });

  // Convert windows → seconds, applying margin on both sides.
  const padded: SpeechRegion[] = raw.map((r) => ({
    startSec: Math.max(0, r.startWin * windowSec - marginSec),
    endSec: Math.min(totalSec, r.endWin * windowSec + marginSec),
  }));

  // Coalesce regions separated by small gaps.
  const coalesced: SpeechRegion[] = [];
  for (const r of padded) {
    const last = coalesced[coalesced.length - 1];
    if (last && r.startSec - last.endSec < maxGapSec) {
      last.endSec = Math.max(last.endSec, r.endSec);
    } else {
      coalesced.push({ ...r });
    }
  }

  // Drop tiny isolated regions that are likely false positives.
  const filtered = coalesced.filter((r) => r.endSec - r.startSec >= minRegionSec);

  // Safety net: if everything got filtered out, fall back to treating the
  // whole audio as speech rather than returning nothing transcribable.
  const finalRegions = filtered.length > 0
    ? filtered
    : [{ startSec: 0, endSec: totalSec }];

  const speechSec = finalRegions.reduce(
    (sum, r) => sum + (r.endSec - r.startSec),
    0,
  );

  return {
    regions: finalRegions,
    totalSec,
    speechSec,
    speechFraction: totalSec > 0 ? speechSec / totalSec : 1,
  };
}
