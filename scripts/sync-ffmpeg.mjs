#!/usr/bin/env node
/**
 * Copies the FFmpeg class worker (and its sibling ESM modules) from
 * node_modules into public/ffmpeg/.
 *
 * Why: ffmpeg.wasm spawns its own internal Web Worker via
 *   new Worker(new URL("./worker.js", import.meta.url), { type: "module" })
 * inside the @ffmpeg/ffmpeg package. When Webpack/Turbopack bundles that
 * worker, the dynamic `import(coreURL)` inside it gets replaced with a
 * require() stub that throws "Cannot find module 'blob:...'" at runtime.
 *
 * Serving the worker (and its `./const.js` / `./errors.js` siblings) from
 * /public/ bypasses bundling entirely — the browser loads the ESM module
 * worker over HTTP, resolves its relative imports natively, and dynamic
 * import of blob URLs works as expected.
 */
import { mkdir, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "node_modules/@ffmpeg/ffmpeg/dist/esm");
const DEST = join(ROOT, "public/ffmpeg");

const FILES = ["worker.js", "const.js", "errors.js", "types.js"];

async function main() {
  if (!existsSync(SRC)) {
    console.warn(
      `[sync-ffmpeg] ${SRC} not found — skipping. Run after \`npm install\`.`,
    );
    return;
  }
  await mkdir(DEST, { recursive: true });
  for (const f of FILES) {
    const src = join(SRC, f);
    const dst = join(DEST, f);
    if (!existsSync(src)) {
      console.warn(`[sync-ffmpeg] missing source: ${src}`);
      continue;
    }
    await copyFile(src, dst);
  }
  const copied = (await readdir(DEST)).filter((n) => n.endsWith(".js"));
  console.log(`[sync-ffmpeg] copied ${copied.length} files → public/ffmpeg/`);
}

main().catch((err) => {
  console.error("[sync-ffmpeg] failed:", err);
  process.exitCode = 1;
});
