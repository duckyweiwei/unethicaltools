import type { MetadataRoute } from "next";

const BASE_URL = "https://unethicaltools.com";

// Advisory, not a security control: steer well-behaved crawlers to the indexable
// marketing/tool pages and away from the one server endpoint (the expensive PDF
// parser), and point them at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
