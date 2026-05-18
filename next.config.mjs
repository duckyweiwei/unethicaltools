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
  // libheif-js is a ~5 MB Emscripten browser-only module — its top-level
  // require() chain calls Node-specific APIs that explode during Next.js's
  // server-side prerender of routes that transitively import it. Marking
  // it server-external means the server never tries to bundle it; the
  // client lazy-loads it at runtime via `await import('libheif-js')`.
  serverExternalPackages: ["libheif-js"],
  webpack: (config, { isServer }) => {
    // transformers.js v4 uses `import.meta` patterns that webpack flags as a
    // "Critical dependency" warning on every compile. The package works fine
    // at runtime in the browser — the warning is just bundler noise and
    // makes the dev log unreadable when iterating on the bleep/transcribe
    // tools. Suppress it specifically; do not blanket-ignore other warnings.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /node_modules\/@huggingface\/transformers/,
        message: /Critical dependency: Accessing import\.meta directly/,
      },
      // libheif-js's Emscripten bundle has the same import.meta noise.
      {
        module: /node_modules\/libheif-js/,
        message: /Critical dependency/,
      },
    ];
    // libheif-js is an Emscripten "universal" module — its top-level
    // body does `require("fs")` / `require("path")` for the Node branch.
    // In the browser bundle those modules don't exist; webpack's default
    // behavior is to fail with "module not found". Polyfilling to `false`
    // tells webpack to emit an empty module for those, which is correct
    // since the Node branch never executes in a browser.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
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
