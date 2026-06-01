import type { MetadataRoute } from "next";
import { getLandingSlugs } from "@/lib/seo/landing";

const BASE_URL = "https://unethicaltools.com";

// Only the statically-rendered marketing/info pages belong here. /library and the
// review/play surfaces hydrate from the visitor's own localStorage — there's no
// shared content to index, so they're deliberately left out.

// Static content pages (info + legal), with a rough priority for each.
const CONTENT_PAGES: Array<{ path: string; priority: number }> = [
  { path: "/exams", priority: 0.7 },
  { path: "/about", priority: 0.6 },
  { path: "/help", priority: 0.6 },
  { path: "/contact", priority: 0.4 },
  { path: "/report", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
  { path: "/privacy", priority: 0.3 },
  { path: "/privacy-settings", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${BASE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    {
      url: `${BASE_URL}/tools/pdf-to-quiz`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...CONTENT_PAGES.map(({ path, priority }) => ({
      url: `${BASE_URL}${path}`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority,
    })),
    // Audience hubs + subject pages (IB/IGCSE today; extends with the registry).
    ...getLandingSlugs().map((slug) => ({
      url: `${BASE_URL}/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
