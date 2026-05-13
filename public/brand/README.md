# Brand assets

Save the two source images here. The website + Tauri app pick them up automatically.

| File | What | Used by |
|---|---|---|
| `wordmark.png` | Full "unethicaletools" wordmark (with beaver) | SiteNav (website only — invert filter is applied so dark logo shows white on dark bg) |
| `icon.png` | 1024×1024 square app icon (beaver with wrench) | Small brand mark in DesktopHub header + source for all Tauri platform icons |

After saving, run **once**:

```bash
npx tauri icon public/brand/icon.png
```

That regenerates every Tauri icon size (32x32, 128x128, 128x128@2x, icon.icns, icon.ico, Android/iOS variants) from the square source. No other manual work needed.
