import Link from "next/link";
import { CONVERTERS } from "@/lib/converters";
import { FORMATS } from "@/lib/formats";

/**
 * Landing-page grid of every available converter. Acts as both the human
 * entry point and a dense internal-linking surface for crawlers.
 */
export function ConverterHub() {
  return (
    <section
      id="converters"
      className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 sm:mt-16"
    >
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
          Pick a format
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
          {CONVERTERS.length} private video converters, all in your browser
        </h2>
        <p className="mt-3 mx-auto max-w-2xl text-[var(--color-text-muted)]">
          Same engine. Same privacy guarantee. Pick your input format below —
          MP4 conversion happens locally, with no upload.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {CONVERTERS.map((c) => {
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
                className="group block rounded-2xl glass p-5 transition-all hover:border-[var(--color-border-strong)] hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-base font-medium tracking-tight text-[var(--color-text)]">
                    {f.displayName}{" "}
                    <span className="text-[var(--color-text-dim)]">→</span>{" "}
                    MP4
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
