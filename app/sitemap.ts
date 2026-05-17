import type { MetadataRoute } from "next";
import { CONVERTERS } from "@/lib/converters";
import { SITE_URL } from "@/lib/site";

/**
 * Sitemap. Includes the homepage + every /[converter] page.
 * Next.js generates /sitemap.xml from this at build time.
 *
 * `dynamic = "force-static"` lets the desktop static-export build (Tauri
 * uses `output: "export"`) generate the file at build time instead of
 * needing a server. The web Vercel build also benefits — no per-request
 * regeneration cost.
 */
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const home: MetadataRoute.Sitemap[number] = {
    url: SITE_URL,
    lastModified,
    changeFrequency: "weekly",
    priority: 1,
  };

  const download: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/download`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  };

  const about: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/about`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  };

  const bleep: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/bleep`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  };

  const transcribe: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/transcribe`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  };

  const tools: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/tools`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  };

  const convertersHub: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/converters`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.85,
  };

  const faq: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/faq`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  };

  const suggestions: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/suggestions`,
    lastModified,
    changeFrequency: "yearly",
    priority: 0.3,
  };

  const converters: MetadataRoute.Sitemap = CONVERTERS.map((c) => ({
    url: `${SITE_URL}/${c.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  return [home, tools, convertersHub, bleep, transcribe, about, faq, download, suggestions, ...converters];
}
