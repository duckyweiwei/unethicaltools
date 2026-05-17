/**
 * Builds the ffmpeg audio filter string that mutes a set of time ranges.
 *
 * Uses a single `volume` filter with `enable='between(t,a,b)+between(t,c,d)+…'`
 * — `+` is arithmetic addition in ffmpeg expressions and `enable` triggers on
 * any non-zero value, so chaining clauses with `+` acts as logical OR. One
 * filter pass is meaningfully faster than chaining N `volume=…,volume=…`
 * stages when a video has many bleeps.
 *
 * Per-range duration: each range's mute extends from `startSec - padSec` to
 * `max(whisperEnd, charBasedEnd) + padSec`. The char-based floor catches two
 * Whisper failure modes:
 *   1. Whisper occasionally returns `endSec === startSec` (zero duration)
 *      for the last word of a 30-second chunk — without the floor the mute
 *      collapses to ~2× padSec for those words.
 *   2. For sustained/held swears ("fuuuck") Whisper sometimes clips the
 *      end-of-word boundary before the vowel actually finishes — taking
 *      max(whisperEnd, charBasedEnd) means a multi-syllable word always
 *      mutes at least a multi-syllable's worth of audio.
 *
 * Ranges are then sorted + coalesced so overlapping / pad-adjacent regions
 * collapse into one clause. Empty input → "" (caller decides whether that's
 * an error or a no-op).
 */
import type { BleepRange } from "./types";

export interface MuteFilterOptions {
  /** Pad applied on both sides of every range. Default 0.05 s (50 ms). */
  padSec?: number;
}

export interface CoalescedRange {
  start: number;
  end: number;
}

/**
 * Per-character minimum mute duration. ~80 ms per alphabetic char is a rough
 * mid-bound for English speech rate (syllables average ~200 ms, ~2.5 chars
 * per syllable). Used only as a floor — Whisper's reported end wins when it's
 * longer (held vowels, drawn-out emphasis).
 */
const PER_CHAR_SEC = 0.08;

/**
 * Absolute minimum mute duration, regardless of word length. Catches the
 * 1–2 char fallback case where alpha length would otherwise allow a sub-150ms
 * mute that audibly clips the word.
 */
const MIN_DURATION_SEC = 0.25;

function alphaLength(text: string): number {
  // Count only A–Z letters — punctuation, digits, and apostrophes shouldn't
  // pad the estimate. "Asshole." → 7, "F-bomb" → 5.
  return text.replace(/[^a-zA-Z]/g, "").length;
}

/** End-of-range used for muting: longer of Whisper's reported end and the
 *  character-based floor, plus the trailing pad. */
function effectiveEnd(r: BleepRange, padSec: number): number {
  const whisperEnd = Math.max(r.startSec, r.endSec);
  const charFloor =
    r.startSec + Math.max(MIN_DURATION_SEC, alphaLength(r.text) * PER_CHAR_SEC);
  return Math.max(whisperEnd, charFloor) + padSec;
}

export function coalesceRanges(
  ranges: readonly BleepRange[],
  padSec = 0.05,
): CoalescedRange[] {
  const expanded = ranges
    .map((r) => ({
      start: Math.max(0, r.startSec - padSec),
      end: effectiveEnd(r, padSec),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  const out: CoalescedRange[] = [];
  for (const r of expanded) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

export function buildMuteFilter(
  ranges: readonly BleepRange[],
  opts: MuteFilterOptions = {},
): string {
  const pad = opts.padSec ?? 0.05;
  const coalesced = coalesceRanges(ranges, pad);
  if (coalesced.length === 0) return "";

  const enableExpr = coalesced
    .map((r) => `between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})`)
    .join("+");

  // Single-quote the enable expression so the comma-separated between() args
  // aren't parsed as filter-chain separators by ffmpeg.
  return `volume=enable='${enableExpr}':volume=0`;
}
