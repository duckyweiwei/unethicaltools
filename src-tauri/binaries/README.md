# ffmpeg sidecar binaries

Tauri bundles a per-platform `ffmpeg` binary alongside the app and our Rust
code shells out to it via the `shell` plugin's sidecar API.

## Required filenames

Place a static, no-runtime-deps `ffmpeg` build at each of:

| Target              | Filename                                      |
|---------------------|-----------------------------------------------|
| macOS Apple Silicon | `ffmpeg-aarch64-apple-darwin`                 |
| macOS Intel         | `ffmpeg-x86_64-apple-darwin`                  |
| Windows x64         | `ffmpeg-x86_64-pc-windows-msvc.exe`           |
| Linux x64           | `ffmpeg-x86_64-unknown-linux-gnu` *(optional)*|

Tauri picks the right one at runtime based on the user's platform.

## Where to get them

Use static builds (no `libavcodec.so` runtime requirement):

- **macOS:** https://www.osxexperts.net or `brew install ffmpeg` and copy the binary
  ```bash
  cp $(brew --prefix ffmpeg)/bin/ffmpeg src-tauri/binaries/ffmpeg-aarch64-apple-darwin
  ```
- **Windows:** https://www.gyan.dev/ffmpeg/builds/ (download "release essentials" build, copy `bin/ffmpeg.exe`)
- **Linux:** https://johnvansickle.com/ffmpeg/ (static builds)

## Why static

Dynamic ffmpeg builds link against `libavcodec` / `libavformat` / `libavutil`
shared objects that may not exist on the user's machine. A static build is
self-contained — drop it next to the app and it runs.

Expected size per binary: ~30–80 MB.

## License compliance

ffmpeg is LGPL/GPL depending on which codecs are compiled in. If you bundle
a GPL build (e.g. one with `--enable-gpl --enable-libx264`), the resulting
desktop app is GPL too. Most distributions of static ffmpeg are GPL.

For our use case (libx264 encode fallback), GPL is fine — but if you ship the
desktop app commercially, make sure your distribution complies with GPL
(source available, etc.) or use an LGPL-only build without `--enable-gpl`.

## Verifying the bundle

After placing the binaries, `npm run tauri dev` should produce no
"ffmpeg sidecar not found" error in the dev console. In production builds,
Tauri ships only the binary matching the build target.
