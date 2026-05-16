/**
 * Shared types for the bleep tool. Lives separately from the converter's
 * types since the bleep pipeline is its own state machine — sharing types
 * would couple the two for no real benefit.
 */

/** A word recovered from the transcription with its time bounds. */
export interface TranscribedWord {
  text: string;
  startSec: number;
  endSec: number;
}

/** A word the user wants muted, after the review-and-edit step. */
export interface BleepRange {
  text: string;
  startSec: number;
  endSec: number;
  /** Where this came from — a wordlist hit, or a user-added match. */
  source: "wordlist" | "custom";
}

/** Stages emitted to the UI during the bleep pipeline. */
export type BleepStage =
  | "idle"
  | "loading-engine"
  | "extracting-audio"
  | "loading-model"
  | "transcribing"
  | "matching"
  | "reviewing"
  | "applying-filter"
  | "writing-output"
  | "done"
  | "error";

export interface BleepProgress {
  stage: BleepStage;
  /** 0–1 of the current stage. May be unknown for some stages. */
  ratio?: number;
}
