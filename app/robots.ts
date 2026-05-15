import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Same reason as sitemap.ts — needed for the Tauri static-export build.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // ffmpeg internals shouldn't be crawled — they're not indexable pages.
        disallow: ["/ffmpeg/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
