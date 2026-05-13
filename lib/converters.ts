/**
 * Converter registry — one entry per /[slug] page.
 *
 * Each entry holds the unique content that makes the page substantive enough
 * to rank: a distinct intro paragraph, a "why this format" explanation, a
 * remux expectation written in plain English, and ~6 format-specific FAQs.
 *
 * Pages are generated from these entries via app/[converter]/page.tsx +
 * generateStaticParams, so adding a new converter = adding one entry here.
 */

import type { FormatId } from "./formats";
import { FORMATS } from "./formats";

export interface FAQ {
  q: string;
  a: string;
}

/**
 * Four privacy-signal phrases we want every per-format page to rank for.
 * Already shown to users via FeatureBadges; mirrored into every converter's
 * keywords array + WebApplication JSON-LD `featureList` so search engines
 * pick them up as structured signals, not just visual decoration.
 */
export const SEO_BENEFITS = [
  "No Upload",
  "Private Processing",
  "Fast Conversion",
  "No Sign Up",
] as const;

/** Lowercase + plain variants for the per-converter keywords array. */
const BENEFIT_KEYWORDS = [
  "no upload",
  "no upload converter",
  "private processing",
  "private converter",
  "fast conversion",
  "no sign up",
  "no account",
  "free no signup",
];

export interface ConverterConfig {
  /** URL slug, e.g. "ts-to-mp4". */
  slug: string;
  input: FormatId;
  output: "mp4";
  /** Used in <title>. Keep under ~60 chars. */
  title: string;
  /** Used in <meta description>. Keep ~150 chars. */
  description: string;
  /** Keywords array (used by some crawlers + your own analytics). */
  keywords: string[];
  /** Big hero headline. */
  h1: string;
  /** Sub-headline below the H1. */
  tagline: string;
  /** Paragraphs displayed in the "Why convert" explainer. */
  whyConvertParagraphs: string[];
  /** Plain-English description of the remux outlook for this format. */
  remuxOutlook: string;
  /** FAQ specific to this format. Combined with shared FAQs at render time. */
  faqs: FAQ[];
}

export const SHARED_FAQS: FAQ[] = [
  {
    q: "What is unethicaletools?",
    a:
      "unethicaletools is a small catalog of utilities that run on your device — no accounts, no uploads, no telemetry, no subscriptions. The name is the joke: by every conventional SaaS metric these tools are terrible business (no engagement to grow, no data to sell, nothing to lock you into). By the metric that matters to you — does it do the thing without strings? — they work. This video converter is the first one. The /about page has the full story.",
  },
  {
    q: "Is my video actually private?",
    a:
      "Yes. The conversion runs entirely in your browser using ffmpeg.wasm. There's no upload endpoint in the code — you can open DevTools and check the Network tab. The only network request after page load is the one-time download of the ffmpeg.wasm engine.",
  },
  {
    q: "Why are some conversions instant and others slow?",
    a:
      "Two paths: remuxing (instant) and re-encoding (slower). Remuxing keeps the original video and audio streams and only rewrites the container — works when the source already uses codecs the MP4 spec allows (H.264 + AAC). Re-encoding decodes every frame and encodes it again, which is unavoidable for VP9, MPEG-2, and similar.",
  },
  {
    q: "What's the file size limit?",
    a:
      "There's no fixed limit — only what your device's RAM can hold. As a rule of thumb, files under 2 GB are safe on most modern laptops. Above that, browser memory pressure may interrupt the conversion.",
  },
  {
    q: "Does this work on mobile?",
    a:
      "It works on recent mobile browsers but mobile RAM is the bottleneck. Stick to short clips (<500 MB) on phones for a reliable experience.",
  },
];

export const CONVERTERS: ConverterConfig[] = [
  {
    slug: "ts-to-mp4",
    input: "ts",
    output: "mp4",
    title: "TS to MP4 Converter — No Upload · Private · Fast · No Sign Up",
    description:
      "Convert TS (MPEG-TS) to MP4 with no upload required. Private processing in your browser, fast conversion (remuxes instantly when codecs allow), no sign up. Lossless, free, no watermark.",
    keywords: [
      "ts to mp4 converter",
      "ts to mp4 no upload",
      "ts to mp4 private",
      "ts to mp4 fast",
      "ts to mp4 no sign up",
      "ts to mp4 browser",
      "ts to mp4 without uploading",
      "mpeg-ts to mp4",
      "obs ts to mp4",
      "hdhomerun ts to mp4",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "TS to MP4 Converter",
    tagline:
      "Convert MPEG transport streams to MP4 right in your browser. No upload, no account, no quality loss.",
    whyConvertParagraphs: [
      "TS files are designed for broadcast transmission, not playback. They aren't supported natively by most web players, modern video editors, or mobile devices. MP4 is the universal format that just works everywhere — phones, browsers, smart TVs, Premiere Pro, your friend's iPhone.",
      "The good news: a TS-to-MP4 conversion is almost always a remux, not a re-encode. TS files typically wrap H.264 video and AAC audio — exactly what MP4 wants. We swap the container and the video stream is bit-for-bit identical. It takes seconds, not minutes, and the output is the same quality as the source.",
    ],
    remuxOutlook:
      "Almost always remuxes. TS files usually contain H.264 + AAC, which MP4 accepts directly. Expect conversion in seconds, with no quality loss.",
    faqs: [
      {
        q: "Why is my OBS .ts recording so large?",
        a:
          "OBS records uncompressed-ish streams at the bitrate you configured. The .ts container itself has minimal overhead — your file size reflects your encode quality settings. Converting to MP4 doesn't make it smaller (we remux, not re-encode); to shrink it, you'd need a separate transcoding step with a lower bitrate.",
      },
      {
        q: "Can I convert HDHomeRun DVR recordings?",
        a:
          "Yes. HDHomeRun records ATSC/QAM broadcasts as MPEG-TS containing H.264 or H.265 video and AC-3 or AAC audio. H.264 + AAC remuxes losslessly; H.265 + AC-3 may need re-encoding for strict MP4 compatibility.",
      },
      {
        q: "Will I lose quality?",
        a:
          "Not in the remux path — every video and audio frame is copied byte-for-byte. Only if your file has codecs that don't fit in MP4 (e.g. AC-3 audio) will we re-encode, which is near-lossless at the default CRF 20 setting.",
      },
      {
        q: "What about .m2ts and .mts files?",
        a:
          "Same container family (BDAV MPEG-TS / AVCHD). They typically remux to MP4 the same way. We accept .ts, .mts, and .m2ts extensions.",
      },
      {
        q: "Is this faster than HandBrake or VLC?",
        a:
          "For remuxing, yes — by a wide margin. HandBrake re-encodes by default; VLC's convert dialog also re-encodes. Both take minutes for an hour of footage. Remuxing the same file here typically takes single-digit seconds.",
      },
      ...SHARED_FAQS,
    ],
  },
  {
    slug: "mov-to-mp4",
    input: "mov",
    output: "mp4",
    title: "MOV to MP4 Converter — No Upload · Private · Fast · No Sign Up",
    description:
      "Convert MOV (QuickTime) to MP4 with no upload required. Private processing in your browser, fast conversion (instant remux for iPhone, Final Cut, and Premiere exports), no sign up.",
    keywords: [
      "mov to mp4 converter",
      "mov to mp4 no upload",
      "mov to mp4 private",
      "mov to mp4 fast",
      "mov to mp4 no sign up",
      "iphone mov to mp4",
      "quicktime to mp4",
      "mov to mp4 browser",
      "mov to mp4 free no signup",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "MOV to MP4 Converter",
    tagline:
      "Turn QuickTime MOV files into universal MP4 — privately, in your browser. No upload required.",
    whyConvertParagraphs: [
      "MOV is Apple's container — created for QuickTime, used by iPhones, iPads, Final Cut Pro, and DaVinci Resolve. It's structurally similar to MP4 (both descend from the ISO Base Media File Format), but Windows tools, Android, and some web players treat MOV as a second-class citizen.",
      "Converting to MP4 unlocks playback on basically anything. Because MOV and MP4 share most of their structure, the conversion is usually a metadata-only rewrite (a remux) — the video and audio streams pass through untouched. That means no quality loss and no waiting for an encode.",
    ],
    remuxOutlook:
      "Usually remuxes. iPhone MOV files use H.264 or HEVC + AAC, which MP4 accepts. Older ProRes-based MOVs will trigger a re-encode.",
    faqs: [
      {
        q: "What's actually different between MOV and MP4?",
        a:
          "They share the same underlying ISO Base Media File Format. MP4 is a stricter subset with a fixed codec whitelist; MOV is the original superset that allows more codecs (notably ProRes). Most consumer MOV files happen to use MP4-compatible codecs already, so a remux works.",
      },
      {
        q: "Does this preserve HEVC (H.265) from my iPhone?",
        a:
          "Yes — HEVC is allowed in MP4. The remux keeps the original HEVC stream. Note that not every device can play HEVC MP4; if you're sharing with older hardware, you may want to re-encode to H.264 separately.",
      },
      {
        q: "What about ProRes from Final Cut?",
        a:
          "ProRes isn't a valid MP4 codec, so we'll re-encode to H.264. The output will be much smaller than the ProRes source (ProRes is an intermediate codec; H.264 is a delivery codec) and quality will be visually transparent at CRF 20.",
      },
      {
        q: "Does it keep my video's creation date and GPS metadata?",
        a:
          "Most box-level metadata is copied during remux, but some Apple-specific extensions get dropped during container rewrite. Critical metadata (duration, dimensions, creation_time) is preserved.",
      },
      {
        q: "I exported from Final Cut. Why is the file ~10 GB?",
        a:
          "Final Cut likely exported as ProRes. The remuxed MP4 would still be huge (we keep the ProRes stream). Either re-encode in this tool — which compresses heavily — or re-export from Final Cut to H.264 directly.",
      },
      ...SHARED_FAQS,
    ],
  },
  {
    slug: "mkv-to-mp4",
    input: "mkv",
    output: "mp4",
    title: "MKV to MP4 Converter — No Upload · Private · Fast · No Sign Up",
    description:
      "Convert MKV (Matroska) to MP4 with no upload required. Private processing in your browser, fast conversion (lossless remux when codecs allow), no sign up. Built for Plex, Blu-ray rips, anime fansubs.",
    keywords: [
      "mkv to mp4 converter",
      "mkv to mp4 no upload",
      "mkv to mp4 private",
      "mkv to mp4 fast",
      "mkv to mp4 no sign up",
      "mkv to mp4 browser",
      "lossless mkv to mp4",
      "mkv to mp4 free no signup",
      "plex mkv to mp4",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "MKV to MP4 Converter",
    tagline:
      "Convert Matroska MKV files to MP4 privately in your browser. Lossless remux when your codecs allow it.",
    whyConvertParagraphs: [
      "MKV is the kitchen-sink container — it can hold anything. That flexibility is what makes it popular with desktop video tools, MakeMKV exports, and Plex / Jellyfin libraries. It's also why it's not universally supported: smart TVs, iOS Safari, and many mobile players don't accept MKV.",
      "An MKV-to-MP4 conversion's speed depends entirely on what's inside the file. If your MKV is H.264 or HEVC video paired with AAC audio (the common case for Blu-ray rips and anime releases), we'll remux it in seconds with zero quality loss. If it uses VP9, FLAC, or DTS, we have to re-encode — slower, but the output will play on every device.",
    ],
    remuxOutlook:
      "Conditional. H.264 / HEVC + AAC remuxes instantly. VP9, AV1, FLAC, DTS, or PCM audio force a re-encode to H.264 + AAC.",
    faqs: [
      {
        q: "What happens to multiple audio tracks (e.g. English + Japanese)?",
        a:
          "By default we keep all streams in the remux path via -map 0. MP4 supports multiple audio tracks; most players will let you switch between them. The first track is usually the default.",
      },
      {
        q: "What about subtitles?",
        a:
          "MP4 supports a narrow set of subtitle formats (mov_text). MKV's typical SRT/ASS subtitles don't survive a straight remux — they're dropped silently. If you need subtitles preserved, keep the original MKV alongside the MP4 with the .srt files external.",
      },
      {
        q: "Why does one of my MKVs convert instantly and another takes 5 minutes?",
        a:
          "Codecs. The fast one was H.264 + AAC and remuxed; the slow one used VP9 or had DTS audio and had to re-encode every frame. The conversion log will tell you which path ran.",
      },
      {
        q: "Will the MP4 be larger or smaller than the MKV?",
        a:
          "Remux: within a few percent of the source — MP4 has slightly different container overhead. Re-encode: usually smaller than the source if the original was high-bitrate, since libx264 at CRF 20 is efficient.",
      },
      {
        q: "Does this work for 4K / HDR content?",
        a:
          "4K resolution works fine. HDR metadata (HDR10 / Dolby Vision) is partially preserved on remux but ffmpeg.wasm's HEVC encoder doesn't write HDR sidecar data on re-encode — so re-encoded output will lose HDR.",
      },
      ...SHARED_FAQS,
    ],
  },
  {
    slug: "webm-to-mp4",
    input: "webm",
    output: "mp4",
    title: "WEBM to MP4 Converter — No Upload · Private · Fast · No Sign Up",
    description:
      "Convert WEBM (VP9/Opus) to MP4 with no upload required. Private processing in your browser, fast in-browser re-encode to H.264/AAC for universal playback, no sign up.",
    keywords: [
      "webm to mp4 converter",
      "webm to mp4 no upload",
      "webm to mp4 private",
      "webm to mp4 fast",
      "webm to mp4 no sign up",
      "vp9 to h264",
      "webm to mp4 browser",
      "webm to mp4 free no signup",
      "youtube webm to mp4",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "WEBM to MP4 Converter",
    tagline:
      "Convert WebM to MP4 in your browser. No upload, no account — just a private re-encode to a universally compatible format.",
    whyConvertParagraphs: [
      "WebM is Google's open-source web format, built around royalty-free codecs: VP8/VP9/AV1 for video, Vorbis/Opus for audio. It powers a lot of YouTube delivery and is the default output of browser APIs like MediaRecorder. The catch: iOS Safari, older Android browsers, and most desktop video editors don't accept WebM at all.",
      "Unlike MKV or MOV, a WebM-to-MP4 conversion is never a fast remux. None of WebM's codecs are allowed in the MP4 container, so we have to decode every frame and re-encode to H.264 + AAC. The good news: ffmpeg.wasm does this on your machine without uploading anything, and our CRF 20 default is visually transparent.",
    ],
    remuxOutlook:
      "Never remuxes. WebM's VP9/Opus codecs are not allowed in MP4, so every conversion is a full re-encode to H.264 + AAC. Expect minutes for long videos, not seconds.",
    faqs: [
      {
        q: "Why is WEBM conversion much slower than MKV conversion?",
        a:
          "MKV with H.264 codecs can be remuxed in seconds — only the container is rewritten. WebM forces a full re-encode because VP9 video and Opus audio aren't legal MP4 codecs. Re-encoding decodes and re-compresses every frame, which is CPU-intensive.",
      },
      {
        q: "Will the output look worse than the original WebM?",
        a:
          "There's a small generational loss inherent to re-encoding, but at our default CRF 20 it's visually transparent to most viewers. For higher fidelity, the only option is to keep the original WebM.",
      },
      {
        q: "Why convert away from WebM at all?",
        a:
          "Compatibility. WebM doesn't play on iOS Safari (until very recent versions), most smart TVs, or PowerPoint. MP4 with H.264 is the universal floor.",
      },
      {
        q: "Can I convert YouTube downloads?",
        a:
          "If you have the .webm file locally (yt-dlp etc.), yes — we don't care where it came from. We don't fetch anything from URLs; you have to provide the file.",
      },
      {
        q: "What about audio-only WebM (just Opus)?",
        a:
          "We focus on video. For audio-only conversion you're better off with a dedicated audio tool — opus → m4a/AAC.",
      },
      ...SHARED_FAQS,
    ],
  },
  {
    slug: "avi-to-mp4",
    input: "avi",
    output: "mp4",
    title: "AVI to MP4 Converter — No Upload · Private · Fast · No Sign Up",
    description:
      "Convert AVI to MP4 with no upload required. Private processing in your browser, fast in-browser re-encode of DivX/Xvid to H.264 (often shrinks file size), no sign up.",
    keywords: [
      "avi to mp4 converter",
      "avi to mp4 no upload",
      "avi to mp4 private",
      "avi to mp4 fast",
      "avi to mp4 no sign up",
      "divx to mp4",
      "xvid to mp4",
      "avi to mp4 browser",
      "avi to mp4 free no signup",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "AVI to MP4 Converter",
    tagline:
      "Convert vintage AVI files to MP4 right in your browser. No upload — your old footage stays on your machine.",
    whyConvertParagraphs: [
      "AVI is Microsoft's container from 1992. It was the workhorse of the DivX / Xvid era and is still found in old DVD rips, early-2000s camcorder dumps, and screen recordings from tools that haven't been updated in 15 years. Most modern devices have quietly dropped AVI support.",
      "Most AVI files use MPEG-4 Part 2 video (DivX or Xvid) and MP3 audio. MPEG-4 Part 2 isn't strictly allowed in MP4 by the spec — so an AVI-to-MP4 conversion almost always means re-encoding to H.264. The benefit: the re-encoded MP4 is usually smaller than the original AVI thanks to H.264's better compression, and it plays on everything.",
    ],
    remuxOutlook:
      "Typically re-encodes. AVI's classic DivX/Xvid video isn't valid in MP4. If your AVI happens to contain H.264 (rare but possible), it'll remux.",
    faqs: [
      {
        q: "Why doesn't AVI remux to MP4 like MKV sometimes does?",
        a:
          "Codec compatibility. AVI's typical contents (MPEG-4 Part 2, MP3) aren't on the MP4 spec's whitelist, so the encoder has to be invoked. MKV often contains H.264 + AAC directly, which is why it remuxes more often.",
      },
      {
        q: "Will my MP4 be smaller than the AVI?",
        a:
          "Usually yes. H.264 compresses ~2× better than the DivX / Xvid codecs typical AVIs use. A 2 GB AVI often re-encodes to around 800 MB to 1.2 GB at near-identical quality.",
      },
      {
        q: "What about my old camcorder AVI? Will it work?",
        a:
          "Yes — those typically use DV or MJPEG video, both of which decode fine in ffmpeg. The output MP4 will be much smaller than the source because DV is essentially uncompressed.",
      },
      {
        q: "Does this preserve my external .srt subtitle file?",
        a:
          "No — subtitles in the AVI workflow are typically external (.srt next to .avi). We only convert the video file. Keep the .srt — most players will pick it up automatically next to the MP4 if you rename it to match.",
      },
      {
        q: "Why is my AVI playing audio out of sync after conversion?",
        a:
          "Old AVI files sometimes have VBR MP3 audio with inaccurate sync metadata. ffmpeg generally handles this, but extremely old captures may need the -async or -vsync flags. If you hit this, open an issue with a sample file.",
      },
      ...SHARED_FAQS,
    ],
  },
  {
    slug: "flv-to-mp4",
    input: "flv",
    output: "mp4",
    title: "FLV to MP4 Converter — No Upload · Private · Fast · No Sign Up",
    description:
      "Convert FLV (Flash Video) to MP4 with no upload required. Private processing in your browser, fast remux for H.264 + AAC files (most post-2008 FLVs), no sign up.",
    keywords: [
      "flv to mp4 converter",
      "flv to mp4 no upload",
      "flv to mp4 private",
      "flv to mp4 fast",
      "flv to mp4 no sign up",
      "flash video to mp4",
      "flv to mp4 browser",
      "flv to mp4 free no signup",
      "old youtube flv to mp4",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "FLV to MP4 Converter",
    tagline:
      "Rescue your Flash Video archives. Convert FLV to MP4 locally in your browser — no upload, no account.",
    whyConvertParagraphs: [
      "FLV was Adobe's container for video delivered via the Flash plugin. It powered early YouTube, pre-HTML5 Twitch, and a generation of Hulu / Vimeo content. Flash itself is gone, but the file archives remain — and almost nothing plays FLV natively anymore.",
      "Most FLV files from the late-2000s onward already contain H.264 video and AAC audio, the same codecs MP4 uses. That means a fast remux: the video stream is copied bit-for-bit, the container is swapped, and you get a modern MP4 in seconds. Older FLV files (VP6, H.263, Nellymoser audio) will re-encode.",
    ],
    remuxOutlook:
      "Usually remuxes. H.264 + AAC FLVs (most files made after ~2008) become MP4 in seconds. Older H.263 / VP6 files re-encode.",
    faqs: [
      {
        q: "I have old yt-dlp / youtube-dl archives in FLV. Will they work?",
        a:
          "Almost certainly. YouTube switched FLV deliveries to H.264 + AAC well before phasing out the format, and yt-dlp's older downloads typically contain those codecs. Expect a remux.",
      },
      {
        q: "What about really old FLV files from 2006-era YouTube?",
        a:
          "Those often use Sorenson Spark (H.263 variant) and Nellymoser or MP3 audio. Neither is allowed in MP4, so we'll re-encode. The output will be more compatible but slightly larger.",
      },
      {
        q: "Are FLV files dangerous? I heard Flash had vulnerabilities.",
        a:
          "The vulnerabilities were in the Flash Player runtime, not the FLV file format. Just having an FLV file on your disk does nothing — there's no embedded code execution. Converting it here is also safe; ffmpeg is reading bytes and writing bytes.",
      },
      {
        q: "Can I open the output on my phone?",
        a:
          "Yes — MP4 plays natively on iOS and Android. That's the whole point of the conversion.",
      },
      {
        q: "What's the difference between FLV and F4V?",
        a:
          "F4V is Adobe's MP4-compatible container they introduced when transitioning away from FLV. F4V files essentially are MP4 files and don't need conversion (just renaming the extension to .mp4 often works).",
      },
      ...SHARED_FAQS,
    ],
  },
  {
    slug: "mpeg-to-mp4",
    input: "mpeg",
    output: "mp4",
    title: "MPEG to MP4 Converter — No Upload · Private · Fast · No Sign Up",
    description:
      "Convert MPEG (MPEG-1 / MPEG-2) videos to MP4 with no upload required. Private processing in your browser, fast in-browser re-encode to H.264 for universal playback, no sign up.",
    keywords: [
      "mpeg to mp4 converter",
      "mpeg to mp4 no upload",
      "mpeg to mp4 private",
      "mpeg to mp4 fast",
      "mpeg to mp4 no sign up",
      "mpg to mp4",
      "mpeg-2 to mp4",
      "mpeg to mp4 browser",
      "mpeg to mp4 free no signup",
      ...BENEFIT_KEYWORDS,
    ],
    h1: "MPEG to MP4 Converter",
    tagline:
      "Convert MPEG-1 / MPEG-2 videos to MP4 in your browser. Privately. Without uploading a single byte.",
    whyConvertParagraphs: [
      "MPEG files contain MPEG-1 or MPEG-2 video — the codecs that powered VideoCDs (1993) and DVDs (1996). They're still found in archived broadcast footage, ripped DVDs, and a lot of \"family memories on a hard drive somewhere\". Modern devices increasingly drop support for these old codecs.",
      "MP4 (MPEG-4 Part 14) doesn't allow MPEG-1 or MPEG-2 video inside it. That means an MPEG-to-MP4 conversion is always a re-encode to H.264, never a fast remux. The upside: H.264 is 5–10× more efficient, so your converted MP4 will be dramatically smaller than the source at the same visual quality.",
    ],
    remuxOutlook:
      "Never remuxes. MPEG-1 and MPEG-2 video aren't valid in MP4. Every conversion is a full re-encode to H.264 + AAC.",
    faqs: [
      {
        q: "Why is MPEG conversion always slower than TS or MKV?",
        a:
          "Because the video codec changes. TS and MKV usually wrap H.264 (MP4-compatible) and remux in seconds. MPEG wraps MPEG-1/2, which the MP4 spec disallows — so every frame has to be decoded and re-encoded as H.264.",
      },
      {
        q: "What about DVD VOB files?",
        a:
          "VOB is MPEG-2 video wrapped in a DVD-specific container. Conceptually the same conversion path (decode MPEG-2, encode H.264), but we don't currently expose a /vob-to-mp4 route. Rename .vob to .mpg and this converter will handle it.",
      },
      {
        q: "How much smaller will the output be?",
        a:
          "Typically 3–5× smaller for DVD-quality footage. A 4 GB MPEG-2 home movie often becomes around 800 MB–1.2 GB of H.264 MP4 with no visible quality loss.",
      },
      {
        q: "Will I lose interlacing artifacts from old broadcast footage?",
        a:
          "ffmpeg defaults to keeping the source field order. We don't auto-deinterlace, which means if your source is interlaced (480i / 576i), the output stays interlaced. Most modern players deinterlace on the fly, so playback looks fine.",
      },
      {
        q: "MP3 audio inside my MPEG — will it survive?",
        a:
          "It'll be re-encoded to AAC during the video re-encode. AAC at 192 kbps is transparent to almost everyone.",
      },
      ...SHARED_FAQS,
    ],
  },
];

export function getConverter(slug: string): ConverterConfig | null {
  return CONVERTERS.find((c) => c.slug === slug) ?? null;
}

export function getConverterFormat(slug: string) {
  const c = getConverter(slug);
  return c ? FORMATS[c.input] : null;
}

/**
 * Pick N other converters to surface as "related" links — used both for
 * cross-linking SEO authority and for letting users explore the catalog.
 *
 * Strategy: prefer converters with the same remux likelihood (similar UX),
 * then any others, capped at N.
 */
export function getRelatedConverters(
  slug: string,
  n: number = 4,
): ConverterConfig[] {
  const current = getConverter(slug);
  if (!current) return CONVERTERS.slice(0, n);
  const currentFormat = FORMATS[current.input];

  const others = CONVERTERS.filter((c) => c.slug !== slug);
  const sameTier = others.filter(
    (c) => FORMATS[c.input].remuxLikelihood === currentFormat.remuxLikelihood,
  );
  const rest = others.filter(
    (c) => FORMATS[c.input].remuxLikelihood !== currentFormat.remuxLikelihood,
  );
  return [...sameTier, ...rest].slice(0, n);
}
