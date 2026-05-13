# App icons

Tauri expects the following icon files in this directory:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png` (256×256)
- `icon.icns` (macOS bundle icon)
- `icon.ico` (Windows installer icon)

## Easiest way to generate them all

```bash
npm install -g @tauri-apps/cli
tauri icon path/to/source.png
```

This takes a single 1024×1024 PNG source and generates every size + the
`.icns` and `.ico` bundles automatically.

The current directory is intentionally placeholder-only — `npm run tauri dev`
will fail to bundle the app icon until you run `tauri icon` once.
