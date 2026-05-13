import type { JsonLd } from "@/lib/structured-data";

/**
 * Server-rendered JSON-LD script tag. Pass one or more schema objects from
 * lib/structured-data — they get inlined as application/ld+json so crawlers
 * (Google, Bing) pick them up without executing client JS.
 */
export function StructuredData({ data }: { data: JsonLd | JsonLd[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
