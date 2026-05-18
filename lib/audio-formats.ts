/**
 * Audio format registry — parallel to lib/formats.ts (which is video-only).
 *
 * Adding a new audio format = adding one entry here + one entry in
 * lib/audio-converters.ts. The conversion engine, UI, sitemap, and SEO
 * pages all read from these two registries.
 *
 * Kept separate from FORMATS to avoid mixing the per-format video fields
 * (remuxLikelihood, codec mix descriptions) with audio fields. The two
 * registries can share the same `ConverterEngine` runtime via different
 * methods (`convert` for video → MP4, `convertAudio` for audio → MP3).
 */

export type AudioFormatId =
  | "wav"
  | "flac"
  | "m4a"
  | "ogg"
  | "wma"
  | "aiff"
  | "mp3";

export interface AudioFormatConfig {
  id: AudioFormatId;
  /** UPPERCASE display name (e.g. "FLAC"). */
  displayName: string;
  /** Lower-case, no-dot list of file extensions associated with this format. */
  extensions: string[];
  /** MIME types used in accept= and File.type sniffing. */
  mimeTypes: string[];
  /** The extension we'll use for the file we write into ffmpeg's MEMFS. */
  ffmpegInputExt: string;
  /** Long-form, human-friendly description of the format. */
  description: string;
  /** Common origin / use cases — used in the explainer card. */
  origin: string;
  /** Codec mix you'd typically find inside this format. */
  typicalCodecs: string;
  /** Loose verdict on lossy vs lossless — drives the UI badge tone. */
  losslessness: "lossless" | "lossy";
  /**
   * Typical conversion time for a 10 MB source file. Audio is much smaller
   * than video; using MB instead of GB keeps the estimates meaningful.
   */
  typical10MBTime: {
    browser: string;
    desktop: string;
  };
}

export const AUDIO_FORMATS: Record<AudioFormatId, AudioFormatConfig> = {
  wav: {
    id: "wav",
    displayName: "WAV",
    extensions: ["wav"],
    mimeTypes: ["audio/wav", "audio/wave", "audio/x-wav"],
    ffmpegInputExt: "wav",
    description:
      "WAV (Waveform Audio File Format) is Microsoft and IBM's original uncompressed audio container from 1991. Stores raw PCM samples — no compression, no loss, no playback compatibility issues.",
    origin:
      "Studio recordings, DAW exports (Logic, Ableton, FL Studio), audio engineering workflows, lossless archives.",
    typicalCodecs: "Uncompressed PCM (16-bit / 24-bit, mono or stereo)",
    losslessness: "lossless",
    typical10MBTime: { browser: "2–5 s", desktop: "<1 s" },
  },
  flac: {
    id: "flac",
    displayName: "FLAC",
    extensions: ["flac"],
    mimeTypes: ["audio/flac", "audio/x-flac"],
    ffmpegInputExt: "flac",
    description:
      "FLAC (Free Lossless Audio Codec) compresses audio without losing a single sample — typically ~50% of the original WAV size. Open-source, royalty-free, supported by most audiophile players.",
    origin:
      "CD rips, audiophile libraries, Bandcamp lossless downloads, Hi-Res Audio releases.",
    typicalCodecs: "FLAC (lossless compressed PCM)",
    losslessness: "lossless",
    typical10MBTime: { browser: "2–5 s", desktop: "<1 s" },
  },
  m4a: {
    id: "m4a",
    displayName: "M4A",
    extensions: ["m4a", "m4b", "mp4a"],
    mimeTypes: ["audio/mp4", "audio/x-m4a", "audio/m4a"],
    ffmpegInputExt: "m4a",
    description:
      "M4A is an MP4 container holding only an audio track — almost always AAC. Apple's preferred audio format: better quality than MP3 at the same bitrate, but historically less universal.",
    origin:
      "iTunes / Apple Music exports, iPhone voice memos, Audible audiobooks (.m4b is the same container with chapter metadata).",
    typicalCodecs: "AAC (most common) or ALAC (lossless variant)",
    losslessness: "lossy",
    typical10MBTime: { browser: "2–6 s", desktop: "<1 s" },
  },
  ogg: {
    id: "ogg",
    displayName: "OGG",
    extensions: ["ogg", "oga"],
    mimeTypes: ["audio/ogg", "audio/vorbis"],
    ffmpegInputExt: "ogg",
    description:
      "OGG is an open-source container, usually carrying Vorbis or Opus audio. Common on Linux, in open-source projects, and in modern web streaming, but not universally supported on iOS or older players.",
    origin:
      "Open-source games, Wikipedia audio, Linux desktop sounds, Spotify (Vorbis until 2024).",
    typicalCodecs: "Vorbis or Opus",
    losslessness: "lossy",
    typical10MBTime: { browser: "2–6 s", desktop: "<1 s" },
  },
  wma: {
    id: "wma",
    displayName: "WMA",
    extensions: ["wma"],
    mimeTypes: ["audio/x-ms-wma", "audio/wma"],
    ffmpegInputExt: "wma",
    description:
      "WMA (Windows Media Audio) is Microsoft's legacy audio format. Once dominant on Windows in the early-2000s, now largely unsupported outside of older Windows Media Player workflows.",
    origin:
      "Windows Media Player rips, old podcast archives, legacy karaoke files.",
    typicalCodecs: "WMA v1 / v2 / Pro",
    losslessness: "lossy",
    typical10MBTime: { browser: "3–8 s", desktop: "1–2 s" },
  },
  aiff: {
    id: "aiff",
    displayName: "AIFF",
    extensions: ["aiff", "aif", "aifc"],
    mimeTypes: ["audio/aiff", "audio/x-aiff"],
    ffmpegInputExt: "aiff",
    description:
      "AIFF (Audio Interchange File Format) is Apple's uncompressed audio container — the macOS counterpart to Microsoft's WAV. Same uncompressed PCM data, different chunk layout.",
    origin:
      "Older macOS / iOS apps, GarageBand and Logic Pro exports, professional Mac-based audio archives.",
    typicalCodecs: "Uncompressed PCM (same as WAV)",
    losslessness: "lossless",
    typical10MBTime: { browser: "2–5 s", desktop: "<1 s" },
  },
  mp3: {
    id: "mp3",
    displayName: "MP3",
    extensions: ["mp3"],
    mimeTypes: ["audio/mpeg", "audio/mp3"],
    ffmpegInputExt: "mp3",
    description:
      "MP3 (MPEG-1 Audio Layer III) is the universal lossy audio format. Plays everywhere — phones, browsers, smart speakers, every car stereo built since 1999.",
    origin: "Everywhere.",
    typicalCodecs: "MP3 (MPEG-1/2 Layer III), VBR or CBR",
    losslessness: "lossy",
    typical10MBTime: { browser: "2–4 s", desktop: "<1 s" },
  },
};

export function getAudioFormat(id: AudioFormatId): AudioFormatConfig {
  return AUDIO_FORMATS[id];
}

/** Match by extension (without dot). Returns null when unknown. */
export function detectAudioFormatByExtension(ext: string): AudioFormatConfig | null {
  const lower = ext.toLowerCase().replace(/^\./, "");
  for (const f of Object.values(AUDIO_FORMATS)) {
    if (f.extensions.includes(lower)) return f;
  }
  return null;
}

/** Best-effort detection from a File — extension first, then MIME type. */
export function detectAudioFormatFromFile(file: File): AudioFormatConfig | null {
  const m = file.name.match(/\.([^.]+)$/);
  if (m) {
    const byExt = detectAudioFormatByExtension(m[1]);
    if (byExt) return byExt;
  }
  if (file.type) {
    for (const f of Object.values(AUDIO_FORMATS)) {
      if (f.mimeTypes.some((t) => t.toLowerCase() === file.type.toLowerCase())) {
        return f;
      }
    }
  }
  return null;
}
