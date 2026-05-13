/**
 * Site-wide constants. The `SITE_URL` is read by sitemap.ts, robots.ts, and
 * `metadataBase` in app/layout.tsx to build absolute URLs for OG cards and
 * canonical links. Override at build/deploy time with NEXT_PUBLIC_SITE_URL.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://ts-to-mp4.example.com";

export const SITE_NAME = "unethical tools";
export const PRODUCT_NAME = "Local Video Converter";
export const SITE_TAGLINE = "Convert videos privately in your browser.";
export const SITE_AUTHOR = "unethical tools";

/** Twitter handle used in metadata. Leave blank to omit. */
export const TWITTER_HANDLE = "";

/**
 * Address the /suggestions form composes mailto: links to. Override at
 * deploy time with NEXT_PUBLIC_CONTACT_EMAIL. Falls back to a placeholder
 * so the page still renders during development without a real address.
 */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ??
  "feedback@localvideoconverter.example";

/** Per-page absolute URL builder. */
export function absoluteUrl(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${SITE_URL}${path}`;
}
