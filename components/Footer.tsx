import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-4 sm:px-6 mt-24 mb-10 text-center">
      <div className="rounded-2xl glass px-5 py-4 inline-flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
        <span>
          A{" "}
          <Link
            href="/about"
            className="text-[var(--color-text)] hover:underline"
          >
            unethicaletools
          </Link>{" "}
          project
        </span>
        <span className="opacity-40 hidden sm:inline">·</span>
        <span>
          Built with{" "}
          <a
            href="https://ffmpegwasm.netlify.app/"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-text)] hover:underline"
          >
            ffmpeg.wasm
          </a>{" "}
          · Next.js · Web Workers
        </span>
        <span className="opacity-40 hidden sm:inline">·</span>
        <span>No tracking. No uploads. No accounts.</span>
        <span className="opacity-40 hidden sm:inline">·</span>
        <span className="inline-flex gap-3">
          <Link
            href="/about"
            className="text-[var(--color-text)] hover:underline"
          >
            About
          </Link>
          <Link
            href="/faq"
            className="text-[var(--color-text)] hover:underline"
          >
            FAQ
          </Link>
          <Link
            href="/suggestions"
            className="text-[var(--color-text)] hover:underline"
          >
            Suggestions
          </Link>
        </span>
      </div>
    </footer>
  );
}
