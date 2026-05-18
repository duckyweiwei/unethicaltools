/**
 * Audio converter registry — one entry per /[slug] page where the slug is
 * `<input>-to-mp3`. Mirrors lib/converters.ts (which is video-only).
 *
 * Output is always MP3 today. The shape leaves room for future variants
 * (M4A target, FLAC target, etc.) without breaking existing routes.
 *
 * Adding a new audio converter = entry here + (if new input format) an
 * entry in lib/audio-formats.ts. The router at app/[converter]/page.tsx
 * tries the video registry first and falls back to this one.
 */

import type { AudioFormatId } from "./audio-formats";
import { AUDIO_FORMATS } from "./audio-formats";
import type { FAQ } from "./converters";

/** Privacy/SEO benefit keywords mirrored into every audio entry. */
const BENEFIT_KEYWORDS = [
  "no upload",
  "no upload audio converter",
  "private audio converter",
  "fast audio conversion",
  "no sign up",
  "no account",
  "free audio converter",
];

export interface AudioConverterConfig {
  /** URL slug, e.g. "wav-to-mp3". */
  slug: string;
  input: AudioFormatId;
  output: "mp3";
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  tagline: string;
  whyConvertParagraphs: string[];
  faqs: FAQ[];
}

const SHARED_AUDIO_FAQS: FAQ[] = [
  {
    q: "Is my audio actually private?",
    a:
      "Yes. The conversion runs entirely in your browser using ffmpeg.wasm. There's no upload endpoint in the code — you can open DevTools and check the Network tab. The only network request after page load is the one-time download of the ffmpeg.wasm engine.",
  },
  {
    q: "What output bitrate does the MP3 use?",
    a:
      "Variable bitrate at quality level 2 (libmp3lame -q:a 2) — averages around 190 kbps. This is the standard sweet spot for transparency to most listeners: noticeably better than 128 kbps, only slightly larger.",
  },
  {
    q: "What's the file size limit?",
    a:
      "There's no fixed limit — only what your device's RAM can hold. Audio files are usually much smaller than video, so this is rarely a practical issue. A 2-hour lossless WAV (~1 GB) is well within reach on most laptops.",
  },
  {
    q: "Does this work on mobile?",
    a:
      "Yes, on recent mobile browsers. Audio files are small enough that mobile RAM isn't a bottleneck for typical use.",
  },
  {
    q: "Will I lose quality?",
    a:
      "If your source is lossy (M4A/AAC, OGG/Vorbis, WMA, MP3), the re-encode introduces a small generational loss — usually inaudible. If your source is lossless (WAV, FLAC, AIFF), the loss is the standard MP3 vs lossless difference, transparent to most listeners at our 190 kbps default.",
  },
];

export const AUDIO_CONVERTERS: AudioConverterConfig[] = [
  {
    slug: "wav-to-mp3",
    input: "wav",
    output: "mp3",
    title: "WAV to MP3 Converter — Free, No Upload, Private",
    description:
      "Convert WAV to MP3 in your browser. Free, no upload, no account. Compress lossless WAV audio to portable MP3 — your files never leave your device.",
    keywords: [
      "wav to mp3 converter",
      "wav to mp3 no upload",
      "wav to mp3 free",
      "wav to mp3 browser",
      "wav to mp3 private",
      "lossless to mp3",
      "audio compressor",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "WAV to MP3 Converter",
    tagline:
      "Compress lossless WAV audio to portable MP3 — privately, in your browser. No upload.",
    whyConvertParagraphs: [
      "WAV stores raw uncompressed PCM samples — pristine, but huge. A three-minute song easily takes 30 MB; an hour-long lecture lands in the hundreds of megabytes. That's fine for studio work, painful for sharing or sticking on a phone.",
      "MP3 cuts the size by roughly an order of magnitude with no audible loss for most listeners. It plays on every phone, browser, smart speaker, and car stereo built in the last two decades — the universal audio compatibility floor.",
    ],
    faqs: [
      {
        q: "Is the WAV → MP3 conversion lossy?",
        a:
          "Yes — MP3 is a lossy format by definition. Our default (libmp3lame VBR q:a 2, ~190 kbps) is widely considered transparent to most listeners, but a critical-listening test pressing or audio engineering workflow should keep the original WAV.",
      },
      {
        q: "What about 24-bit WAV files from a studio session?",
        a:
          "ffmpeg downsamples 24-bit to MP3's 16-bit equivalent during encoding. The dynamic range of the output is bounded by MP3's design — most listeners won't notice on consumer playback gear.",
      },
      {
        q: "Are stereo WAVs preserved?",
        a:
          "Yes — channel layout is preserved through the encode. Stereo WAV → stereo MP3, mono → mono.",
      },
      ...SHARED_AUDIO_FAQS,
    ],
  },
  {
    slug: "flac-to-mp3",
    input: "flac",
    output: "mp3",
    title: "FLAC to MP3 Converter — Free, No Upload, Private",
    description:
      "Convert FLAC to MP3 with no upload required. Free, private, in-browser audio conversion. Trade lossless audiophile quality for universal MP3 compatibility.",
    keywords: [
      "flac to mp3 converter",
      "flac to mp3 no upload",
      "flac to mp3 free",
      "flac to mp3 browser",
      "audiophile to mp3",
      "lossless to lossy",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "FLAC to MP3 Converter",
    tagline:
      "Convert lossless FLAC to portable MP3 in your browser. No upload, no account.",
    whyConvertParagraphs: [
      "FLAC is lossless — beautiful for archival and audiophile playback, but huge and not universally supported. iOS Safari only gained native FLAC support recently; most consumer Bluetooth car stereos still can't decode it.",
      "Converting to MP3 trades the lossless property for compatibility. The size shrinks by roughly 3-5×, and the result plays on literally everything. Keep the FLAC for your library; ship MP3 for the road.",
    ],
    faqs: [
      {
        q: "Will I notice the quality loss going from FLAC to MP3?",
        a:
          "On consumer headphones or speakers, almost certainly not at our default 190 kbps VBR. On studio monitors with critical listening in a quiet room, you might pick up subtle high-frequency artifacts on dense / cymbal-heavy material.",
      },
      {
        q: "What about FLAC metadata (album art, tags)?",
        a:
          "Basic ID3-equivalent metadata (title, artist, album) is converted into MP3 ID3v2 tags. Embedded album art is preserved. FLAC-specific cuesheets and rich Vorbis comments are dropped.",
      },
      {
        q: "Hi-Res FLAC (24-bit / 96 kHz) — what happens?",
        a:
          "MP3's spec caps at 16-bit / 48 kHz. ffmpeg downsamples and dithers — the resulting MP3 is a redbook-quality equivalent. The hi-res master should stay in FLAC.",
      },
      ...SHARED_AUDIO_FAQS,
    ],
  },
  {
    slug: "m4a-to-mp3",
    input: "m4a",
    output: "mp3",
    title: "M4A to MP3 Converter — Free, No Upload, Private",
    description:
      "Convert M4A (Apple AAC) to MP3 in your browser. Free, no upload, no account. Make iTunes / Apple Music exports universally playable.",
    keywords: [
      "m4a to mp3 converter",
      "m4a to mp3 no upload",
      "m4a to mp3 free",
      "apple aac to mp3",
      "itunes to mp3",
      "voice memo to mp3",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "M4A to MP3 Converter",
    tagline:
      "Make Apple's M4A audio play everywhere. Convert to MP3 in your browser, no upload.",
    whyConvertParagraphs: [
      "M4A is an MP4 container with just an audio track inside — almost always AAC. Apple uses it everywhere: iTunes downloads, Apple Music, iPhone voice memos, Audible audiobooks. It's higher-quality than MP3 at the same bitrate, but historically less universal.",
      "Most modern players handle M4A fine. The lingering gap is older Bluetooth devices, certain Windows-only apps, web upload forms that whitelist .mp3 specifically, and DAWs that haven't been updated since 2015. MP3 covers all of those.",
    ],
    faqs: [
      {
        q: "Doesn't M4A sound better than MP3 at the same bitrate?",
        a:
          "Generally yes — AAC (the codec inside M4A) is more efficient than MP3 at lower bitrates. At our default ~190 kbps the difference is hard to hear on most material. If you want maximum quality, increase the MP3 quality or keep the M4A.",
      },
      {
        q: "What about voice memos from my iPhone?",
        a:
          "Voice memos export as .m4a. They convert cleanly to MP3, often shrinking slightly. Useful when uploading to platforms that don't accept .m4a.",
      },
      {
        q: "ALAC (lossless M4A) — does this handle it?",
        a:
          "Yes — ALAC inside an M4A container decodes losslessly, then encodes to lossy MP3. The lossless property is gone but the conversion works.",
      },
      ...SHARED_AUDIO_FAQS,
    ],
  },
  {
    slug: "ogg-to-mp3",
    input: "ogg",
    output: "mp3",
    title: "OGG to MP3 Converter — Free, No Upload, Private",
    description:
      "Convert OGG (Vorbis / Opus) audio to MP3 with no upload required. Free, private, in-browser. Makes open-source audio play on every device.",
    keywords: [
      "ogg to mp3 converter",
      "ogg to mp3 no upload",
      "ogg to mp3 free",
      "vorbis to mp3",
      "opus to mp3",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "OGG to MP3 Converter",
    tagline:
      "Convert OGG / Vorbis / Opus audio to MP3 in your browser. No upload, no account.",
    whyConvertParagraphs: [
      "OGG is an open container that usually carries Vorbis or Opus audio. Great for open-source software, modern web streaming, and Linux desktops — but not all consumer playback gear supports it. iOS Safari only started handling Opus recently; many older cars don't accept OGG at all.",
      "MP3 trades OGG's slightly-better compression efficiency for universal compatibility. Best when you need a file that just plays anywhere without checking specs first.",
    ],
    faqs: [
      {
        q: "Is Opus better than MP3? Why convert?",
        a:
          "Opus is technically more efficient — better quality per kilobit. The reason to convert anyway is compatibility: many older players, car stereos, Bluetooth speakers, and corporate upload forms only accept MP3.",
      },
      {
        q: "OGG Vorbis vs OGG Opus — does this handle both?",
        a:
          "Yes — ffmpeg decodes either and re-encodes to MP3. The output is identical in container and codec regardless of which the OGG contained.",
      },
      ...SHARED_AUDIO_FAQS,
    ],
  },
  {
    slug: "wma-to-mp3",
    input: "wma",
    output: "mp3",
    title: "WMA to MP3 Converter — Free, No Upload, Private",
    description:
      "Convert WMA (Windows Media Audio) to MP3 in your browser. Free, no upload, no account. Rescue legacy Windows audio archives.",
    keywords: [
      "wma to mp3 converter",
      "wma to mp3 no upload",
      "wma to mp3 free",
      "windows media to mp3",
      "wma converter browser",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "WMA to MP3 Converter",
    tagline:
      "Rescue Windows Media Audio archives. Convert WMA to MP3 in your browser, no upload.",
    whyConvertParagraphs: [
      "WMA was Microsoft's answer to MP3 in the early 2000s — bundled with Windows Media Player, used by Yahoo Music, MSN Music, and the era's Windows-only podcast tools. It briefly dominated on Windows, then faded as MP3 and AAC became universal.",
      "Most non-Microsoft platforms never really supported WMA. macOS, iOS, Android, and modern browsers all need a third-party plugin or conversion. MP3 is the path of least resistance for anything you want to play in 2026.",
    ],
    faqs: [
      {
        q: "I have old WMA files from Windows Media Player — will they convert?",
        a:
          "Yes, as long as they're not DRM-protected. The WMA codec itself decodes cleanly in ffmpeg. WMA files purchased from old DRM stores (defunct Microsoft PlaysForSure stores etc.) won't decode — that's a DRM limitation, not a format one.",
      },
      {
        q: "What about WMA Lossless or WMA Pro?",
        a:
          "Both decode fine. WMA Lossless to MP3 is a lossy conversion (MP3 is lossy by design). WMA Pro decodes to its underlying PCM then encodes as standard MP3.",
      },
      ...SHARED_AUDIO_FAQS,
    ],
  },
  {
    slug: "aiff-to-mp3",
    input: "aiff",
    output: "mp3",
    title: "AIFF to MP3 Converter — Free, No Upload, Private",
    description:
      "Convert AIFF (Apple's uncompressed audio) to MP3 in your browser. Free, no upload, no account. Shrink Mac-native lossless audio to portable MP3.",
    keywords: [
      "aiff to mp3 converter",
      "aiff to mp3 no upload",
      "aiff to mp3 free",
      "apple aiff to mp3",
      "garageband to mp3",
      "aif to mp3",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "AIFF to MP3 Converter",
    tagline:
      "Shrink Apple's uncompressed AIFF audio to portable MP3. In-browser, no upload.",
    whyConvertParagraphs: [
      "AIFF is essentially Mac WAV — same uncompressed PCM data, slightly different container layout. It's what GarageBand, Logic Pro, and older Mac audio apps default to when exporting lossless audio.",
      "It carries the same downside as WAV: huge file sizes. Converting to MP3 makes the file 5-10× smaller with the standard lossy compression trade-off, and lets you send / stream / mobile-play the result anywhere.",
    ],
    faqs: [
      {
        q: "Is AIFF really just WAV with a different extension?",
        a:
          "Almost. Both contain uncompressed PCM samples. The wrapping chunks (header layout, metadata fields) differ — but to the listener and to ffmpeg, they're equivalent in audio content.",
      },
      {
        q: "What about .aif and .aifc extensions?",
        a:
          "Same family. .aif is just the short version; .aifc is an AIFF variant that allows compression chunks (rarely used in practice). Both decode through the same path.",
      },
      ...SHARED_AUDIO_FAQS,
    ],
  },
];

export function getAudioConverter(slug: string): AudioConverterConfig | null {
  return AUDIO_CONVERTERS.find((c) => c.slug === slug) ?? null;
}

export function getAudioConverterFormat(slug: string) {
  const c = getAudioConverter(slug);
  return c ? AUDIO_FORMATS[c.input] : null;
}

/**
 * Sister of getRelatedConverters() for video. Picks N other audio
 * converters, preferring same losslessness tier first.
 */
export function getRelatedAudioConverters(
  slug: string,
  n: number = 4,
): AudioConverterConfig[] {
  const current = getAudioConverter(slug);
  if (!current) return AUDIO_CONVERTERS.slice(0, n);
  const currentFormat = AUDIO_FORMATS[current.input];

  const others = AUDIO_CONVERTERS.filter((c) => c.slug !== slug);
  const sameTier = others.filter(
    (c) => AUDIO_FORMATS[c.input].losslessness === currentFormat.losslessness,
  );
  const rest = others.filter(
    (c) => AUDIO_FORMATS[c.input].losslessness !== currentFormat.losslessness,
  );
  return [...sameTier, ...rest].slice(0, n);
}
