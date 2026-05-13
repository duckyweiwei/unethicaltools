import Link from "next/link";

/**
 * Compact brand-context section for the homepage. Lives between
 * InfoSection (why local conversion) and the footer — so the reading flow
 * is: hook → pick a converter → privacy story → broader brand story.
 *
 * Deeper manifesto lives at /about; this is the 2-paragraph teaser.
 */
export function AboutBrand() {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-28 sm:mt-32 text-center">
      <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-5">
        About unethicaletools
      </div>
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
        Software the platforms would rather not exist
      </h2>
      <div className="mt-6 space-y-4 text-[var(--color-text-muted)] text-base leading-relaxed">
        <p>
          <span className="text-[var(--color-text)] font-medium">
            unethicaletools
          </span>{" "}
          makes small utilities that run on your device — no accounts, no
          uploads, no telemetry, no subscriptions. The name is the joke:
          by every conventional SaaS metric these tools are terrible
          business. No data to monetize, no engagement to compound,
          nothing to lock you into.
        </p>
        <p>
          By the metric that matters to you — does it do the thing without
          strings? — they work. The video converter is the first one.
          More coming.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/about"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow"
        >
          Read the full story
        </Link>
        <Link
          href="/suggestions"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          Suggest a tool
        </Link>
      </div>
    </section>
  );
}
