/**
 * User-pickable Whisper model size. Persists across sessions in localStorage
 * so the choice sticks after refresh.
 *
 * Only the two `Xenova/whisper-*.en` variants are listed — they're the only
 * sizes confirmed to support word-level timestamps in transformers.js v4
 * (onnx-community drops cross-attentions, distil-whisper uses a different
 * decoder layer count the timestamp extractor doesn't handle).
 */

export type WhisperModelChoice = "tiny" | "base" | "small";

const STORAGE_KEY = "bleep:whisper-model";
const DEFAULT_MODEL: WhisperModelChoice = "base";

export const MODEL_IDS: Record<WhisperModelChoice, string> = {
  tiny: "Xenova/whisper-tiny.en",
  base: "Xenova/whisper-base.en",
  small: "Xenova/whisper-small.en",
};

export interface ModelInfo {
  label: string;
  /** Approximate on-disk size of the ONNX bundle (download size). */
  sizeLabel: string;
  /** Relative speed vs base.en, for the UI hint. */
  speedLabel: string;
  /** One-line accuracy hint shown next to the option. */
  hint: string;
}

export const MODEL_INFO: Record<WhisperModelChoice, ModelInfo> = {
  tiny: {
    label: "tiny.en",
    sizeLabel: "~40 MB",
    speedLabel: "~2× faster",
    hint: "drops proper nouns + uncommon words more often",
  },
  base: {
    label: "base.en",
    sizeLabel: "~80 MB",
    speedLabel: "balanced",
    hint: "good default for clear speech",
  },
  small: {
    label: "small.en",
    sizeLabel: "~488 MB",
    speedLabel: "~3× slower",
    hint: "best on names, jargon, fast speech — heavier first download",
  },
};

const VALID_CHOICES = new Set<WhisperModelChoice>(["tiny", "base", "small"]);

export function getStoredModelChoice(): WhisperModelChoice {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && VALID_CHOICES.has(v as WhisperModelChoice)) {
      return v as WhisperModelChoice;
    }
  } catch {
    /* localStorage may be disabled / quota-exceeded — fall through to default */
  }
  return DEFAULT_MODEL;
}

export function setStoredModelChoice(choice: WhisperModelChoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
}
