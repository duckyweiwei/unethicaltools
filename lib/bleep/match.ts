/**
 * Profanity matcher. Walks a Whisper transcript word-by-word and emits
 * a stable list of match entries that the review UI renders.
 *
 * Why entries (not raw BleepRange[]):
 *   - The review UI needs a stable id per match for React keys + toggle
 *     state survival across re-matches when the user adds a custom word.
 *   - We also need the source word's index back in the transcript so the
 *     transcript view can underline matched words in-place.
 *
 * Matching rules:
 *   - Lowercase + strip leading/trailing punctuation (keeps apostrophes
 *     so contractions like "don't" stay intact, though no profanity in
 *     the default list has one).
 *   - Single-word match. Multi-word phrases ("son of a bitch") aren't
 *     handled yet — caller can add the joined form ("sonofabitch") to
 *     the custom list if they need.
 *   - Wordlist hits beat custom hits when both match (same word in both
 *     lists shows as "wordlist" source).
 */
import type { BleepRange, TranscribedWord } from "./types";

export interface MatchEntry {
  /** Stable id — survives re-runs of the matcher. */
  id: string;
  /** Index into the source TranscribedWord[]. */
  wordIdx: number;
  range: BleepRange;
}

export interface MatchOptions {
  /** Lowercased base wordlist. Use DEFAULT_PROFANITY_SET by default. */
  wordlist: ReadonlySet<string>;
  /** User-added words. Will be lowercased + trimmed by the matcher. */
  customWords?: readonly string[];
}

export function normalizeWord(s: string): string {
  // Lowercase, drop leading/trailing non-alphanumeric (keeps apostrophes
  // mid-word). Empty after stripping → caller filters out.
  return s
    .toLowerCase()
    .replace(/^[^a-z0-9']+/, "")
    .replace(/[^a-z0-9']+$/, "")
    .trim();
}

export function matchProfanity(
  words: readonly TranscribedWord[],
  opts: MatchOptions,
): MatchEntry[] {
  const customSet = new Set(
    (opts.customWords ?? [])
      .map((w) => normalizeWord(w))
      .filter((w) => w.length > 0),
  );

  const matches: MatchEntry[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const key = normalizeWord(w.text);
    if (!key) continue;

    let source: BleepRange["source"] | null = null;
    if (opts.wordlist.has(key)) source = "wordlist";
    else if (customSet.has(key)) source = "custom";
    if (!source) continue;

    matches.push({
      // wordIdx + startSec keeps the id stable even if the user re-runs
      // matching after toggling the wordlist on/off.
      id: `${i}-${w.startSec.toFixed(3)}`,
      wordIdx: i,
      range: {
        text: w.text.trim(),
        startSec: w.startSec,
        endSec: w.endSec,
        source,
      },
    });
  }
  return matches;
}
