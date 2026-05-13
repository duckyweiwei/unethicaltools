import type { FAQ as FAQItem } from "@/lib/converters";

/**
 * Server-rendered FAQ with native <details> elements. No client JS needed —
 * accessible, keyboard-friendly, and gets indexed by Google's FAQ rich result
 * crawler thanks to the matching FAQPage JSON-LD emitted alongside.
 */
export function FAQ({ items, title }: { items: FAQItem[]; title?: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-20 sm:mt-28">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
          Questions & answers
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
          {title ?? "FAQ"}
        </h2>
      </div>

      <div className="space-y-2.5">
        {items.map((it, i) => (
          <details
            key={i}
            className="group glass rounded-2xl px-5 py-4 transition-colors hover:border-[var(--color-border-strong)]"
          >
            <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
              <h3 className="text-sm sm:text-base font-medium tracking-tight text-[var(--color-text)] pr-2">
                {it.q}
              </h3>
              <span
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-[var(--color-border)] flex items-center justify-center transition-transform group-open:rotate-45"
              >
                <PlusIcon />
              </span>
            </summary>
            <p className="mt-3 text-sm text-[var(--color-text-muted)] leading-relaxed">
              {it.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-text-muted)]"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
