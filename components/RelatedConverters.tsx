import Link from "next/link";
import { FORMATS } from "@/lib/formats";
import type { ConverterConfig } from "@/lib/converters";

/**
 * Internal-link grid surfacing other format pages. Each card uses the related
 * converter's own data — short tagline + remux outlook tag — so the link
 * carries real intent for both users and crawlers.
 */
export function RelatedConverters({
  items,
  heading = "More private video converters",
}: {
  items: ConverterConfig[];
  heading?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-20 sm:mt-28">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
          Related converters
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
          {heading}
        </h2>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((c) => {
          const f = FORMATS[c.input];
          const tone =
            f.remuxLikelihood === "high"
              ? { label: "Instant remux", cls: "text-emerald-300/90 border-emerald-400/25" }
              : f.remuxLikelihood === "medium"
                ? { label: "Mixed", cls: "text-cyan-300/90 border-cyan-400/25" }
                : { label: "Re-encodes", cls: "text-amber-300/90 border-amber-400/25" };
          return (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}`}
                className="group block rounded-2xl glass p-5 transition-colors hover:border-[var(--color-border-strong)]"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm font-medium tracking-tight text-[var(--color-text)]">
                    {f.displayName} → MP4
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${tone.cls}`}
                  >
                    {tone.label}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                  {c.tagline}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
                  Open converter
                  <ArrowIcon />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform group-hover:translate-x-0.5"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
