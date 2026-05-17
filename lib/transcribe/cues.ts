/**
 * Groups Whisper word-level output into subtitle-shaped cues.
 *
 * Whisper emits one timestamp per word, which is too granular for SRT/VTT
 * (a cue per word flashes too fast to read). We bucket consecutive words
 * into ~sentence-sized cues, breaking early at sentence-ending punctuation
 * or when a per-cue cap is hit.
 *
 * Heuristic, not perfect: long run-on sentences get split by word count;
 * very fast speech gets split by elapsed cue time. Tunable via options.
 */
import type { TranscribedWord } from "@/lib/bleep/types";

export interface Cue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface CueOptions {
  /** Hard cap on per-cue duration. Default 5 s. */
  maxDurationSec?: number;
  /** Hard cap on words per cue. Default 12. */
  maxWords?: number;
}

const SENTENCE_END = /[.!?]$/;

export function groupIntoCues(
  words: readonly TranscribedWord[],
  opts: CueOptions = {},
): Cue[] {
  const maxDur = opts.maxDurationSec ?? 5;
  const maxWords = opts.maxWords ?? 12;
  const cues: Cue[] = [];
  let current: TranscribedWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const first = current[0];
    const last = current[current.length - 1];
    // Join with a space — TranscribedWord.text is already trimmed by the
    // worker (we strip Whisper's leading-space convention upstream). The
    // earlier `.join("")` assumed words still carried that leading space,
    // which produced "AndsomyfellowAmericans," in cue text.
    cues.push({
      startSec: first.startSec,
      endSec: last.endSec,
      text: current.map((w) => w.text).join(" ").trim(),
    });
    current = [];
  };

  for (const w of words) {
    current.push(w);
    const endsSentence = SENTENCE_END.test(w.text.trim());
    const duration = w.endSec - current[0].startSec;
    if (endsSentence || current.length >= maxWords || duration >= maxDur) {
      flush();
    }
  }
  flush();
  return cues;
}
