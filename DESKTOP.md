# Desktop app build guide

Native macOS + Windows app built with **Tauri 2**. Reuses the same React UI as the web app — only the conversion engine is swapped (native `ffmpeg` sidecar instead of `ffmpeg.wasm`).

## Why a desktop app exists

The browser version is capped at 4 GB per file by the 32-bit WebAssembly memory addressing limit. The desktop app uses native ffmpeg, which has no such cap, and runs multi-core encoding much faster than WASM. Same privacy guarantee — files never leave the user's machine.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Tauri Window (system WebView: WKWebView or WebView2)   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Same Next.js React UI                             │  │
│  │  ConverterClient → desktop-engine.ts               │  │
│  │       │                                             │  │
│  │       ▼ Tauri invoke("convert_video")               │  │
│  └───────│───────────────────────────────────────────┘  │
│          ▼                                                │
│  Rust IPC handler (src-tauri/src/lib.rs)                  │
│          │                                                │
│          ▼ shell.sidecar("ffmpeg").spawn()                │
│  Bundled native ffmpeg binary                              │
└─────────────────────────────────────────────────────────┘
```

`isDesktop()` in [lib/desktop-bridge.ts](lib/desktop-bridge.ts) sniffs `window.__TAURI_INTERNALS__`. `ConverterClient.ensureEngine()` lazy-imports either `desktop-engine.ts` or `converter-engine.ts` based on that flag — the rest of the UI doesn't know which runtime it's in.

## Prerequisites

1. **Rust toolchain** (1.77+):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Platform-specific build deps:**
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
   - **Windows:** [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 runtime (preinstalled on Win 11)
   - **Linux:** `webkit2gtk-4.1`, `libsoup-3.0`, `librsvg2-dev`, `pkg-config`

3. **Tauri CLI** (auto-installed via `npm install`, or globally):
   ```bash
   cargo install tauri-cli --version "^2.0"
   ```

## One-time setup

```bash
# 1. Install npm deps (adds @tauri-apps/* packages)
npm install

# 2. Add the ffmpeg sidecar binaries — see src-tauri/binaries/README.md
#    macOS Apple Silicon example:
cp $(brew --prefix ffmpeg)/bin/ffmpeg \
   src-tauri/binaries/ffmpeg-aarch64-apple-darwin

# 3. Generate app icons from a single 1024×1024 source PNG
npx tauri icon path/to/source.png
```

## Development

```bash
npm run tauri:dev
```

This:
1. Starts `next dev` on http://localhost:5210
2. Builds the Rust shell in debug mode
3. Opens a native window pointing at the dev server

Hot reload works for React changes. Rust changes require restarting `tauri:dev`.

## Production builds

```bash
# macOS — produces a signed .app + .dmg in src-tauri/target/release/bundle
npm run tauri:build

# Cross-compile for both Apple Silicon and Intel
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri:build -- --target universal-apple-darwin

# Windows — produces .msi installer
npm run tauri:build
```

Artifacts land in `src-tauri/target/release/bundle/`.

## Code signing & distribution

For users to install without "unidentified developer" warnings:

- **macOS:** Apple Developer ID certificate ($99/yr). Configure in `tauri.conf.json` → `bundle.macOS.signingIdentity`. After signing, run `xcrun notarytool submit` for Gatekeeper notarization.
- **Windows:** Authenticode certificate from a CA (DigiCert, Sectigo, etc.). Configure in `tauri.conf.json` → `bundle.windows.certificateThumbprint`.

Unsigned builds work for personal use but users will get OS warnings on first launch.

## Hosting the installers

Once you have signed `.dmg` and `.msi` artifacts, wire them into the website's `/download` page by editing the `BUILD_LINKS` constant in [components/DownloadCards.tsx](components/DownloadCards.tsx). The "Build pending" buttons swap to real download links automatically when those values are non-empty.

GitHub Releases is the easy host:
```bash
gh release create v0.1.0 \
  src-tauri/target/release/bundle/dmg/LocalVideoConverter*.dmg \
  src-tauri/target/release/bundle/msi/LocalVideoConverter*.msi
```

## What's bundled in the .dmg / .msi

- The Tauri Rust binary (~10 MB)
- The Next.js static export (`out/` from `npm run build:desktop`, ~1 MB)
- Per-platform ffmpeg binary (~30–80 MB depending on enabled codecs)
- App icons + Info.plist / manifest

Total: typically **40–100 MB** depending on ffmpeg build.

## Differences vs. the web app

| | Web | Desktop |
|---|---|---|
| Engine | ffmpeg.wasm (WASM) | Native ffmpeg (system binary, sidecar-bundled) |
| Max file size | 4 GB | Unlimited (disk only) |
| Encode speed | 5–15 fps (ST), 10–30 (MT) | Multi-core native speed |
| File picker | `<input type="file">` | Native open dialog |
| Output | Browser download (Blob URL) | Native save dialog → file on disk |
| First-run download | ~30 MB ffmpeg core via CDN | Zero — everything bundled |
| Internet required | First load only | Never |

## Known TODOs

- [ ] Add native menu bar (File → Open, Edit, View, Help → About)
- [ ] Window state persistence (size, position)
- [ ] Drag-and-drop from Finder/Explorer using Tauri's native drop event (currently goes through browser DnD which works but doesn't expose the file path)
- [ ] Auto-updater plugin (Tauri's `updater` plugin can fetch signed update bundles from GitHub Releases)
- [ ] Code-signed CI pipeline (GitHub Actions can do macOS notarization + Windows signing if certs are in repo secrets)
