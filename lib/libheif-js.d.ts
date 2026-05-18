/**
 * Ambient module declaration for libheif-js — the package ships no .d.ts
 * file. We only consume `HeifDecoder` and the per-image `display` callback;
 * shape is documented in the library's README + source.
 *
 * Kept loose (`unknown` shapes) since dynamic-import returns either the
 * factory or an ESM-wrapped namespace depending on bundler interop, and
 * lib/image-engine.ts narrows at runtime.
 */
declare module "libheif-js" {
  const libheif: unknown;
  export default libheif;
  export const HeifDecoder: unknown;
}
