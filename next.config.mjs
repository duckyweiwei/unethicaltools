/**
 * Dual-mode Next.js config.
 *
 * Web build (default):
 *   - SSR/SSG + COOP/COEP headers so ffmpeg.wasm can use SharedArrayBuffer
 *     for the multi-thread core.
 *
 * Desktop build (`BUILD_TARGET=desktop next build`):
 *   - Static export to `out/`, which Tauri loads as the webview's frontend.
 *   - No headers (Tauri uses a custom scheme; security model is different).
 *   - Trailing slashes on (better matches how Tauri serves files).
 */
const isDesktop = process.env.BUILD_TARGET === "desktop";

const securityHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Honor NEXT_DIST_DIR so the Tauri dev server can use its own build
  // directory (.next-tauri/) and avoid corrupting the website preview's
  // .next/ when both are running at the same time.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  ...(isDesktop
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async headers() {
          return [{ source: "/(.*)", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
