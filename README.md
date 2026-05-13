# Local Video Converter

A scalable, SEO-driven local video conversion platform. One shared ffmpeg.wasm engine — many format-specific pages.

> **Convert videos locally in your browser. No upload. Private. Fast.**

## What it does

Converts video files to MP4 **entirely client-side** using `ffmpeg.wasm`. Tries a lossless remux first (`-c copy`), falls back to H.264 + AAC re-encoding only when codec compatibility forces it.

Currently supports:

| Format | Slug | Remux outlook |
|---|---|---|
| TS / MTS / M2TS | [/ts-to-mp4](/ts-to-mp4) | Instant remux |
| MOV (QuickTime) | [/mov-to-mp4](/mov-to-mp4) | Usually instant remux |
| MKV (Matroska) | [/mkv-to-mp4](/mkv-to-mp4) | Conditional on codecs |
| WEBM (VP9/Opus) | [/webm-to-mp4](/webm-to-mp4) | Always re-encodes |
| AVI (DivX/Xvid) | [/avi-to-mp4](/avi-to-mp4) | Usually re-encodes |
| FLV (Flash Video) | [/flv-to-mp4](/flv-to-mp4) | Usually instant remux |
| MPEG (MPEG-1/2) | [/mpeg-to-mp4](/mpeg-to-mp4) | Always re-encodes |

## Stack

- **Next.js 15** App Router + **React 19**
- **TypeScript 5**, **Tailwind CSS v4**
- **ffmpeg.wasm 0.12** — multi-thread core with single-thread fallback
- All pages are statically generated at build time (`generateStaticParams`)

## Getting started

```bash
cd ts-to-mp4-converter
npm install           # postinstall syncs public/ffmpeg/
npm run dev
```

Open <http://localhost:3000> in Chrome.

## Architecture

```
app/
  layout.tsx                Root metadata (metadataBase, OG defaults)
  globals.css               Tailwind v4 + animations
  page.tsx                  Landing hub (lists every converter)
  [converter]/page.tsx      Per-format SEO page — STATIC at build time
  sitemap.ts                /sitemap.xml — auto-includes every converter
  robots.ts                 /robots.txt

components/
  AnimatedBackground          Gradient orbs + grid overlay
  SiteNav                     Top nav (home + all-converters link)
  Hero / FormatHero           Landing hero / per-format hero
  FeatureBadges               "No Upload / Private / Fast / No Sign Up"
  ConverterHub                Landing-page format grid
  VideoConverter              Shared converter UI (takes inputFormat prop)
    DropZone                  Drag-drop, format-aware accept= filter
    FilePreview               Detected format badge + remux outlook hint
    ProgressView              Progress bar, ETA, step indicators, log panel
    ResultView                Download + stats (size ratio, mode, duration)
    ErrorView                 Error + retry
  FormatExplainer             Per-format "what is this" + remux outlook
  FAQ                         Native <details> accordion (FAQ-rich-snippet ready)
  RelatedConverters           Cross-link grid → other format pages
  InfoSection                 Local-vs-cloud comparison
  Footer
  StructuredData              JSON-LD script tag renderer

lib/
  site.ts                     SITE_URL, names, absoluteUrl()
  formats.ts                  Format registry (one entry per input format)
  converters.ts               Per-converter content (slug, copy, FAQs)
  structured-data.ts          WebApplication, FAQPage, BreadcrumbList JSON-LD
  types.ts                    Engine/UI types
  format.ts                   Bytes/duration/ETA formatters
  converter-engine.ts         ffmpeg.wasm wrapper (format-agnostic)
  converter-client.ts         Lazy-import facade

public/ffmpeg/                FFmpeg class worker, served unbundled (see below)
scripts/sync-ffmpeg.mjs       postinstall: keeps public/ffmpeg/ in sync
```

## Adding a new converter

Two edits, no new components:

1. **`lib/formats.ts`** — add a `FormatConfig` entry for the input format (extensions, MIME types, remux likelihood, optional bitstream-filter args).
2. **`lib/converters.ts`** — add a `ConverterConfig` entry (slug, unique copy, FAQs, keywords).

That's it. `app/[converter]/page.tsx`'s `generateStaticParams` reads from the registry, so the new page is statically generated. `sitemap.ts` includes it automatically. SEO metadata + JSON-LD is built from the same config.

## SEO architecture

Each `/[slug]` page has:

- Unique `<title>` and `<meta description>` from `ConverterConfig`
- Canonical URL via `alternates.canonical`
- Open Graph + Twitter Card metadata
- JSON-LD: `WebApplication` + `FAQPage` + `BreadcrumbList`
- Unique long-form intro, format explainer, and ~9 FAQ entries (5 format-specific + 4 shared)
- Cross-links to related converters (varies by remux tier to spread internal authority)

All pages are pre-rendered HTML — no client-side routing for the initial render. The ffmpeg.wasm chunk is lazy-loaded only on Convert click.

## How the engine works

1. **Detect format** — `detectFormatFromFile()` reads the extension first, then MIME. If the dropped file doesn't match the page's input format, the engine still uses the detected one (a user on `/mkv-to-mp4` dropping a `.mov` gets the MOV pipeline).
2. **Load ffmpeg.wasm** — multi-thread core if `crossOriginIsolated` (COOP/COEP headers in [next.config.mjs](next.config.mjs)), else single-thread.
3. **Remux** with `-c copy` plus any format-specific bitstream filter (e.g. `aac_adtstoasc` for TS). Skipped entirely for formats with `remuxLikelihood: "none"` (WebM, MPEG).
4. **Encode fallback** with `libx264 -preset veryfast -crf 20 -c:a aac -b:a 192k`.
5. **Output** — the resulting Uint8Array is wrapped in a Blob, served via Object URL for download.

## Why `public/ffmpeg/` exists

ffmpeg.wasm's FFmpeg class spawns its own internal worker:

```js
new Worker(new URL("./worker.js", import.meta.url), { type: "module" })
```

When Webpack/Turbopack bundles that worker file, the dynamic `import(coreURL)` inside it gets replaced with a Webpack `require()` stub that throws **"Cannot find module 'blob:..."** at runtime. To bypass bundling, we copy the ESM worker (and its `./const.js` / `./errors.js` siblings) into `public/ffmpeg/` via the `postinstall` script ([scripts/sync-ffmpeg.mjs](scripts/sync-ffmpeg.mjs)) and pass an absolute URL via `classWorkerURL`. The browser then loads `worker.js` directly over HTTP, resolves its relative imports against `/ffmpeg/`, and dynamic blob-URL imports work natively.

## Browser support

| Browser | Status |
|---|---|
| Chrome / Edge (desktop) | **Primary target.** Multi-thread core, fastest. |
| Firefox (desktop)       | Works. MT core when COOP/COEP headers present. |
| Safari (desktop)        | Works on 16.4+. ST fallback may engage. |
| Mobile browsers         | Best-effort. RAM-bound: keep files under ~500 MB. |

## Privacy

There is no analytics, no telemetry, and no upload endpoint in this codebase. You can verify by grepping for `fetch(` in `app/`, `components/`, `lib/`. The only network calls are to `unpkg.com` to fetch the one-time ffmpeg-core WASM bundle.

## License

MIT
