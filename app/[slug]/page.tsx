/**
 * Top-level dynamic route for the SEO landing pages (audience hubs and subject
 * pages). It resolves a single slug against the landing registry. Static routes
 * (/about, /library, /tools/…) take precedence, and `dynamicParams = false`
 * means any slug NOT produced by generateStaticParams 404s — so this route only
 * ever serves the known landing pages and never shadows the rest of the app.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLanding, getLandingSlugs, landingSeo } from "@/lib/seo/landing";
import { LandingPage } from "@/components/landing/LandingPage";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return getLandingSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) return {};
  const { title, description } = landingSeo(landing);
  return {
    title,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: "website",
      url: `/${slug}`,
      title: `${title} · unethicaltools`,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function LandingRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) notFound();
  return <LandingPage landing={landing} />;
}
