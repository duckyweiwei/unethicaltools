/**
 * Format registry. One entry per input video format we support.
 *
 * Adding a new format = adding one entry here + one entry in lib/converters.ts.
 * The conversion engine, UI components, sitemap, and SEO pages all read from
 * these registries — no code changes elsewhere are required.
 */

export type FormatId =
  | "ts"
  | "mov"
  | "mkv"
  | "webm"
  | "avi"
  | "flv"
  | "mpeg"
  | "mp4";

/**
 * "high"   = nearly always remuxes (codecs are MP4-compatible by convention)
 * "medium" = remuxes if H.264/HEVC + AAC, otherwise re-encodes
 * "none"   = never remuxes to MP4 (codecs incompatible with the MP4 spec)
 */
export type RemuxLikelihood = "high" | "medium" | "none";

export interface FormatConfig {
  id: FormatId;
  /** UPPERCASE display name (e.g. "MKV"). */
  displayName: string;
  /** Lower-case, no-dot list of file extensions associated with this format. */
  extensions: string[];
  /** MIME types used in accept= and File.type sniffing. */
  mimeTypes: string[];
  /** The extension we'll use for the file we write into ffmpeg's MEMFS. */
  ffmpegInputExt: string;
  /** How likely a remux ("-c copy") succeeds for typical files of this format. */
  remuxLikelihood: RemuxLikelihood;
  /**
   * Extra remux args appended after `-c copy`. Use this for format-specific
   * bitstream filters (e.g. aac_adtstoasc for MPEG-TS).
   */
  remuxExtraArgs: string[];
  /** Long-form, human-friendly description of the format. */
  description: string;
  /** Common origin/use cases — used in the format explainer card. */
  origin: string;
  /** Codec mix you'd typically find inside this format. */
  typicalCodecs: string;
  /**
   * Typical conversion time for a 1 GB source file, shown on hub cards +
   * tailored by `estimateConversionTime()` for the actual file in FilePreview.
   * Browser = single-thread WASM (worst case). Desktop = native multi-core.
   */
  typical1GBTime: {
    browser: string;
    desktop: string;
  };
}

export const FORMATS: Record<FormatId, FormatConfig> = {
  ts: {
    id: "ts",
    displayName: "TS",
    extensions: ["ts", "mts", "m2ts"],
    mimeTypes: ["video/mp2t", "video/MP2T"],
    ffmpegInputExt: "ts",
    remuxLikelihood: "high",
    // ADTS-framed AAC inside MPEG-TS must be converted to AudioSpecificConfig
    // before it can be muxed into MP4.
    remuxExtraArgs: ["-bsf:a", "aac_adtstoasc"],
    description:
      "MPEG Transport Stream (TS) is a container designed for broadcast TV and error-resilient streaming. It chops video into 188-byte packets so that lost or corrupted segments don't break the rest of the recording.",
    origin:
      "Common in DVR recordings (HDHomeRun, TiVo), IPTV streams, ATSC/DVB broadcasts, Twitch and OBS captures.",
    typicalCodecs: "H.264 video + AAC audio",
    typical1GBTime: { browser: "10–30 s", desktop: "5–15 s" },
  },
  mov: {
    id: "mov",
    displayName: "MOV",
    extensions: ["mov", "qt"],
    mimeTypes: ["video/quicktime"],
    ffmpegInputExt: "mov",
    remuxLikelihood: "high",
    remuxExtraArgs: [],
    description:
      "MOV is Apple's QuickTime container. It's structurally almost identical to MP4 — both are based on the ISO Base Media File Format — but uses different atom names and allows codecs MP4 doesn't.",
    origin:
      "Apple devices (iPhone, iPad, Mac), professional editors (Final Cut Pro, DaVinci Resolve, Premiere Pro), and ProRes workflows.",
    typicalCodecs: "H.264 or HEVC video + AAC audio (ProRes if exported from pro tools)",
    typical1GBTime: { browser: "10–30 s", desktop: "5–15 s" },
  },
  mkv: {
    id: "mkv",
    displayName: "MKV",
    extensions: ["mkv"],
    mimeTypes: ["video/x-matroska"],
    ffmpegInputExt: "mkv",
    remuxLikelihood: "medium",
    remuxExtraArgs: [],
    description:
      "Matroska (MKV) is an open, extremely flexible container that can hold almost any codec, plus multiple audio tracks, subtitle tracks, chapters, and metadata. Popular in the desktop video community for its flexibility.",
    origin:
      "Blu-ray rips, anime fansubs, MakeMKV exports, Plex/Jellyfin libraries, and YouTube downloaders that preserve original streams.",
    typicalCodecs: "H.264 / HEVC / VP9 / AV1 + AAC / AC-3 / DTS / FLAC / Opus",
    typical1GBTime: { browser: "10–30 s remux · 15–45 min encode", desktop: "5–15 s remux · 3–10 min encode" },
  },
  webm: {
    id: "webm",
    displayName: "WEBM",
    extensions: ["webm"],
    mimeTypes: ["video/webm"],
    ffmpegInputExt: "webm",
    remuxLikelihood: "none",
    remuxExtraArgs: [],
    description:
      "WebM is Google's open-source web video format. It's a stripped-down Matroska that only allows royalty-free codecs (VP8/VP9/AV1 video, Vorbis/Opus audio). None of those are valid inside an MP4 container.",
    origin:
      "YouTube downloads, getUserMedia recordings, MediaRecorder API output, WebRTC captures.",
    typicalCodecs: "VP8 / VP9 / AV1 video + Vorbis / Opus audio",
    typical1GBTime: { browser: "15 min – 1.5 hr", desktop: "2–15 min" },
  },
  avi: {
    id: "avi",
    displayName: "AVI",
    extensions: ["avi"],
    mimeTypes: ["video/x-msvideo", "video/avi"],
    ffmpegInputExt: "avi",
    remuxLikelihood: "medium",
    remuxExtraArgs: [],
    description:
      "AVI (Audio Video Interleave) is a Microsoft container from 1992 — predating the modern web. It was the dominant format during the DivX / Xvid era and is still common in legacy archives.",
    origin:
      "Old DVD rips, camcorder footage from the 2000s, screen recorders that haven't been updated in 15 years.",
    typicalCodecs: "MPEG-4 Part 2 (DivX / Xvid) or H.264 video + MP3 audio",
    typical1GBTime: { browser: "10–40 min", desktop: "2–8 min" },
  },
  flv: {
    id: "flv",
    displayName: "FLV",
    extensions: ["flv"],
    mimeTypes: ["video/x-flv"],
    ffmpegInputExt: "flv",
    remuxLikelihood: "high",
    remuxExtraArgs: [],
    description:
      "FLV (Flash Video) was Adobe's container for video delivered via the Flash plugin. Flash is gone, but the file format outlived it — many archives from the late-2000s YouTube / Hulu era are still in FLV.",
    origin:
      "Early YouTube downloads, archived Twitch.tv clips from before HTML5, screen recordings made with FFsplit / Camtasia ~2010.",
    typicalCodecs: "H.264 video + AAC audio (older files: VP6 / H.263 + MP3)",
    typical1GBTime: { browser: "10–30 s", desktop: "5–15 s" },
  },
  mpeg: {
    id: "mpeg",
    displayName: "MPEG",
    extensions: ["mpeg", "mpg", "m2v", "m1v"],
    mimeTypes: ["video/mpeg"],
    ffmpegInputExt: "mpg",
    remuxLikelihood: "none",
    remuxExtraArgs: [],
    description:
      "MPEG (MPEG-1 Program Stream / MPEG-2 PS) is the original MPEG video container from the 1990s. It defined VideoCDs and powered DVDs. The MPEG-1/2 video codecs aren't part of the MP4 spec, so an MP4 conversion always requires re-encoding.",
    origin:
      "VideoCDs, DVD-Video VOB extracts, satellite recordings, archival broadcast footage.",
    typicalCodecs: "MPEG-1 or MPEG-2 video + MP2 or MP3 audio",
    typical1GBTime: { browser: "10–25 min", desktop: "2–5 min" },
  },
  mp4: {
    id: "mp4",
    displayName: "MP4",
    extensions: ["mp4", "m4v"],
    mimeTypes: ["video/mp4"],
    ffmpegInputExt: "mp4",
    remuxLikelihood: "high",
    remuxExtraArgs: [],
    description:
      "MP4 (MPEG-4 Part 14) is the modern universal video container. Supported natively by every browser, phone, smart TV, and video editor.",
    origin: "Everywhere.",
    typicalCodecs: "H.264 or HEVC video + AAC audio",
    typical1GBTime: { browser: "10–30 s", desktop: "5–15 s" },
  },
};

export function getFormat(id: FormatId): FormatConfig {
  return FORMATS[id];
}

/** Match by extension (without dot). Returns null when unknown. */
export function detectFormatByExtension(ext: string): FormatConfig | null {
  const lower = ext.toLowerCase().replace(/^\./, "");
  for (const f of Object.values(FORMATS)) {
    if (f.extensions.includes(lower)) return f;
  }
  return null;
}

/** Best-effort detection from a File. */
export function detectFormatFromFile(file: File): FormatConfig | null {
  const m = file.name.match(/\.([^.]+)$/);
  if (m) {
    const byExt = detectFormatByExtension(m[1]);
    if (byExt) return byExt;
  }
  if (file.type) {
    for (const f of Object.values(FORMATS)) {
      if (f.mimeTypes.some((t) => t.toLowerCase() === file.type.toLowerCase())) {
        return f;
      }
    }
  }
  return null;
}
